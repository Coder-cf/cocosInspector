// Cocos Creator Debugger - DevTools Panel Script

let selectedNode = null;
let nodeTree = null;

// DOM Elements
const treeView = document.getElementById('treeView');
const propertyView = document.getElementById('propertyView');
const nodeCountEl = document.getElementById('nodeCount');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');

// 展开的节点 ID 集合
const expandedNodes = new Set();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    refreshBtn.addEventListener('click', loadNodeTree);
    searchInput.addEventListener('input', filterTree);
    loadNodeTree();
});

// Load node tree
async function loadNodeTree() {
    statusEl.textContent = '正在连接...';
    treeView.innerHTML = '<div class="empty-tip">正在检测游戏引擎...</div>';
    expandedNodes.clear();

    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SCENE' });

        if (response && response.scene) {
            nodeTree = response.scene;
            statusEl.textContent = '已连接';
            renderTree(nodeTree);
            updateNodeCount(nodeTree);
        } else if (response && response.error) {
            statusEl.textContent = '检测失败';
            treeView.innerHTML = `<div class="empty-tip">错误: ${response.error}<br><br>请确保：<br>1. 刷新游戏页面<br>2. 等待游戏完全加载</div>`;
        } else {
            statusEl.textContent = '未检测到 Cocos';
            treeView.innerHTML = '<div class="empty-tip">未检测到 Cocos Creator 游戏<br><br>请刷新游戏页面</div>';
        }
    } catch (err) {
        statusEl.textContent = '连接失败';
        treeView.innerHTML = `<div class="empty-tip">连接失败: ${err.message}<br><br>请刷新游戏页面后重试</div>`;
    }
}

// 创建树节点元素（不添加到容器）
function createTreeNode(node, level) {
    const nodeId = node.uuid || node.name;
    const isExpanded = expandedNodes.has(nodeId);

    const nodeEl = document.createElement('div');
    nodeEl.className = 'tree-node';
    nodeEl.style.paddingLeft = `${level * 14}px`;
    nodeEl.dataset.nodeId = nodeId;

    // 箭头
    const hasChildren = node.children && node.children.length > 0;
    const arrow = document.createElement('span');
    arrow.className = `arrow ${hasChildren ? 'expandable' : ''}`;
    arrow.textContent = hasChildren ? (isExpanded ? '▼' : '▶') : '';
    nodeEl.appendChild(arrow);

    // 图标
    const icon = document.createElement('span');
    icon.className = 'node-icon';
    icon.textContent = getNodeIcon(node);
    nodeEl.appendChild(icon);

    // 名称
    const nameSpan = document.createElement('span');
    nameSpan.className = 'node-name';
    nameSpan.textContent = node.name || 'Unnamed';
    nameSpan.title = node.uuid || '';
    nodeEl.appendChild(nameSpan);

    // 点击节点选中
    nodeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        selectNode(node);
    });

    // 点击箭头展开/收缩
    if (hasChildren) {
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNode(nodeEl, node, level);
        });
    }

    // 如果已展开，渲染子节点
    if (isExpanded && hasChildren) {
        node.children.forEach(child => {
            nodeEl.appendChild(createTreeNode(child, level + 1));
        });
    }

    return nodeEl;
}

// 渲染整棵树
function renderTree(node, container = treeView, level = 0) {
    if (!node) return;
    container.appendChild(createTreeNode(node, level));
}

// 展开/收缩节点
function toggleNode(nodeEl, node, level) {
    const nodeId = node.uuid || node.name;
    const hasChildren = node.children && node.children.length > 0;
    if (!hasChildren) return;

    const arrow = nodeEl.querySelector('.arrow');

    if (expandedNodes.has(nodeId)) {
        // 收缩
        expandedNodes.delete(nodeId);
        arrow.textContent = '▶';

        // 移除所有子节点元素（只移除层级严格大于自己的节点）
        let next = nodeEl.nextElementSibling;
        while (next && parseInt(next.style.paddingLeft) > parseInt(nodeEl.style.paddingLeft)) {
            const toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
        }
    } else {
        // 展开
        expandedNodes.add(nodeId);
        arrow.textContent = '▼';

        // 找到插入位置：nodeEl 后面的第一个层级严格小于自己的节点（即下一个同级节点）
        let insertBeforeNode = nodeEl.nextElementSibling;
        while (insertBeforeNode && parseInt(insertBeforeNode.style.paddingLeft) > parseInt(nodeEl.style.paddingLeft)) {
            insertBeforeNode = insertBeforeNode.nextElementSibling;
        }

        // 渲染子节点，插入到正确位置
        const container = nodeEl.parentElement;
        node.children.forEach(child => {
            const childEl = createTreeNode(child, level + 1);
            if (insertBeforeNode) {
                container.insertBefore(childEl, insertBeforeNode);
            } else {
                container.appendChild(childEl);
            }
        });
    }
}

