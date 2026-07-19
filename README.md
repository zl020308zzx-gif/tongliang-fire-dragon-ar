# 《龙脉铜梁》AR 互动体验

Vite + A-Frame + MindAR 的移动端网页 AR 项目。A-Frame 与 MindAR 继续由 `index.html` 中的 HTTPS CDN 脚本提供，工程没有安装对应 npm 包。

## 启动

```powershell
npm.cmd run dev
```

- 第一页无摄像头预览：`http://localhost:5173/?preview=page1`
- 正式 AR（同一场景识别第一页和第二页）：`http://localhost:5173/?ar=page1`
- 第二页入口别名：`http://localhost:5173/?ar=page2`
- 第二页调试：`http://localhost:5173/?ar=page2&debug=1`

`?ar=page1` 与 `?ar=page2` 使用同一个 A-Frame 场景、摄像机、MindAR 实例、渲染循环和 `targets.mind`，不会因页面章节切换再次请求摄像头。第二页对应 `targetIndex: 1`。

## 第二页资源

- 识别数据：`public/assets/markers/targets.mind`
- 第二页识别图：`public/assets/markers/marker-02-craft.jpg`
- 背景、标题、简介、地图、主视觉、类型和时间轴：`public/assets/page2/`
- 火龙模型：`public/assets/model/fire-dragon.glb`

实际简介线稿文件名为 `page2-intro-dragon-line.png.png`，代码已按项目中的真实文件名引用。所有公开资源地址均通过 `src/asset-url.js` 和 `import.meta.env.BASE_URL` 生成。

## 第二页代码

- `src/page2/page2-config.js`：targetIndex、背景、总览、圆环、点击区、模型、粒子和时长配置
- `src/page2/page2.js`：场景结构、页面状态机、追踪恢复、UI 和调试入口
- `src/page2/page2-overview.js`：总览入场、退场、恢复和持续微动
- `src/page2/page2-model.js`：GLB 加载、材质透明度、入场、旋转缩放和热点投影
- `src/page2/page2-particles.js`：三层 Three.js 红金铁花粒子
- `src/page2/page2-hotspots.js`：五个热点中文资料与本地进度

第二页状态包括 `PAGE2_HIDDEN`、`PAGE2_GUIDE`、`PAGE2_OVERVIEW_ENTERING`、`PAGE2_OVERVIEW`、`PAGE2_MODEL_ENTERING`、`PAGE2_MODEL`、`PAGE2_COMPLETE` 和 `PAGE2_TRACKING_LOST`。

## 调试与人工微调

访问 `?ar=page2&debug=1` 后会显示状态、targetIndex、FPS、主视觉边界、圆环中心、火龙点击区、模型坐标轴与热点编号。调试面板可直接修改圆环中心、火龙热区中心和五个热点 XYZ，并可将当前配置输出到控制台。

主要配置位置：

- 圆环中心：`PAGE2_CONFIG.mainVisual.ringCenterX / ringCenterY`
- 火龙点击区：`PAGE2_CONFIG.fireEntryHotspot`
- 模型位置、比例、方向：`PAGE2_CONFIG.model.position / rotation / scale`
- 五个热点模型局部坐标：`PAGE2_HOTSPOTS[].position`

调试面板的“模拟识别”仅用于桌面排版检查，不启动摄像头；真机验收仍应使用第二张识别图测试跟踪、手势和遮挡关系。

## 构建

```powershell
npm.cmd run build
```

