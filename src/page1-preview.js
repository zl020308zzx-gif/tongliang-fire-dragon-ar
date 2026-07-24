import { PAGE1_PREVIEW_CONFIG } from './config.js'
import { initializePage1Controller } from './page1-controller.js'

const vector = (values) => values.join(' ')

const imageEntity = (assetId, config, extra = '') => `
  <a-image src="#${assetId}" position="${vector(config.position)}" rotation="${vector(config.rotation)}"
    width="${config.size.width}" height="${config.size.height}"
    material="transparent: true; alphaTest: 0.01; depthWrite: true; depthTest: true; side: double; shader: flat" ${extra}></a-image>
`

const explodedGroup = (config) => `
  <a-entity id="explodedCraftGroup" position="${vector(config.groupPosition)}"
    rotation="${vector(config.groupRotation)}" visible="false">
    ${config.layers
      .map(
        (layer) => `
          <a-image data-explode-layer="${layer.id}" data-render-order="${layer.renderOrder}" src="#explode-${layer.id}"
            position="0 0 0" width="${config.planeSize.width}" height="${config.planeSize.height}"
            material="transparent: true; alphaTest: 0.01; opacity: 1; depthWrite: false; depthTest: true; side: double; shader: flat"></a-image>
        `,
      )
      .join('')}
    <a-plane id="explode-focus-outline" position="0 0 0" data-render-order="21"
      width="${config.planeSize.width + 0.05}" height="${config.planeSize.height + 0.05}"
      material="color: #d7a64a; wireframe: true; transparent: true; opacity: 0.78; shader: flat"
      visible="false"></a-plane>
  </a-entity>
`

const debugControls = (layers) => `
  <aside class="layer-debug" aria-label="Canvas 图层测试"><div class="layer-buttons">
    ${layers.map((layer, index) => `<button type="button" data-layer="${layer.id}" aria-pressed="${index === 0}">${layer.label}</button>`).join('')}
  </div></aside>
`