function getNodeIcon(node) {
    const name = (node.name || '').toLowerCase();
    const type = (node.type || '').toLowerCase();
    if (type.includes('canvas') || name.includes('canvas')) return '🎨';
    if (type.includes('label') || name.includes('text')) return '📝';
    if (type.includes('button')) return '🔘';
    if (type.includes('sprite') || name.includes('image')) return '🖼️';
    if (type.includes('scroll')) return '📜';
    if (type.includes('edit') || name.includes('input')) return '✏️';
    if (type.includes('toggle')) return '☑️';
    if (type.includes('progress')) return '📊';
    if (type.includes('slider')) return '🎚️';
    if (type.includes('audio') || name.includes('sound')) return '🔊';
    if (type.includes('camera')) return '📷';
    return '📎';
}

function selectNode(node) {
    document.querySelectorAll('.tree-node.selected').forEach(el => el.classList.remove('selected'));
    const nodeEl = document.querySelector(`[data-node-id="${node.uuid || node.name}"]`);
    if (nodeEl) nodeEl.classList.add('selected');
    selectedNode = node;
    renderProperties(node);
}

function renderProperties(node) {
    if (!node) {
        propertyView.innerHTML = '<div class="empty-tip">选择节点查看属性</div>';
        return;
    }

    let html = `
        <div class="property-section">
            <div class="property-title">基本信息</div>
            <div class="property-row">
                <label>名称</label>
                <input type="text" data-prop="name" value="${node.name || ''}">
            </div>
            <div class="property-row">
                <label>UUID</label>
                <span style="color:#666;font-size:10px">${node.uuid || 'N/A'}</span>
            </div>
            <div class="property-row">
                <label>类型</label>
                <span>${node.type || 'Node'}</span>
            </div>
            <div class="property-row">
                <label>激活</label>
                <input type="checkbox" data-prop="active" data-immediate="${node.uuid}" class="node-active" ${node.active ? 'checked' : ''}>
            </div>
        </div>
    `;

    const pos = node.position || { x: 0, y: 0, z: 0 };
    const rot = node.rotation || { x: 0, y: 0, z: 0 };
    const scl = node.scale || { x: 1, y: 1, z: 1 };
    const angle = typeof node.angle === 'number' ? node.angle : (rot.z || 0);

    html += `
        <div class="property-section">
            <div class="property-title">变换</div>
            <div class="property-row">
                <label>位置</label>
                <div class="input-group">
                    <input type="number" data-prop="position.x" value="${pos.x || 0}" step="1">
                    <input type="number" data-prop="position.y" value="${pos.y || 0}" step="1">
                    <input type="number" data-prop="position.z" value="${pos.z || 0}" step="1">
                </div>
            </div>
            <div class="property-row">
                <label>旋转</label>
                <input type="number" data-prop="angle" value="${angle}" step="1">
            </div>
            <div class="property-row">
                <label>缩放</label>
                <div class="input-group">
                    <input type="number" data-prop="scale.x" value="${scl.x || 1}" step="0.1">
                    <input type="number" data-prop="scale.y" value="${scl.y || 1}" step="0.1">
                </div>
            </div>
        </div>
    `;

    if (node.contentSize) {
        const anchorX = node.anchorX !== undefined ? node.anchorX : 0.5;
        const anchorY = node.anchorY !== undefined ? node.anchorY : 0.5;
        html += `
            <div class="property-section">
                <div class="property-title">尺寸</div>
                <div class="property-row">
                    <label>宽高</label>
                    <div class="input-group">
                        <input type="number" data-prop="contentSize.width" value="${node.contentSize.width || 0}" step="1">
                        <input type="number" data-prop="contentSize.height" value="${node.contentSize.height || 0}" step="1">
                    </div>
                </div>
                <div class="property-row">
                    <label>锚点</label>
                    <div class="input-group">
                        <input type="number" data-prop="anchorX" value="${anchorX}" step="0.1" style="width:60px">
                        <input type="number" data-prop="anchorY" value="${anchorY}" step="0.1" style="width:60px">
                    </div>
                </div>
            </div>
        `;
    }

    if (typeof node.opacity === 'number') {
        html += `
            <div class="property-section">
                <div class="property-title">透明度</div>
                <div class="property-row">
                    <label>Opacity</label>
                    <input type="range" data-prop="opacity" value="${node.opacity}" min="0" max="255" style="flex:1">
                    <span style="width:30px">${node.opacity}</span>
                </div>
            </div>
        `;
    }

    // 显示组件列表
    if (node.components && node.components.length > 0) {
        html += `<div class="property-section"><div class="property-title">组件</div>`;
        node.components.forEach((comp, displayIndex) => {
            html += `
                <div class="property-row" style="align-items:center">
                    <label style="flex:1">${comp.type}</label>
                    <input type="checkbox" data-comp="${comp.originalIndex}" class="comp-enabled" ${comp.enabled ? 'checked' : ''}>
                </div>
            `;
            // 如果是 Label 组件，显示文本输入
            if (comp.type === 'Label' && comp.string !== undefined) {
                html += `
                    <div class="property-row">
                        <label>文本</label>
                        <input type="text" data-prop="labelString" value="${comp.string || ''}" style="flex:1">
                    </div>
                `;
            }
        });
        html += `</div>`;
    }

    html += `<button id="applyBtn" class="btn btn-primary">应用修改</button>`;

    propertyView.innerHTML = html;
    document.getElementById('applyBtn').addEventListener('click', applyChanges);

    // 节点激活切换事件（直接生效）
    document.querySelectorAll('.node-active').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            try {
                await chrome.runtime.sendMessage({
                    type: 'UPDATE_NODE',
                    uuid: node.uuid,
                    updates: { active: e.target.checked }
                });
            } catch (err) {}
        });
    });

    // 组件 enabled 切换事件（直接生效）
    document.querySelectorAll('.comp-enabled').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const originalIndex = parseInt(e.target.dataset.comp);
            const comp = node.components.find(c => c.originalIndex === originalIndex);
            if (comp) {
                try {
                    await chrome.runtime.sendMessage({
                        type: 'UPDATE_COMPONENT_ENABLED',
                        nodeUuid: node.uuid,
                        componentIndex: originalIndex,
                        enabled: e.target.checked
                    });
                } catch (err) {}
            }
        });
    });
}

