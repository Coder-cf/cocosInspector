// Cocos Creator Debugger - Content Script
// 注入到页面获取 Cocos Creator 游戏数据

(function() {
    'use strict';

    // 通过注入 script 标签的方式在页面主上下文中执行代码
    function injectScript() {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('inject.js');
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    }

    injectScript();

    // 延迟检查，等待游戏加载
    let checkCount = 0;
    const maxChecks = 20;
    const checkInterval = 300;

    function startChecking() {
        checkCount++;

        const result = findCocosEngine();
        if (result) {
            window.__cocosDebuggerEngine = result;
            return;
        }

        if (checkCount < maxChecks) {
            setTimeout(startChecking, checkInterval);
        }
    }

    // 获取页面主框架的 window (content script 的 window 是隔离的)
    function getPageWindow() {
        try {
            // 尝试获取 top window
            if (window.top) {
                return window.top;
            }
        } catch (e) {}
        return window;
    }

    // 查找 Cocos 引擎
    function findCocosEngine() {
        const pageWindow = getPageWindow();

        const candidates = ['cc', 'ark', 'CocosEngine', 'cocos', '_cc', 'engine', 'Cocos2dWeb'];

        // 先检查 content script 自己的 window
        for (const name of candidates) {
            if (window[name] && typeof window[name] === 'object') {
                const obj = window[name];
                if (obj.director || obj.Director || obj.game) {
                    return obj;
                }
            }
        }

        // 再检查 page window
        for (const name of candidates) {
            if (pageWindow[name] && typeof pageWindow[name] === 'object') {
                const obj = pageWindow[name];
                if (obj.director || obj.Director || obj.game) {
                    return obj;
                }
            }
        }

        // 深度搜索所有 window 属性
        const searchInWindow = (win) => {
            for (let key in win) {
                try {
                    const obj = win[key];
                    if (obj && typeof obj === 'object') {
                        if (obj.director && typeof obj.director === 'object') {
                            return obj;
                        }
                        if (obj.Game || obj.Director || obj.director) {
                            return obj;
                        }
                    }
                } catch (e) {}
            }
            return null;
        };

        let result = searchInWindow(window);
        if (result) return result;

        result = searchInWindow(pageWindow);
        if (result) return result;

        return null;
    }

    // 获取场景数据 (现在由 inject.js 处理)
    function getSceneData() {
        // 场景数据现在通过 inject.js 获取
        return { error: 'Scene data now fetched via inject.js' };
    }

    function findCocosEngineDirectly() {
        // 递归搜索所有 frames
        function searchInWindow(win, depth) {
            if (!win || depth > 10) return null;

            const candidates = ['cc', 'ark', 'CocosEngine', 'cocos', '_cc', 'engine', 'Cocos2dWeb'];

            for (const name of candidates) {
                if (win[name] && typeof win[name] === 'object') {
                    const obj = win[name];
                    if (obj && (obj.director || obj.Director || obj.game)) {
                        return obj;
                    }
                }
            }

            // 搜索 frames
            try {
                if (win.frames) {
                    for (let i = 0; i < win.frames.length; i++) {
                        const result = searchInWindow(win.frames[i], depth + 1);
                        if (result) return result;
                    }
                }
            } catch (e) {}

            return null;
        }

        // 先检查缓存
        if (document.__cocosDebuggerEngine) {
            return document.__cocosDebuggerEngine;
        }

        // 搜索当前窗口和所有 frames
        const result = searchInWindow(window, 0);
        if (result) return result;

        // 尝试 top
        try {
            if (window.top && window.top !== window) {
                const topResult = searchInWindow(window.top, 0);
                if (topResult) return topResult;
            }
        } catch (e) {}

        return null;
    }

    // 序列化节点
    function serializeNode(node) {
        if (!node) return null;

        const result = {
            name: node.name || node._name || 'Unnamed',
            uuid: node.uuid || node._id || generateId(),
            type: 'Node',
            active: node.active !== false,
            children: []
        };

        try {
            if (node.position) {
                result.position = { x: node.position.x || 0, y: node.position.y || 0, z: node.position.z || 0 };
            }
            if (node.rotation) {
                result.rotation = { x: node.rotation.x || 0, y: node.rotation.y || 0, z: node.rotation.z || 0 };
            }
            if (node.scale) {
                result.scale = { x: node.scale.x || 1, y: node.scale.y || 1, z: node.scale.z || 1 };
            }
        } catch (e) {}

        if (typeof node.angle === 'number' && !result.rotation) {
            result.rotation = { x: 0, y: 0, z: -node.angle };
        }

        try {
            if (node.getComponent) {
                const uiTransform = node.getComponent('cc.UITransform') || node.getComponent('UITransform');
                if (uiTransform) {
                    const cs = uiTransform.contentSize;
                    result.contentSize = { width: cs ? cs.width : 0, height: cs ? cs.height : 0 };
                    result.anchor = { x: uiTransform.anchorX || 0.5, y: uiTransform.anchorY || 0.5 };
                }
            }
        } catch (e) {}

        try {
            if (node.getComponent) {
                const sprite = node.getComponent('cc.Sprite') || node.getComponent('Sprite');
                if (sprite) {
                    result.type = 'Sprite';
                    if (sprite.color) {
                        result.color = { r: sprite.color.r, g: sprite.color.g, b: sprite.color.b, a: sprite.color.a };
                    }
                }
            }
        } catch (e) {}

        try {
            if (node.getComponent) {
                const label = node.getComponent('cc.Label') || node.getComponent('Label');
                if (label) {
                    result.type = 'Label';
                    result.string = label.string || '';
                    result.fontSize = label.fontSize;
                }
            }
        } catch (e) {}

        if (typeof node.opacity === 'number') {
            result.opacity = node.opacity;
        }

        let childArray = node.children || node._children;

        try {
            if (childArray && childArray.length > 0) {
                for (const child of childArray) {
                    const childData = serializeNode(child);
                    if (childData) result.children.push(childData);
                }
            }
        } catch (e) {}

        return result;
    }

    // 更新节点
    function updateNode(uuid, updates) {
        const cc = findCocosEngineDirectly();
        if (!cc) throw new Error('Cocos engine not found');

        const node = findNodeByUuid(cc.director.getScene(), uuid);
        if (!node) throw new Error('Node not found: ' + uuid);

        applyUpdates(node, updates);
    }

    function findNodeByUuid(node, uuid) {
        if (!node) return null;
        if (node.uuid === uuid || node._id === uuid) return node;

        if (node.children) {
            for (const child of node.children) {
                const found = findNodeByUuid(child, uuid);
                if (found) return found;
            }
        }
        return null;
    }

    function applyUpdates(node, updates) {
        for (const [key, value] of Object.entries(updates)) {
            switch (key) {
                case 'name': node.name = value; break;
                case 'active':
                    node.active = value;
                    node.activeInHierarchy = value;
                    break;
                case 'position':
                    if (node.position) {
                        if (value.x !== undefined) node.position.x = value.x;
                        if (value.y !== undefined) node.position.y = value.y;
                        if (value.z !== undefined) node.position.z = value.z;
                    }
                    break;
                case 'rotation':
                    if (value.x !== undefined) node.rotation.x = value.x;
                    if (value.y !== undefined) node.rotation.y = value.y;
                    if (value.z !== undefined) node.rotation.z = value.z;
                    break;
                case 'scale':
                    if (node.scale) {
                        if (value.x !== undefined) node.scale.x = value.x;
                        if (value.y !== undefined) node.scale.y = value.y;
                        if (value.z !== undefined) node.scale.z = value.z;
                    }
                    break;
                case 'opacity':
                    node.opacity = value;
                    break;
            }
        }
    }

    function generateId() {
        return '_temp_' + Math.random().toString(36).substr(2, 9);
    }

    // 存储从 inject.js 收到的场景数据
    let pendingSceneData = null;
    let pendingUpdateResponse = null;

    // 消息监听 (从 inject.js 来的 postMessage)
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SCENE_DATA_FROM_INJECT') {
            pendingSceneData = event.data.data;
        }
        if (event.data && event.data.type === 'UPDATE_NODE_FROM_INJECT') {
            pendingUpdateResponse = event.data;
        }
        if (event.data && event.data.type === 'UPDATE_COMPONENT_FROM_INJECT') {
            pendingUpdateResponse = event.data;
        }
    });

    // Chrome extension 消息监听
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'GET_SCENE') {
            pendingSceneData = null;
            window.postMessage({ type: 'GET_SCENE_FROM_INJECT' }, '*');
            setTimeout(() => {
                sendResponse({ scene: pendingSceneData || { error: 'Scene not ready' } });
            }, 300);
        } else if (message.type === 'UPDATE_NODE') {
            pendingUpdateResponse = null;
            window.postMessage({ type: 'UPDATE_NODE_FROM_INJECT', uuid: message.uuid, updates: message.updates }, '*');
            setTimeout(() => {
                if (pendingUpdateResponse) {
                    sendResponse(pendingUpdateResponse);
                } else {
                    sendResponse({ success: false, error: 'Update timeout' });
                }
            }, 300);
        } else if (message.type === 'UPDATE_COMPONENT_ENABLED') {
            pendingUpdateResponse = null;
            window.postMessage({ type: 'UPDATE_COMPONENT_FROM_INJECT', nodeUuid: message.nodeUuid, componentIndex: message.componentIndex, enabled: message.enabled }, '*');
            setTimeout(() => {
                if (pendingUpdateResponse) {
                    sendResponse(pendingUpdateResponse);
                } else {
                    sendResponse({ success: false, error: 'Update timeout' });
                }
            }, 300);
        }
        return true;
    });

    // 启动检测
    startChecking();
})();
