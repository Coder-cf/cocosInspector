# Cocos Creator Debugger - Chrome 扩展

一个用于调试 Cocos Creator 游戏的 Chrome DevTools 扩展，可以可视化节点树并实时修改节点属性。

## 功能特性

- 🔍 **节点树查看** - 以树形结构显示游戏场景中的所有节点，支持展开/收缩
- 🔎 **节点搜索** - 按名称搜索特定节点
- 📝 **属性面板** - 查看和编辑选中节点的属性
- ✏️ **实时修改** - 修改属性后勾选框变化直接生效，无需额外点击
- 🎨 **类型识别** - 自动识别节点类型并显示对应图标
- 🧩 **组件管理** - 显示节点上的组件（除 UITransform 外），可修改 enabled 状态
- 📝 **Label 编辑** - 支持直接修改 Label 组件的文本内容

## 支持修改的属性

### 节点属性
- 基础信息：名称、激活状态
- 变换属性：位置 (x, y, z)、旋转（angle）、缩放 (x, y)
- 尺寸属性：宽高、锚点 (anchorX, anchorY)
- 透明度

### 组件属性
- 组件激活状态（enabled）
- Label 文本内容（string）

## 安装方法

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `tools/cocos-debugger-extension` 文件夹

## 使用方法

1. 在 Chrome 中打开 Cocos Creator 游戏页面
2. 打开 Chrome DevTools（F12），切换到 "Cocos Debugger" 面板
3. 在左侧节点树中点击要调试的节点
4. 在右侧属性面板中修改属性：
   - 复选框类属性（激活、组件 enabled）勾选即生效
   - 输入框属性修改后需点击「应用修改」按钮生效
5. 修改节点名称后，树视图中的节点名称会自动更新

## 文件结构

```
cocos-debugger-extension/
├── manifest.json         # 扩展配置文件
├── devtools-entry.js      # DevTools 面板入口
├── devtools.html          # DevTools 面板 HTML
├── devtools.js            # DevTools 面板逻辑
├── content.js             # 内容脚本（与 inject.js 通信）
├── inject.js              # 注入脚本（在页面上下文执行）
└── README.md              # 说明文档
```

## 技术实现

- **Manifest V3** - 使用最新的 Chrome 扩展 manifest 版本
- **注入脚本 (inject.js)** - 通过 `<script>` 标签注入到游戏页面主上下文，解决 content script 与页面脚本的 window 隔离问题
- **消息通信** - DevTools Panel ↔ content.js ↔ inject.js ↔ Cocos 引擎
- **节点查找** - 通过 `uuid` 或 `_id` 在场景中查找对应节点

## 工作流程

1. 扩展加载时，content.js 通过注入 script 标签加载 inject.js
2. inject.js 在页面主上下文中查找 Cocos 引擎实例
3. 用户操作时，DevTools 面板发送消息到 content.js
4. content.js 通过 postMessage 转发给 inject.js
5. inject.js 在页面上下文中执行节点查询和修改操作
6. 修改结果通过同样的路径返回

## 注意事项

- 需要游戏页面完全加载后才能使用
- 节点必须有有效的 uuid 才能进行属性修改（临时节点无法修改）
- 部分属性修改可能需要游戏重新渲染才能看到效果
- 并非所有 Cocos Creator 版本都已测试