async function applyChanges() {
    if (!selectedNode) return;

    const inputs = propertyView.querySelectorAll('input');
    const updates = {};

    inputs.forEach(input => {
        const prop = input.dataset.prop;
        if (!prop) return;

        let value;
        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = parseFloat(input.value) || 0;
        } else {
            value = input.value;
        }

        const parts = prop.split('.');
        let obj = updates;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!obj[parts[i]]) obj[parts[i]] = {};
            obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
    });

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'UPDATE_NODE',
            uuid: selectedNode.uuid,
            updates: updates
        });
        if (response && response.success) {
            statusEl.textContent = '已应用修改';
            setTimeout(() => { statusEl.textContent = '已连接'; }, 1500);
            // 不刷新树，只更新属性面板的输入值为用户输入的值
            inputs.forEach(input => {
                const prop = input.dataset.prop;
                if (!prop) return;
                const parts = prop.split('.');
                let val = updates;
                for (const p of parts) { val = val && val[p]; }
                if (val !== undefined) {
                    if (input.type === 'checkbox') {
                        input.checked = val;
                    } else if (input.type === 'number') {
                        input.value = val;
                    } else {
                        input.value = val;
                    }
                }
            });
            // 如果 name 变了，更新树视图中的显示
            if (updates.name && selectedNode) {
                selectedNode.name = updates.name;
                const nodeEl = document.querySelector(`[data-node-id="${selectedNode.uuid}"] .node-name`);
                if (nodeEl) nodeEl.textContent = updates.name;
            }
        } else {
            statusEl.textContent = '应用失败: ' + (response && response.error || '未知错误');
        }
    } catch (err) {
        statusEl.textContent = '应用失败';
    }
}

function filterTree() {
    const query = searchInput.value.toLowerCase();
    treeView.innerHTML = '';
    expandedNodes.clear();
    if (!query) {
        renderTree(nodeTree);
    } else {
        const filtered = filterNodes(nodeTree, query);
        filtered.forEach(node => renderTree(node));
    }
}

function filterNodes(node, query) {
    if (!node) return [];
    const results = [];
    if ((node.name || '').toLowerCase().includes(query)) {
        results.push(node);
    }
    if (node.children) {
        node.children.forEach(child => {
            results.push(...filterNodes(child, query));
        });
    }
    return results;
}

function updateNodeCount(node) {
    nodeCountEl.textContent = countNodes(node) + ' 节点';
}

function countNodes(node) {
    if (!node) return 0;
    let count = 1;
    if (node.children) {
        node.children.forEach(child => { count += countNodes(child); });
    }
    return count;
}