const debugPanel = (mode, config) => {
  if (mode === 'bamboo') return `<aside class="debug-panel"><p>状态 <strong data-debug-state>LINEART</strong></p><p>长按进度 <strong data-debug-progress>0%</strong></p><p>指针按下 <strong data-debug-pointer>否</strong></p><p>遮罩半径 <strong data-debug-radius>0 px</strong></p></aside><div class="hit-area-debug" hidden></div>`
  if (mode === 'paper') return `<aside class="debug-panel"><p>滑杆比例 <strong data-debug-paper-progress>0%</strong></p><p>完成阈值 <strong>${Math.round(config.paperCompare.completeThreshold * 100)}%</strong></p><p>当前 UV <strong data-debug-uv>—</strong></p><p>hasSeenFullPaper <strong data-debug-paper-seen>false</strong></p><p>正在拖动 <strong data-debug-paper-dragging>否</strong></p><p>分割线 <strong data-debug-paper-boundary>0 px</strong></p><p>柔边范围 <strong>${config.paperCompare.featherWidth} px</strong></p></aside><div class="paper-boundary-debug" hidden></div><div class="hit-area-debug" hidden></div>`
  if (mode === 'paint') return `<aside class="debug-panel paint-debug-panel"><p>指针位置 <strong data-debug-brush-position>—</strong></p><p>gestureActive <strong data-debug-paint-active>否</strong></p><p>pointerCaptured <strong data-debug-paint-captured>否</strong></p><p>insideCanvas <strong data-debug-paint-inside>否</strong></p><p>insideColorMask <strong data-debug-paint-mask>否</strong></p><p>suspendedOutsideCanvas <strong data-debug-paint-suspended>否</strong></p><p>lastValidPaintPoint <strong data-debug-paint-last>—</strong></p><p>画笔半径 <strong>${config.paintBrush.radius} px</strong></p><p>核心比例 <strong>${config.paintBrush.coreRatio}</strong></p><p>覆盖率 <strong data-debug-paint-progress>0%</strong></p><div class="paint-debug-canvases"><figure><canvas class="debug-valid-mask" width="${config.paintInteraction.statistics.size}" height="${config.paintInteraction.statistics.size}"></canvas><figcaption>有效区域</figcaption></figure><figure><canvas class="debug-painted-mask" width="${config.paintInteraction.statistics.size}" height="${config.paintInteraction.statistics.size}"></canvas><figcaption>coverageMask</figcaption></figure></div></aside><div class="hit-area-debug" hidden></div>`
  if (mode === 'eye') return `<aside class="debug-panel"><p>当前 UV <strong data-debug-eye-uv>—</strong></p><p>是否命中 <strong data-debug-eye-hit>—</strong></p></aside><div class="eye-hotspot-debug" hidden><i></i></div>`
  if (mode === 'video') return `<aside class="debug-panel"><p>视频状态 <strong data-debug-video-mode>idle</strong></p><p>静态平面 <strong data-debug-video-craft>显示</strong></p><p>视频平面 <strong data-debug-video-plane>隐藏</strong></p></aside>`
  if (mode === 'explode') return `<aside class="debug-panel explode-debug-panel"><p>爆炸状态 <strong data-debug-explode-state>EXPLODE_VIEW</strong></p><p>选中层 <strong data-debug-explode-selected>—</strong></p><p>展开进度 <strong data-debug-explode-progress>0%</strong></p><p>panelSurfaceZ <strong data-debug-explode-panel>${config.explodedView.panelSurfaceZ}</strong></p><p>frontDirectionSign <strong data-debug-explode-sign>${config.explodedView.frontDirectionSign}</strong></p><p>视差旋转 <strong data-debug-parallax>0, 0</strong></p><p>输入坐标 <strong data-debug-parallax-input>0, 0</strong></p><p data-debug-explode-warning>等待图层状态</p><pre data-debug-explode-layers></pre><p>可点击范围（屏幕 px）</p><pre data-debug-explode-click-bounds></pre><p>多层局部标注 <strong>见画面</strong></p></aside>`
  if (mode === 'hints') return `<aside class="debug-panel hints-debug-panel"><p>提示配置 <strong>全部显示</strong></p><pre>${JSON.stringify(config.interactionHints, null, 2)}</pre></aside><div class="hit-area-debug" hidden></div>`
  if (mode === 'state') return `<aside class="debug-panel state-debug-panel"><p>当前状态 <strong data-debug-current-state>LINEART</strong></p><p>上一个状态 <strong data-debug-previous-state>—</strong></p><p>bambooProgress <strong data-debug-state-bamboo>0%</strong></p><p>paperProgress <strong data-debug-state-paper>0%</strong></p><p>paintProgress <strong data-debug-state-paint>0%</strong></p><p>视频状态 <strong data-debug-video>idle</strong></p><p>完成状态 <strong data-debug-completed>false</strong></p></aside>`
  return ''
}

