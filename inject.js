// Cocos Creator Debugger - Injected Script
// 在页面主上下文中运行

(function() {
    let ccEngine = null;

    function findCc(win) {
        const candidates = ['cc', 'ark', 'CocosEngine', 'cocos', '_cc', 'engine', 'Cocos2dWeb'];
        for (const name of candidates) {
            if (win[name] && typeof win[name] === 'object') {
                const obj = win[name];
                if (obj && (obj.director || obj.Director || obj.game)) {
                    return obj;
                }
            }
        }
        return null;
    }

    function serializeNode(node) {
        if (!node) return null;

        const result = {
            name: node.name || node._name || 'Unnamed',
            uuid: node.uuid || node._id || 'temp_' + Math.random().toString(36).substr(2, 9),
            type: 'Node',
            active: node.active !== false,
            children: [],
            components: []
        };

        // 获取所有组件
        try {
            if (node.getComponents) {
                const components = node.getComponents('cc.Component') || [];
                for (let i = 0; i < components.length; i++) {
                    const comp = components[i];
                    if (comp && comp.constructor && comp.constructor.name) {
                        const typeName = comp.constructor.name;
                        // 跳过 UITransform
                        if (typeName === 'UITransform' || typeName === 'cc.UITransform') continue;

                        const compData = {
                            type: typeName,
                            enabled: comp.enabled !== false,
                            originalIndex: i  // 保存原始索引用于更新
                        };

                        // 如果是 Label，读取 string 属性
                        if (typeName === 'Label' || typeName === 'cc.Label') {
                            compData.string = comp.string || '';
                        }

                        result.components.push(compData);
                    }
                }
            }
        } catch (e) {}

        // 获取 UITransform 组件
        try {
            if (node.getComponent) {
                const uiTransform = node.getComponent('cc.UITransform') || node.getComponent('UITransform');
                if (uiTransform) {
                    const cs = uiTransform.contentSize;
                    result.contentSize = { width: cs ? cs.width : 0, height: cs ? cs.height : 0 };
                    result.anchorX = uiTransform.anchorX !== undefined ? uiTransform.anchorX : 0.5;
                    result.anchorY = uiTransform.anchorY !== undefined ? uiTransform.anchorY : 0.5;
                }
            }
        } catch (e) {}

        // 处理子节点
        let childArray = node.children || node._children;
        if (childArray && childArray.length > 0) {
            for (const child of childArray) {
                const childData = serializeNode(child);
                if (childData) result.children.push(childData);
            }
        }

        return result;
    }

    function getSceneData() {
        if (!ccEngine) return { error: 'No engine' };

        try {
            let scene = null;

            if (ccEngine.director && ccEngine.director.getScene) {
                scene = ccEngine.director.getScene();
            }

            if (!scene && ccEngine.game) {
                scene = ccEngine.game._scene || ccEngine.game.scene;
            }

            if (!scene) {
                for (let key in ccEngine) {
                    try {
                        const val = ccEngine[key];
                        if (val && typeof val === 'object' && val._id && (val._children || val.children)) {
                            scene = val;
                            break;
                        }
                    } catch (e) {}
                }
            }

            return serializeNode(scene);
        } catch (e) {
            return { error: e.message };
        }
    }

    function findNodeByUuid(node, uuid) {
        if (!node) return null;
        if (node.uuid === uuid || node._id === uuid) return node;

        const children = node.children || node._children;
        if (children) {
            for (const child of children) {
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
                case 'angle':
                    node.angle = value;
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
                case 'contentSize':
                    if (node.getComponent) {
                        const uiTransform = node.getComponent('cc.UITransform') || node.getComponent('UITransform');
                        if (uiTransform && uiTransform.contentSize) {
                            if (value.width !== undefined) uiTransform.contentSize.width = value.width;
                            if (value.height !== undefined) uiTransform.contentSize.height = value.height;
                        }
                    }
                    break;
                case 'anchorX':
                    if (node.getComponent) {
                        const uiTransform = node.getComponent('cc.UITransform') || node.getComponent('UITransform');
                        if (uiTransform) uiTransform.anchorX = value;
                    }
                    break;
                case 'anchorY':
                    if (node.getComponent) {
                        const uiTransform = node.getComponent('cc.UITransform') || node.getComponent('UITransform');
                        if (uiTransform) uiTransform.anchorY = value;
                    }
                    break;
                case 'labelString':
                    if (node.getComponents) {
                        const labels = node.getComponents('cc.Label') || node.getComponents('Label') || [];
                        for (const label of labels) {
                            label.string = value;
                        }
                    }
                    break;
            }
        }
    }

    function updateNode(uuid, updates) {
        if (!ccEngine) return { success: false, error: 'No engine' };

        try {
            const scene = ccEngine.director && ccEngine.director.getScene ? ccEngine.director.getScene() : null;
            if (!scene) return { success: false, error: 'No scene' };

            const node = findNodeByUuid(scene, uuid);
            if (!node) return { success: false, error: 'Node not found: ' + uuid };

            applyUpdates(node, updates);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    function updateComponentEnabled(nodeUuid, componentIndex, enabled) {
        if (!ccEngine) return { success: false, error: 'No engine' };
        if (!nodeUuid || nodeUuid.startsWith('temp_')) return { success: false, error: '节点无有效UUID' };

        try {
            const scene = ccEngine.director && ccEngine.director.getScene ? ccEngine.director.getScene() : null;
            if (!scene) return { success: false, error: 'No scene' };

            const node = findNodeByUuid(scene, nodeUuid);
            if (!node) return { success: false, error: 'Node not found' };

            if (node.getComponents) {
                const components = node.getComponents('cc.Component') || [];
                if (components[componentIndex]) {
                    components[componentIndex].enabled = enabled;
                    return { success: true };
                }
            }
            return { success: false, error: 'Component not found' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    function waitForEngine() {
        const cc = findCc(window.top || window);
        if (cc) {
            ccEngine = cc;
            window.postMessage({ type: 'COCOS_ENGINE_READY', engineName: 'cc' }, '*');
            return;
        }
        setTimeout(waitForEngine, 500);
    }

    // 监听来自 content script 的请求
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'GET_SCENE_FROM_INJECT') {
            const sceneData = getSceneData();
            window.postMessage({ type: 'SCENE_DATA_FROM_INJECT', data: sceneData }, '*');
        }
        if (event.data && event.data.type === 'UPDATE_NODE_FROM_INJECT') {
            const result = updateNode(event.data.uuid, event.data.updates);
            window.postMessage({ type: 'UPDATE_NODE_FROM_INJECT', ...result }, '*');
        }
        if (event.data && event.data.type === 'UPDATE_COMPONENT_FROM_INJECT') {
            const result = updateComponentEnabled(event.data.nodeUuid, event.data.componentIndex, event.data.enabled);
            window.postMessage({ type: 'UPDATE_COMPONENT_FROM_INJECT', ...result }, '*');
        }
    });

    waitForEngine();
})();