export function renderPage1Preview(root) {
  root.__page1Cleanup?.()
  const config = PAGE1_PREVIEW_CONFIG
  const params = new URLSearchParams(window.location.search)
  const debugValue = params.get(config.debug.queryKey)
  const isLayerDebug = debugValue === config.debug.layersValue
  const debugModes = ['bamboo', 'paper', 'paint', 'eye', 'video', 'explode', 'hints', 'state']
  const debugMode = debugModes.includes(debugValue) ? debugValue : null

  root.innerHTML = `
    <main class="page1-preview" style="--color-mask-url: url('${config.assets.colorMask}')">
      <a-scene class="preview-scene" embedded background="color: #130c08"
        renderer="antialias: true; colorManagement: true" vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false" loading-screen="enabled: false">
        <a-assets timeout="5000">
          <img id="craft-panel" src="${config.assets.backgroundBoard}" alt="" draggable="false" />
          <img id="badge-bamboo" src="${config.assets.badge}" alt="" draggable="false" />
          ${config.assets.craftLayers.map((layer) => `<img id="explode-${layer.id}" src="${layer.path}" alt="" draggable="false" />`).join('')}
          <video id="dragon-video" src="${config.assets.awakenVideo}" playsinline webkit-playsinline preload="metadata"></video>
          <canvas id="${config.canvas.id}" width="${config.canvas.width}" height="${config.canvas.height}"></canvas>
        </a-assets>

        ${imageEntity('craft-panel', config.backgroundBoard, 'id="craft-panel-surface" data-render-order="0"')}
        <a-plane id="craft-plane" position="${vector(config.craftPlane.position)}" rotation="${vector(config.craftPlane.rotation)}"
          width="${config.craftPlane.size.width}" height="${config.craftPlane.size.height}"
          material="src: #${config.canvas.id}; transparent: true; alphaTest: 0.01; depthWrite: false; depthTest: true; side: double; shader: flat"
          animation__fade="property: material.opacity; from: 0; to: 1; dur: 600; easing: easeOutQuad"></a-plane>
        <a-video id="dragon-video-plane" src="#dragon-video" position="${vector(config.videoPlane.position)}"
          rotation="${vector(config.videoPlane.rotation)}" width="${config.videoPlane.size.width}"
          height="${config.videoPlane.size.height}" material="shader: flat" visible="false"></a-video>
        ${imageEntity('badge-bamboo', config.badge, `id="bamboo-badge" scale="0.6 0.6 0.6" material="transparent: true; opacity: 0; shader: flat" visible="false" animation__scale="property: scale; from: 0.6 0.6 0.6; to: 1 1 1; dur: ${config.badge.animationDurationMs}; startEvents: showbadge" animation__opacity="property: material.opacity; from: 0; to: 1; dur: ${config.badge.animationDurationMs}; startEvents: showbadge"`)}
        ${explodedGroup(config.explodedView)}

        <a-camera position="${vector(config.camera.position)}" rotation="${vector(config.camera.rotation)}"
          camera="fov: ${config.camera.fov}" look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>
      </a-scene>

      <header class="page-title"><span>01</span><h1>竹骨成龙</h1></header>
      <div class="craft-stamps" aria-label="工艺进度印记">
        ${config.craftStamps.labels.map((label, index) => `<span data-craft-stamp="${index}" class="${index === 0 ? 'is-current' : ''}">${label}</span>`).join('')}
      </div>

      ${isLayerDebug ? debugControls(config.assets.craftLayers) : ''}
      ${debugPanel(debugMode, config)}
      <div class="hold-interaction-hint" hidden><i></i><b>长按</b></div>
      <div class="paper-slider-hint" hidden><i>↔</i></div>
      <div class="paint-entry-hint" hidden><span>滑动彩绘</span></div>
      <div class="paint-brush-cursor" hidden></div>
      <div class="eye-interaction-hint" hidden><i></i><b>点击龙眼</b></div>
      <div class="stage-particles" aria-hidden="true"></div>
      <div class="review-ember-glow" aria-hidden="true" hidden></div>
      <nav class="explode-stage-tabs" aria-label="四层成龙谱阶段" hidden>
        ${config.explodedView.layers.map((layer) => `<button type="button" data-explode-tag="${layer.id}"><strong>${layer.stage}</strong>${layer.shortLabel}</button>`).join('')}
      </nav>
      <div class="craft-annotations" hidden>
        ${Object.entries(config.explodedView.annotations).flatMap(([layerId, items]) =>
          items.map((item) => `<span data-annotation-layer="${layerId}" data-annotation="${item.id}" hidden><i></i><strong>${item.title}</strong><small>${item.description}</small></span>`),
        ).join('')}
      </div>
      <p class="craft-feedback" role="status" hidden></p>
      <p class="layer-error" role="alert" hidden></p>

      <section class="step-card" aria-labelledby="step-title">
        <p class="step-number">${config.copy.steps.lineart.number}</p>
        <h2 id="step-title">${config.copy.steps.lineart.title}</h2>
        <p class="step-description">${config.copy.steps.lineart.description}</p>
        <p class="step-hint"><span>操作提示</span>起稿完成后进入扎骨体验。</p>
        <div class="card-actions">
          <button type="button" data-card-action="retry" hidden>重新播放</button>
          <button type="button" data-card-action="skip" hidden>跳过视频</button>
          <button type="button" data-card-action="review" hidden>查看工艺总览</button>
          <button type="button" data-card-action="overview" hidden>返回全貌</button>
          <button type="button" data-card-action="restart" hidden>重新体验</button>
          <button type="button" data-card-action="end" hidden>结束预览</button>
        </div>
        <p class="preview-end-notice" role="status" hidden></p>
      </section>
    </main>
  `

  root.__page1Cleanup = initializePage1Controller({
    root,
    config,
    debugLayers: isLayerDebug,
    debugMode,
    shouldReset: params.get('reset') === '1',
  })
}
