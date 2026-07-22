import { createStableAnchorController } from '../stable-anchor-controller.js'
import { createTargetLifecycle } from '../target-lifecycle.js'
import { PAGE2_HOTSPOTS, createPage2Progress } from './page2-hotspots.js'
import { createPage2Model } from './page2-model.js'
import { createPage2Overview } from './page2-overview.js'
import { createPage2Particles } from './page2-particles.js'
import { createPage2Floor } from './page2-floor.js'
import { PAGE2_ASSET_ENTRIES, startPage2CriticalPreload } from './page2-preloader.js'
import { PAGE2_CONFIG, PAGE2_STATES } from './page2-config.js'

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const invalidNumericLabels = new Set()
const finiteOr = (value, fallback, label) => {
  if (Number.isFinite(value)) return value
  if (!invalidNumericLabels.has(label)) {
    invalidNumericLabels.add(label)
    console.error(`[page2] Invalid numeric value: ${label}`, value)
  }
  return fallback
}
const easeInOutCubic = (value) => {
  const t = clamp(value)
  return t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2
}

const assetEntries = PAGE2_ASSET_ENTRIES

const assetEntryByKey = new Map(assetEntries.map(([id, key]) => [key, id]))

const resolvePage2Config = (config) => {
  const source = config && typeof config === 'object' ? config : {}
  return {
    ...PAGE2_CONFIG,
    ...source,
    assets: { ...PAGE2_CONFIG.assets, ...(source.assets || {}) },
    background: { ...PAGE2_CONFIG.background, ...(source.background || {}) },
    intro: { ...PAGE2_CONFIG.intro, ...(source.intro || {}) },
    map: { ...PAGE2_CONFIG.map, ...(source.map || {}) },
    mainVisual: { ...PAGE2_CONFIG.mainVisual, ...(source.mainVisual || {}) },
    fireEntryHotspot: { ...PAGE2_CONFIG.fireEntryHotspot, ...(source.fireEntryHotspot || {}) },
    floorBase: { ...PAGE2_CONFIG.floorBase, ...(source.floorBase || {}) },
    rescanReplay: { ...PAGE2_CONFIG.rescanReplay, ...(source.rescanReplay || {}) },
    mindar: { ...PAGE2_CONFIG.mindar, ...(source.mindar || {}) },
    spatial: { ...PAGE2_CONFIG.spatial, ...(source.spatial || {}) },
    model: { ...PAGE2_CONFIG.model, ...(source.model || {}) },
    hotspots: { ...PAGE2_CONFIG.hotspots, ...(source.hotspots || {}) },
    layers: Array.isArray(source.layers) ? source.layers : PAGE2_CONFIG.layers,
  }
}

const image = (id, key, config) =>
  `<img id="${id}" data-page2-src="${config.assets[key]}" alt="" draggable="false" crossorigin="anonymous" />`

export const page2AssetsMarkup = (config = PAGE2_CONFIG) => {
  const resolvedConfig = resolvePage2Config(config)
  return `
    ${assetEntries.map(([id, key]) => image(id, key, resolvedConfig)).join('')}
  `
}

const fullLayer = (assetId, layer, assetKey) => `
  <a-image data-page2-layer="${layer}" data-page2-asset-key="${assetKey}" width="${PAGE2_CONFIG.background.width}" height="${PAGE2_CONFIG.background.height}" position="0 0 0"
    material="shader: flat; transparent: true; alphaTest: 0.005; depthWrite: false; depthTest: true; side: double"></a-image>`

const hotspotMarkup = (hotspot, config, debug) => `
  <a-entity data-page2-hotspot="${hotspot.id}" position="${hotspot.position.x} ${hotspot.position.y} ${hotspot.position.z}">
    <a-sphere data-hotspot-core radius="${config.hotspots.radius}"
      material="shader: flat; color: #f4bd50; emissive: #c86d20; emissiveIntensity: 1; transparent: true; opacity: .95; depthWrite: false"></a-sphere>
    <a-ring data-hotspot-ring radius-inner="${config.hotspots.ringRadius * 0.72}" radius-outer="${config.hotspots.ringRadius}"
      material="shader: flat; color: #f4bd50; transparent: true; opacity: .7; depthWrite: false; side: double"></a-ring>
    <a-text data-hotspot-debug-label value="${hotspot.number}" align="center" width=".0007" position="0 ${config.hotspots.ringRadius * 1.8} 0"
      color="#fff0b3" visible="${debug}"></a-text>
  </a-entity>`

export function page2SceneMarkup(inputConfig = PAGE2_CONFIG, debug = false) {
  const config = resolvePage2Config(inputConfig)
  const { width, height } = config.background
  const fire = config.fireEntryHotspot
  const hinge = config.background.hingePosition
  const rearY = config.markerAspect / 2
  const spatialLine = (id, depthUnit, color) => `<a-box id="${id}" visible="${debug}" width="1" height=".006" depth=".004"
    position="0 ${rearY - depthUnit} .004" material="shader: flat; color: ${color}; transparent: true; opacity: .86; depthWrite: false"></a-box>`
  return `
    <a-entity id="page2-target" mindar-image-target="targetIndex: ${config.targetIndex}">
      <a-plane id="page2-marker-plane" width="1" height="${config.markerAspect}" position="0 0 .003"
        material="transparent: true; opacity: 0; side: double"></a-plane>
    </a-entity>
    <a-entity id="page2-anchor" visible="false">
      <a-entity id="page2-floor-base" data-page2-floor-base visible="false"></a-entity>
      <a-entity id="page2-background-root" visible="false" position="${hinge.x} ${hinge.y} ${hinge.z}"
        rotation="${config.background.startRotationX} 0 0">
        <a-entity id="page2-board-center" position="0 ${height / 2} 0">
          <a-image id="page2-background-plane" data-page2-asset-key="background" width="${width}" height="${height}"
            material="shader: flat; transparent: true; alphaTest: .005; depthWrite: true; depthTest: true; side: double"></a-image>
          <a-plane id="page2-dark-overlay" width="${width}" height="${height}" position="0 0 .001"
            material="shader: flat; color: #120804; transparent: true; opacity: 0; depthWrite: false; side: double"></a-plane>
        </a-entity>
      </a-entity>
      <a-entity id="page2-overview-root" data-page2-overview-depth-root visible="false">
        <a-entity id="page2-title-root">${fullLayer('page2-title-asset', 'title', 'title')}</a-entity>
        <a-entity id="page2-intro-root">
          ${fullLayer('page2-intro-dragon-asset', 'intro-line', 'introDragon')}
          ${fullLayer('page2-intro-text-asset', 'intro-text', 'introText')}
          <a-entity id="page2-intro-dragon-glow">
            <a-circle data-page2-glow-soft radius="${config.intro.dragonGlowRadius}"
              material="shader: flat; color: #c84624; transparent: true; opacity: 0; depthWrite: false; side: double"></a-circle>
            <a-ring data-page2-glow-ring radius-inner="${config.intro.dragonGlowRadius * 0.64}" radius-outer="${config.intro.dragonGlowRadius * 0.72}"
              material="shader: flat; color: #ef8742; transparent: true; opacity: 0; depthWrite: false; side: double"></a-ring>
          </a-entity>
        </a-entity>
        <a-entity id="page2-map-root">
          ${fullLayer('page2-map-main-asset', 'map-main', 'mapMain')}
          ${fullLayer('page2-map-text-asset', 'map-text', 'mapText')}
          ${fullLayer('page2-map-tongliang-asset', 'map-tongliang', 'mapTongliang')}
          <a-entity id="page2-map-tongliang-glow">
            <a-circle data-page2-glow-soft radius="${config.map.tongliangGlowRadius}"
              material="shader: flat; color: #ff8a28; transparent: true; opacity: 0; depthWrite: false; side: double"></a-circle>
            <a-ring data-page2-glow-ring radius-inner="${config.map.tongliangGlowRadius * 0.52}" radius-outer="${config.map.tongliangGlowRadius * 0.72}"
              material="shader: flat; color: #ffd56a; transparent: true; opacity: 0; depthWrite: false; side: double"></a-ring>
          </a-entity>
        </a-entity>
        <a-entity id="page2-main-visual-root">
          ${fullLayer('page2-main-base-asset', 'main-base', 'mainBase')}
          <a-image id="page2-main-ring" data-page2-layer="main-ring" data-page2-asset-key="mainRing"
            width="${config.mainVisual.ringWidth}" height="${config.mainVisual.ringHeight}"
            material="shader: flat; transparent: true; alphaTest: .005; depthWrite: false"></a-image>
          ${fullLayer('page2-main-scene-asset', 'main-scene', 'mainScene')}
          ${fullLayer('page2-main-sparks-asset', 'main-sparks', 'mainSparks')}
          ${fullLayer('page2-main-performers-asset', 'main-performers', 'mainPerformers')}
          ${fullLayer('page2-main-dancers-asset', 'main-dancers', 'mainDancers')}
          ${fullLayer('page2-main-dragon-asset', 'main-dragon', 'mainDragon')}
          ${fullLayer('page2-main-pearl-asset', 'main-pearl', 'mainPearl')}
          <a-entity id="page2-main-pearl-glow">
            <a-circle data-page2-glow-soft radius="${config.mainVisual.pearlGlowRadius}"
              material="shader: flat; color: #ff7a20; transparent: true; opacity: 0; depthWrite: false; side: double"></a-circle>
            <a-ring data-page2-glow-ring radius-inner="${config.mainVisual.pearlGlowRadius * 0.46}" radius-outer="${config.mainVisual.pearlGlowRadius * 0.64}"
              material="shader: flat; color: #ffe37b; transparent: true; opacity: 0; depthWrite: false; side: double"></a-ring>
          </a-entity>
        </a-entity>
        <a-entity id="page2-types-root">
          ${fullLayer('page2-types-title-asset', 'types-title', 'typesTitle')}
          ${fullLayer('page2-types-back-asset', 'types-back', 'typesBack')}
          ${fullLayer('page2-types-mid-asset', 'types-mid', 'typesMid')}
          ${fullLayer('page2-types-front-asset', 'types-front', 'typesFront')}
        </a-entity>
        <a-entity id="page2-timeline-root">
          ${fullLayer('page2-timeline-base-asset', 'timeline-base', 'timelineBase')}
          ${fullLayer('page2-timeline-nodes-asset', 'timeline-nodes', 'timelineNodes')}
          ${fullLayer('page2-timeline-texts-asset', 'timeline-texts', 'timelineTexts')}
        </a-entity>
        <a-plane id="page2-fire-entry-hit" visible="false" width="${width * fire.width}" height="${height * fire.height}"
          material="shader: flat; transparent: true; opacity: .001; depthWrite: false; side: double"></a-plane>
        <a-entity id="page2-fire-entry-cue" visible="false">
          <a-ring data-page2-fire-cue-ring radius-inner="${Math.min(width * fire.width, height * fire.height) * 0.34}"
            radius-outer="${Math.min(width * fire.width, height * fire.height) * 0.37}"
            material="shader: flat; color: #ffb245; transparent: true; opacity: .72; depthWrite: false; side: double"></a-ring>
          <a-circle data-page2-fire-cue-dot radius=".012"
            material="shader: flat; color: #ffe39a; transparent: true; opacity: .92; depthWrite: false; side: double"></a-circle>
        </a-entity>
        <a-ring id="page2-entry-ripple" radius-inner=".02" radius-outer=".025" visible="false"
          material="shader: flat; color: #ff9d31; transparent: true; opacity: 0; depthWrite: false; side: double"></a-ring>
        <a-entity id="page2-debug-ring-center" visible="${debug}">
          <a-plane width=".08" height=".002" material="shader: flat; color: #42ff93; depthWrite: false"></a-plane>
          <a-plane width=".002" height=".08" material="shader: flat; color: #42ff93; depthWrite: false"></a-plane>
        </a-entity>
        <a-plane id="page2-debug-fire-hotspot" visible="${debug}" width="${width * fire.width}" height="${height * fire.height}"
          material="shader: flat; wireframe: true; color: #ff583d; transparent: true; opacity: .9; depthWrite: false"></a-plane>
        <a-entity id="page2-debug-tongliang-center" visible="${debug}">
          <a-plane width=".045" height=".0015" material="shader: flat; color: #ffdd55; depthWrite: false"></a-plane>
          <a-plane width=".0015" height=".045" material="shader: flat; color: #ffdd55; depthWrite: false"></a-plane>
        </a-entity>
        ${config.layers.map((layer) => `<a-text data-page2-debug-layer="${layer.key}" visible="${debug}" value="${layer.layerIndex + 1} ${layer.depthMm.toFixed(1)}mm" align="left" color="#63efff" width=".42"></a-text>`).join('')}
      </a-entity>
      <a-entity id="page2-spatial-debug" visible="${debug}">
        ${spatialLine('page2-debug-rear-edge', 0, '#ffde55')}
        ${spatialLine('page2-debug-back-safety', config.spatial.backSafetyUnit, '#5eff97')}
        ${spatialLine('page2-debug-front-limit', config.spatial.frontLimitUnit, '#ff8d4a')}
        ${spatialLine('page2-debug-card-front', config.spatial.cardDepthUnit, '#ff4d67')}
        ${spatialLine('page2-debug-card-center', config.model.centerDepthUnit, '#61a5ff')}
      </a-entity>
      <a-entity id="page2-model-root" data-page2-model-stage visible="false" position="0 0 0">
        <a-entity id="page2-particle-root"></a-entity>
        <a-entity id="page2-model-transform">
          <a-entity id="page2-model-content">
            <a-entity id="page2-fire-dragon-model"></a-entity>
            <a-entity id="page2-hotspot-root" visible="false">
              ${PAGE2_HOTSPOTS.map((hotspot) => hotspotMarkup(hotspot, config, debug)).join('')}
            </a-entity>
          </a-entity>
        </a-entity>
      </a-entity>
    </a-entity>`
}

export const page2UiMarkup = (config, debug = false) => `
  <section id="page2-loading-status" class="page2-loading-status" role="status" aria-live="polite">
    <span class="page2-loading-emblem" aria-hidden="true"></span>
    <div class="page2-loading-copy">
      <strong>《龙脉铜梁》</strong>
      <span>——铜梁火龙非遗AR互动体验设计</span>
      <small data-page2-loading-detail>正在准备核心图景</small>
    </div>
    <div class="page2-loading-track" aria-hidden="true"><i data-page2-loading-progress></i></div>
    <span data-page2-loading-count>${debug ? 'loaded 0｜decoded 0｜textures 0' : '0%'}</span>
  </section>
  <p class="page2-scan-guide" role="status">请缓慢平放识别图体验更佳</p>
  <section class="page2-ui" aria-label="龙脉探源 AR 界面">
    <header class="page2-title"><span>02</span><h1>龙脉探源</h1></header>
    <section class="page2-guide page2-glass-card" role="status" hidden>
      <strong>识别成功｜龙脉探源</strong><p>请抬起手机，与识别图保持垂直</p>
    </section>
    <p class="page2-overview-hint" role="status" hidden>点击进入火龙探索</p>
    <nav class="page2-model-controls" hidden>
      <button type="button" data-page2-action="overview">返回总览</button>
      <button type="button" data-page2-action="reset">复位</button>
    </nav>
    <p class="page2-model-hint" role="status" hidden>单指拖动旋转｜双指缩放｜点击光点查看结构</p>
    <article class="page2-info-card page2-glass-card" hidden>
      <button type="button" class="page2-info-close" data-page2-action="close-card" aria-label="关闭">×</button>
      <small data-page2-card-category></small><h2 data-page2-card-title></h2>
      <p data-page2-card-description></p><div data-page2-card-keywords></div>
    </article>
    <button type="button" class="page2-complete-button" data-page2-action="complete" disabled hidden>
      完成探索 <small data-page2-viewed-count>0 / 5</small>
    </button>
    <section class="page2-complete-card page2-glass-card" role="dialog" hidden>
      <strong>火龙结构探索完成</strong>
      <p>你已了解铜梁火龙的龙头、龙身、连接、持杆与龙尾等关键结构。</p>
      <small>请扫描第三张识别图，进入火舞盛景</small>
    </section>
    <p class="page2-tracking-lost page2-glass-card" role="status" hidden>请重新对准第二页识别图</p>
    <p class="page2-error page2-glass-card" role="alert" hidden></p>
  </section>
  ${debug ? `<aside class="page2-debug-panel" aria-label="第二页调试面板">
    <strong>Page 2 Debug</strong>
    <p>状态 <b data-page2-debug-state>${PAGE2_STATES.HIDDEN}</b></p>
    <p>targetIndex <b>${config.targetIndex}</b>｜FPS <b data-page2-debug-fps>0</b></p>
    <p>MindAR warmup <b>${config.mindar.warmupTolerance}</b>｜miss <b>${config.mindar.missTolerance}</b></p>
    <p>filterMinCF <b>${config.mindar.filterMinCF}</b>｜beta <b>${config.mindar.filterBeta}</b></p>
    <p>all settled <b data-page2-debug-assets>false</b>｜background <b data-page2-debug-background>false</b></p>
    <p>critical assets <b data-page2-debug-critical>false</b>｜tracking stable <b data-page2-debug-stable>false</b></p>
    <p>entrance <b data-page2-debug-entrance>false</b>｜progress <b data-page2-debug-progress>0%</b></p>
    <p>overview ready <b data-page2-debug-overview>false</b>｜visible layers <b data-page2-debug-visible>0</b></p>
    <p>model loaded <b data-page2-debug-model>false</b>｜failed assets <b data-page2-debug-failed>0</b></p>
    <p>scan session <b data-page2-debug-session>0</b>｜run <b data-page2-debug-run>0</b></p>
    <p>target visible <b data-page2-debug-target>false</b>｜lost <b data-page2-debug-lost>0 ms</b></p>
    <p>replay armed <b data-page2-debug-replay>true</b>｜resources <b data-page2-debug-resources>false</b></p>
    <p>floor <b data-page2-debug-floor>${config.floorBase.widthUnit.toFixed(3)} × ${config.floorBase.depthUnit.toFixed(3)}</b>｜clearance <b>${config.floorBase.clearanceMm}mm</b></p>
    <p>floor world <b data-page2-debug-floor-world>—</b></p>
    <p>floor axes <b data-page2-debug-floor-axes>—</b></p>
    <p>background angle <b data-page2-debug-board-angle>${config.background.startRotationX}°</b></p>
    <p>depth direction <b data-page2-debug-depth>?</b></p>
    <label>圆环 X <input data-page2-debug="ring-x" type="number" step=".001" value="${config.mainVisual.ringCenterX}"></label>
    <label>圆环 Y <input data-page2-debug="ring-y" type="number" step=".001" value="${config.mainVisual.ringCenterY}"></label>
    <label>火龙 X <input data-page2-debug="fire-x" type="number" step=".001" value="${config.fireEntryHotspot.x}"></label>
    <label>火龙 Y <input data-page2-debug="fire-y" type="number" step=".001" value="${config.fireEntryHotspot.y}"></label>
    <label>火龙 W <input data-page2-debug="fire-w" type="number" step=".001" value="${config.fireEntryHotspot.width}"></label>
    <label>火龙 H <input data-page2-debug="fire-h" type="number" step=".001" value="${config.fireEntryHotspot.height}"></label>
    <label>铜梁偏移 X <input data-page2-debug="tongliang-x" type="number" step=".001" value="${config.map.tongliangOffsetX}"></label>
    <label>铜梁偏移 Y <input data-page2-debug="tongliang-y" type="number" step=".001" value="${config.map.tongliangOffsetY}"></label>
    <select data-page2-debug="hotspot-id">${PAGE2_HOTSPOTS.map((item) => `<option value="${item.id}">${item.number} ${item.title}</option>`).join('')}</select>
    <div class="page2-debug-xyz">${['x', 'y', 'z'].map((axis) => `<label>${axis.toUpperCase()} <input data-page2-hotspot-axis="${axis}" type="number" step=".00001"></label>`).join('')}</div>
    <button type="button" data-page2-debug-action="print">输出当前配置</button>
    <button type="button" data-page2-debug-action="simulate">模拟识别</button>
    <button type="button" data-page2-debug-action="jitter">短暂丢失测试</button>
    <button type="button" data-page2-debug-action="model">模型测试</button>
    <p>Lite <b data-page2-debug-lite>false</b>｜原因 <b data-page2-debug-lite-reason>—</b></p>
    <pre data-page2-debug-timings></pre>
    <pre data-page2-debug-output></pre>
  </aside>` : ''}
`

function registerRuntimeComponent() {
  if (window.AFRAME.components['page2-runtime']) return
  window.AFRAME.registerComponent('page2-runtime', {
    tick(time, delta) {
      this.el.__page2RuntimeTick?.(time, Math.min(delta || 0, 50))
    },
  })
}

const setVisible = (entity, visible) => {
  if (!entity?.object3D) return
  entity.object3D.visible = visible
  entity.setAttribute('visible', visible)
}

export function createPage2Experience({ root, scene, target, anchor, config, debug, preloader = null, onActivate }) {
  const THREE = window.AFRAME.THREE
  scene.renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.performance.maxPixelRatio))
  const abortController = new AbortController()
  const { signal } = abortController
  const backgroundRoot = root.querySelector('#page2-background-root')
  const backgroundPlane = root.querySelector('#page2-background-plane')
  const darkOverlay = root.querySelector('#page2-dark-overlay')
  const fireHit = root.querySelector('#page2-fire-entry-hit')
  const ripple = root.querySelector('#page2-entry-ripple')
  const guide = root.querySelector('.page2-guide')
  const guideTitle = guide.querySelector('strong')
  const guideText = guide.querySelector('p')
  const overviewHint = root.querySelector('.page2-overview-hint')
  const modelControls = root.querySelector('.page2-model-controls')
  const modelHint = root.querySelector('.page2-model-hint')
  const infoCard = root.querySelector('.page2-info-card')
  const completeButton = root.querySelector('.page2-complete-button')
  const completeCard = root.querySelector('.page2-complete-card')
  const lostNotice = root.querySelector('.page2-tracking-lost')
  const errorNotice = root.querySelector('.page2-error')
  const progress = createPage2Progress(config.progress)
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let state = PAGE2_STATES.HIDDEN
  let resumeState = PAGE2_STATES.HIDDEN
  let stateBeforeSuspension = PAGE2_STATES.HIDDEN
  let tracked = false
  let suspended = false
  let stableElapsed = 0
  let backgroundElapsed = 0
  let darkOpacity = 0
  let rippleElapsed = -1
  let selectedCardId = null
  let lifecycle
  let fpsElapsed = 0
  let fpsFrames = 0
  let fps = 0
  let page2EntranceProgress = 0
  let page2ModelLoaded = false
  let entranceTimelineActive = false
  let backgroundTimelineStarted = false
  let entranceFramePending = false
  let entranceAnimationFinished = false
  let visibilityRetryElapsed = 0
  let visibilityFailureLogged = false
  let depthDirection = -1
  let destroyed = false
  let assetLoadingPromise = null
  let bindingFrame = 0
  let replayGuideTimer = 0
  let modelIdleHandle = 0
  let modelFallbackTimer = 0
  let performanceSampleElapsed = 0
  let performanceSampleFrames = 0
  const bindingQueue = []
  const bindingPromises = new Map()
  const assetStatus = new Map(assetEntries.map(([, key]) => [key, 'deferred']))
  const pendingAnimationFrames = new Set()
  const page2Runtime = {
    layerElements: [],
    layerById: new Map(),
    layerReady: new Map(),
    backgroundReady: false,
    criticalAssetsReady: false,
    allAssetsSettled: false,
    resourcesLoaded: false,
    targetVisible: false,
    lostStartedAt: 0,
    replayArmed: true,
    scanSessionId: 0,
    entranceRunId: 0,
    trackingStable: false,
    entranceRequested: false,
    entranceStarted: false,
    entranceCompleted: false,
    visibleLayerCount: 0,
    cameraStarted: false,
    liteMode: false,
    liteReason: '',
    failedAssets: new Map(),
  }

  const preloadSession = preloader || startPage2CriticalPreload({ root, config, debug })

  const debugLog = (event, detail = '') => {
    if (debug) console.info(`[page2] ${event}`, detail)
  }

  const markTiming = (name, detail = null, at = performance.now()) => {
    const added = preloadSession.markTiming?.(name, detail, at)
    if (debug && added) renderDebugOutput()
    return added
  }

  const enterLiteMode = (reason) => {
    if (page2Runtime.liteMode) return false
    page2Runtime.liteMode = true
    page2Runtime.liteReason = reason
    debugLog('PAGE2_LITE', { reason })
    updateReadinessDebug()
    return true
  }

  const updateStateUi = () => {
    root.querySelector('[data-page2-debug-state]')?.replaceChildren(state)
  }
  const setState = (next) => {
    if (state === next) return
    state = next
    debugLog('page2State', next)
    updateStateUi()
  }
  const setHtmlVisible = (element, visible) => {
    if (element) element.hidden = !visible
  }
  const setDarkness = (opacity) => {
    darkOpacity = clamp(opacity)
    darkOverlay.setAttribute('material', 'opacity', darkOpacity * (1 - config.background.modelBrightness))
  }
  const enableModelUi = (enabled) => {
    setHtmlVisible(modelControls, enabled)
    setHtmlVisible(modelHint, enabled)
    setHtmlVisible(completeButton, enabled)
  }
  const closeCard = () => {
    selectedCardId = null
    setHtmlVisible(infoCard, false)
    model.closeSelection()
  }
  const updateCompleteButton = () => {
    const count = progress.getCount()
    completeButton.disabled = count < config.hotspots.minimumViewed
    root.querySelector('[data-page2-viewed-count]').textContent = `${count} / ${PAGE2_HOTSPOTS.length}`
  }

  const showError = (message) => {
    console.error(`[page2] ${message}`)
    errorNotice.textContent = message
    setHtmlVisible(errorNotice, true)
  }

  let particleSystem = null
  const ensureParticles = () => {
    if (!particleSystem) particleSystem = createPage2Particles({ root, config })
    return particleSystem
  }
  const particles = {
    startBurst: () => ensureParticles().startBurst(),
    settle: () => particleSystem?.settle(),
    smallBurst: () => ensureParticles().smallBurst(),
    hide: () => particleSystem?.hide(),
    update: (delta) => particleSystem?.update(delta),
    destroy: () => { particleSystem?.destroy(); particleSystem = null },
  }
  const floorBase = createPage2Floor({ root, config, debug })
  let overview
  const model = createPage2Model({
    root,
    scene,
    anchor,
    backgroundPlane,
    config,
    hotspots: PAGE2_HOTSPOTS,
    debug,
    isInteractive: () => tracked && !suspended && [PAGE2_STATES.MODEL, PAGE2_STATES.COMPLETE].includes(state),
    isCardOpen: () => !infoCard.hidden,
    onReady() {
      page2ModelLoaded = true
      debugLog('page2ModelLoaded', true)
      updateReadinessDebug()
      renderDebugOutput()
    },
    onEntranceComplete() {
      particles.settle()
      setState(PAGE2_STATES.MODEL)
      enableModelUi(true)
      updateCompleteButton()
    },
    onHotspotSelected(id, point) {
      const hotspot = PAGE2_HOTSPOTS.find((item) => item.id === id)
      if (!hotspot) return
      selectedCardId = id
      const count = progress.markViewed(id)
      model.markViewed(id)
      infoCard.querySelector('[data-page2-card-category]').textContent = hotspot.category
      infoCard.querySelector('[data-page2-card-title]').textContent = hotspot.title
      infoCard.querySelector('[data-page2-card-description]').textContent = hotspot.description
      infoCard.querySelector('[data-page2-card-keywords]').innerHTML = hotspot.keywords.map((word) => `<span>${word}</span>`).join('')
      infoCard.classList.toggle('is-left', point?.x > window.innerWidth / 2)
      setHtmlVisible(infoCard, true)
      updateCompleteButton()
      if (count >= config.hotspots.minimumViewed) completeButton.classList.add('is-ready')
    },
    onBlankSelected: closeCard,
    onLoadError: showError,
    onDebugChanged(data) {
      if (selectedCardId && data.selectedScreenPoint) {
        infoCard.style.setProperty('--hotspot-screen-y', `${data.selectedScreenPoint.y}px`)
      }
      if (debug && data.hotspots) renderDebugOutput()
    },
  })

  overview = createPage2Overview({
    root,
    config,
    isLiteMode: () => page2Runtime.liteMode,
    onModulePrepare(moduleName, scheduledAtMs) {
      loadModuleAssets(moduleName)
      debugLog('page2OverviewModulePrepare', { moduleName, scheduledAtMs, runId: page2Runtime.entranceRunId })
    },
    onModuleEnter(moduleName, scheduledAtMs) {
      loadModuleAssets(moduleName)
      debugLog('page2OverviewModuleEnter', { moduleName, scheduledAtMs, runId: page2Runtime.entranceRunId })
    },
    onModuleVisible(moduleName, layerKey, sequenceElapsedMs) {
      const timingName = moduleName === 'initial' ? 'mainVisible' : `${moduleName}Visible`
      markTiming(timingName, { layerKey, sequenceElapsedMs })
      if (moduleName === 'initial') {
        setHtmlVisible(guide, false)
        preloadSession.hideLoading?.()
      }
      updateReadinessDebug()
    },
    onEntryComplete() {
      page2EntranceProgress = 1
      entranceTimelineActive = false
      entranceAnimationFinished = true
      finalizeOverviewIfVisible()
    },
    onExitComplete() {
      setState(PAGE2_STATES.MODEL_ENTERING)
      particles.startBurst()
      model.startEntrance()
    },
    onRestoreComplete() {
      setState(PAGE2_STATES.OVERVIEW)
      setHtmlVisible(overviewHint, true)
      renderDebugOutput()
    },
  })

  page2Runtime.layerElements = overview.getLayerElements()
  page2Runtime.layerById = overview.getLayerById()
  page2Runtime.layerElements.forEach((element) => {
    if (element.dataset.page2Layer) page2Runtime.layerReady.set(element.dataset.page2Layer, false)
  })

  PAGE2_HOTSPOTS.forEach((hotspot) => {
    if (progress.isViewed(hotspot.id)) model.markViewed(hotspot.id)
  })
  updateCompleteButton()

  const stable = createStableAnchorController({
    target,
    anchor,
    config: config.trackingSmoothing,
    externalTick: true,
  })

  const updateReadinessDebug = () => {
    root.querySelector('[data-page2-debug-assets]')?.replaceChildren(String(page2Runtime.allAssetsSettled))
    root.querySelector('[data-page2-debug-background]')?.replaceChildren(String(page2Runtime.backgroundReady))
    root.querySelector('[data-page2-debug-critical]')?.replaceChildren(String(page2Runtime.criticalAssetsReady))
    root.querySelector('[data-page2-debug-stable]')?.replaceChildren(String(page2Runtime.trackingStable))
    root.querySelector('[data-page2-debug-entrance]')?.replaceChildren(String(page2Runtime.entranceStarted))
    root.querySelector('[data-page2-debug-progress]')?.replaceChildren(`${Math.round(page2EntranceProgress * 100)}%`)
    root.querySelector('[data-page2-debug-overview]')?.replaceChildren(String(page2Runtime.entranceCompleted))
    root.querySelector('[data-page2-debug-visible]')?.replaceChildren(String(page2Runtime.visibleLayerCount))
    root.querySelector('[data-page2-debug-model]')?.replaceChildren(String(page2ModelLoaded))
    root.querySelector('[data-page2-debug-failed]')?.replaceChildren(String(page2Runtime.failedAssets.size))
    root.querySelector('[data-page2-debug-session]')?.replaceChildren(String(page2Runtime.scanSessionId))
    root.querySelector('[data-page2-debug-run]')?.replaceChildren(String(page2Runtime.entranceRunId))
    root.querySelector('[data-page2-debug-target]')?.replaceChildren(String(page2Runtime.targetVisible))
    const lostDuration = page2Runtime.lostStartedAt ? performance.now() - page2Runtime.lostStartedAt : 0
    root.querySelector('[data-page2-debug-lost]')?.replaceChildren(`${Math.round(lostDuration)} ms`)
    root.querySelector('[data-page2-debug-replay]')?.replaceChildren(String(page2Runtime.replayArmed))
    root.querySelector('[data-page2-debug-resources]')?.replaceChildren(String(page2Runtime.resourcesLoaded))
    root.querySelector('[data-page2-debug-lite]')?.replaceChildren(String(page2Runtime.liteMode))
    root.querySelector('[data-page2-debug-lite-reason]')?.replaceChildren(page2Runtime.liteReason || '—')
    const timingOutput = root.querySelector('[data-page2-debug-timings]')
    if (timingOutput) timingOutput.textContent = JSON.stringify(preloadSession.getTimingReport?.() || {}, null, 2)
    const floorDebug = floorBase.getDebugState()
    root.querySelector('[data-page2-debug-floor-world]')?.replaceChildren(floorDebug.worldPosition.map((value) => value.toFixed(3)).join(', '))
    root.querySelector('[data-page2-debug-floor-axes]')?.replaceChildren('X / Y / +Z')
    root.querySelector('[data-page2-debug-board-angle]')?.replaceChildren(`${THREE.MathUtils.radToDeg(backgroundRoot.object3D.rotation.x).toFixed(1)}°`)
    root.querySelector('[data-page2-debug-depth]')?.replaceChildren('card front (-Y), up (+Z)')
  }

  const detectDepthDirection = () => {
    depthDirection = -1
    overview.setDepthDirection(depthDirection)
    model.setDepthDirection(depthDirection)
    updateReadinessDebug()
  }

  const afterTwoAnimationFrames = (callback, runId = null) => {
    const first = requestAnimationFrame(() => {
      pendingAnimationFrames.delete(first)
      const second = requestAnimationFrame(() => {
        pendingAnimationFrames.delete(second)
        if (runId !== null && runId !== page2Runtime.entranceRunId) return
        callback()
      })
      pendingAnimationFrames.add(second)
    })
    pendingAnimationFrames.add(first)
  }

  const waitTwoAnimationFrames = () => new Promise((resolve) => afterTwoAnimationFrames(resolve))

  const resetPage2EntranceVisualState = () => {
    page2Runtime.entranceRunId += 1
    page2Runtime.entranceStarted = false
    page2Runtime.entranceCompleted = false
    page2Runtime.trackingStable = false
    page2EntranceProgress = 0
    backgroundElapsed = 0
    stableElapsed = 0
    entranceAnimationFinished = false
    entranceTimelineActive = false
    backgroundTimelineStarted = false
    entranceFramePending = false
    visibilityRetryElapsed = 0
    overview.resetEntry()
    floorBase.reset(page2Runtime.entranceRunId)
    backgroundRoot.object3D.rotation.x = THREE.MathUtils.degToRad(
      finiteOr(config.background.startRotationX, 0, 'background.startRotationX'),
    )
    setVisible(backgroundRoot, false)
    model.hide()
    particles.hide()
    setDarkness(0)
    closeCard()
    enableModelUi(false)
    setHtmlVisible(completeCard, false)
    setHtmlVisible(overviewHint, false)
    setHtmlVisible(guide, true)
    guideTitle.textContent = page2Runtime.scanSessionId > 1 ? '再次识别｜龙脉探源' : '识别成功｜龙脉探源'
    guideText.textContent = preloadSession.getSnapshot().criticalReady
      ? '请抬起手机，与识别图保持垂直'
      : '识别成功，正在展开龙脉图景'
    window.clearTimeout(replayGuideTimer)
    debugLog('page2EntranceReset', { scanSessionId: page2Runtime.scanSessionId, runId: page2Runtime.entranceRunId })
    updateReadinessDebug()
  }

  const cancelScheduledModelPreload = () => {
    if (modelIdleHandle && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(modelIdleHandle)
    if (modelFallbackTimer) window.clearTimeout(modelFallbackTimer)
    modelIdleHandle = 0
    modelFallbackTimer = 0
  }

  const scheduleModelPreload = () => {
    if (page2Runtime.liteMode || page2ModelLoaded || model.isLoaded()) return
    cancelScheduledModelPreload()
    const load = () => {
      modelIdleHandle = 0
      modelFallbackTimer = 0
      if (!destroyed && !page2Runtime.liteMode && page2Runtime.entranceCompleted) model.preload()
    }
    if (typeof window.requestIdleCallback === 'function') {
      modelIdleHandle = window.requestIdleCallback(load, { timeout: config.performance.modelIdleTimeoutMs })
    } else {
      modelFallbackTimer = window.setTimeout(load, config.performance.modelIdleTimeoutMs)
    }
  }

  const finalizeOverviewIfVisible = () => {
    if (!entranceAnimationFinished || page2Runtime.entranceCompleted || !tracked || suspended) return false
    overview.ensureReadyLayersVisible()
    const visibility = overview.validateVisibility()
    page2Runtime.visibleLayerCount = visibility.visibleLayerCount
    const backgroundImage = root.querySelector('#page2-background-asset')
    let backgroundMeshVisible = false
    backgroundPlane.object3D.traverse((child) => {
      if (backgroundMeshVisible || !child.isMesh || child.visible === false) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      backgroundMeshVisible = materials.some((material) => material?.visible !== false
        && Number.isFinite(material?.opacity)
        && material.opacity > 0.05
        && material.map?.image === backgroundImage)
    })
    const backgroundVisible = page2Runtime.backgroundReady
      && backgroundRoot.object3D.visible !== false
      && backgroundPlane.object3D.visible !== false
      && backgroundMeshVisible
      && backgroundImage?.complete === true
      && backgroundImage.naturalWidth > 0
    const overviewVisible = root.querySelector('#page2-overview-root')?.object3D?.visible !== false
    const visibleIds = new Set(visibility.visibleLayerIds)
    const visibleTimingGroups = {
      mainVisible: ['main-base', 'main-ring', 'main-scene', 'main-sparks', 'main-performers', 'main-dancers', 'main-dragon', 'main-pearl'],
      introVisible: ['intro-line', 'intro-text'],
      mapVisible: ['map-main', 'map-text', 'map-tongliang'],
      typesVisible: ['types-title', 'types-back', 'types-mid', 'types-front'],
      timelineVisible: ['timeline-base', 'timeline-nodes', 'timeline-texts'],
    }
    Object.entries(visibleTimingGroups).forEach(([timingName, keys]) => {
      if (keys.some((key) => visibleIds.has(key))) markTiming(timingName, { verifiedAtCompletion: true })
    })
    const culturalModules = [
      ['intro-line', 'intro-text'],
      ['map-main', 'map-text', 'map-tongliang'],
      ['types-title', 'types-back', 'types-mid', 'types-front'],
      ['timeline-base', 'timeline-nodes', 'timeline-texts'],
    ].filter((keys) => keys.some((key) => visibleIds.has(key))).length
    const fire = config.fireEntryHotspot
    const hotspotValid = [fire.x, fire.y, fire.width, fire.height].every(Number.isFinite)
      && fire.x >= 0 && fire.x <= 1 && fire.y >= 0 && fire.y <= 1
      && fire.width > 0 && fire.height > 0
    const isValid = backgroundVisible
      && overviewVisible
      && tracked
      && state === PAGE2_STATES.OVERVIEW_ENTERING
      && visibleIds.has('main-dragon')
      && culturalModules >= 3
      && hotspotValid
      && visibility.strongLayerCount > 0

    if (!isValid) {
      setHtmlVisible(overviewHint, false)
      setHtmlVisible(guide, true)
      guideText.textContent = '正在加载可视化内容'
      if (!visibilityFailureLogged) {
        visibilityFailureLogged = true
        debugLog('page2VisibilityPending', { backgroundVisible, overviewVisible, culturalModules, hotspotValid, ...visibility })
      }
      if (page2Runtime.allAssetsSettled && page2Runtime.failedAssets.size > 0 && visibility.visibleMainCount === 0) {
        showError('部分可视化资源加载失败，请重新扫描')
      }
      updateReadinessDebug()
      renderDebugOutput()
      return false
    }

    page2Runtime.entranceCompleted = true
    floorBase.showFinal()
    visibilityFailureLogged = false
    overview.completeEntrance()
    setState(PAGE2_STATES.OVERVIEW)
    setHtmlVisible(guide, false)
    setHtmlVisible(overviewHint, true)
    preloadSession.hideLoading?.()
    markTiming('overviewCompleted', { visibleLayerCount: visibility.visibleLayerCount, culturalModules })
    scheduleModelPreload()
    debugLog('page2EntranceCompleted', { visibleLayerCount: visibility.visibleLayerCount, culturalModules })
    updateReadinessDebug()
    renderDebugOutput()
    return true
  }

  const maybeStartBackgroundTimeline = () => {
    if (!page2Runtime.entranceStarted) return
    const currentRunId = page2Runtime.entranceRunId
    if (!entranceTimelineActive) {
      overview.startEntry()
      entranceTimelineActive = true
      entranceAnimationFinished = false
      debugLog('page2OverviewTimelineStarted', { runId: currentRunId })
    }
    if (page2Runtime.backgroundReady && !backgroundTimelineStarted) {
      setVisible(backgroundRoot, true)
      backgroundRoot.object3D.rotation.x = THREE.MathUtils.degToRad(
        finiteOr(config.background.startRotationX, 0, 'background.startRotationX'),
      )
      backgroundElapsed = 0
      backgroundTimelineStarted = true
      markTiming('backgroundVisible', { runId: currentRunId })
      debugLog('page2BackgroundEntranceStarted', { runId: currentRunId })
    }
  }

  const maybeStartPage2Entrance = () => {
    debugLog('page2EntranceRequested', {
      backgroundReady: page2Runtime.backgroundReady,
      trackingStable: page2Runtime.trackingStable,
    })
    if (destroyed || !tracked || suspended || !page2Runtime.entranceRequested) return
    if (!page2Runtime.trackingStable) return
    if (page2Runtime.entranceStarted || page2Runtime.entranceCompleted || entranceFramePending) return
    const currentRunId = page2Runtime.entranceRunId
    entranceFramePending = true
    page2EntranceProgress = 0
    backgroundElapsed = 0
    floorBase.start(currentRunId)
    guideText.textContent = preloadSession.getSnapshot().criticalReady
      ? '请抬起手机，与识别图保持垂直'
      : '识别成功，正在展开龙脉图景'
    setState(PAGE2_STATES.OVERVIEW_ENTERING)
    updateReadinessDebug()
    afterTwoAnimationFrames(() => {
      entranceFramePending = false
      if (destroyed || !tracked || suspended) {
        updateReadinessDebug()
        return
      }
      page2Runtime.entranceStarted = true
      detectDepthDirection()
      maybeStartBackgroundTimeline()
      debugLog('page2EntranceStarted', { runId: currentRunId, backgroundReady: page2Runtime.backgroundReady })
      updateReadinessDebug()
    }, currentRunId)
  }

  const isSettled = (key) => ['loaded', 'failed'].includes(assetStatus.get(key))
  const isLoaded = (key) => assetStatus.get(key) === 'loaded'

  const markLayerReady = (assetKey) => {
    page2Runtime.layerElements.forEach((element) => {
      if (element.dataset.page2AssetKey !== assetKey) return
      const layerId = element.dataset.page2Layer
      if (!layerId || page2Runtime.layerReady.get(layerId) === true) return
      page2Runtime.layerReady.set(layerId, true)
    })
  }

  const updateAssetReadiness = () => {
    const previousCritical = page2Runtime.criticalAssetsReady
    const previousSettled = page2Runtime.allAssetsSettled
    const preloadSnapshot = preloadSession.getSnapshot()
    page2Runtime.resourcesLoaded = preloadSnapshot.resourcesLoaded
    page2Runtime.backgroundReady = isLoaded('background')
    page2Runtime.criticalAssetsReady = preloadSnapshot.criticalReady
    page2Runtime.allAssetsSettled = preloadSnapshot.settledCount === preloadSnapshot.totalCount

    if (!previousCritical && page2Runtime.criticalAssetsReady) debugLog('criticalAssetsReady', true)
    if (!previousSettled && page2Runtime.allAssetsSettled) debugLog('page2AllAssetsSettled', true)
    updateReadinessDebug()
    renderDebugOutput()
    maybeStartPage2Entrance()
    maybeStartBackgroundTimeline()
    if (entranceAnimationFinished) finalizeOverviewIfVisible()
  }

  const bindReadyImage = async (id, key, imageElement) => {
    const entitiesForAsset = [...root.querySelectorAll(`[data-page2-asset-key="${key}"]`)]
    if (key !== 'background' && entitiesForAsset.length === 0) {
      throw new Error(`[page2] No real layer entity for asset: ${key}`)
    }
    entitiesForAsset.forEach((entity) => {
      const visibleWhileBinding = key === 'background'
      entity.setAttribute('visible', visibleWhileBinding)
      entity.object3D.visible = visibleWhileBinding
      entity.setAttribute('material', 'opacity', key === 'background' ? 1 : 0)
      entity.setAttribute('src', `#${id}`)
    })
    const textures = new Set()
    for (let attempt = 0; attempt < 6 && textures.size === 0; attempt += 1) {
      await waitTwoAnimationFrames()
      entitiesForAsset.forEach((entity) => entity.object3D.traverse((object) => {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.filter(Boolean).forEach((material) => {
          if (material.map) textures.add(material.map)
        })
      }))
    }
    if (!imageElement.complete || imageElement.naturalWidth <= 0 || imageElement.naturalHeight <= 0) {
      throw new Error(`[page2] Image became incomplete before texture binding: ${config.assets[key]}`)
    }
    if (textures.size === 0) {
      throw new Error(`[page2] Three.js texture was not created for asset: ${config.assets[key]}`)
    }
    const uploadStartedAt = performance.now()
    textures.forEach((texture) => {
      try {
        if (typeof scene.renderer?.initTexture === 'function') scene.renderer.initTexture(texture)
        else texture.needsUpdate = true
      } catch (error) {
        texture.needsUpdate = true
        debugLog('page2TextureWarmupFallback', { key, error: error?.message || String(error) })
      }
    })
    const uploadMs = performance.now() - uploadStartedAt
    preloadSession.markCriticalTextureReady?.(key, uploadMs)
    overview.markAssetReady(key)
    markLayerReady(key)
    debugLog('page2TextureReady', { key, textureCount: textures.size, uploadMs: Number(uploadMs.toFixed(2)) })
  }

  const scheduleBindingDrain = () => {
    if (bindingFrame || destroyed || bindingQueue.length === 0) return
    bindingFrame = requestAnimationFrame(async () => {
      pendingAnimationFrames.delete(bindingFrame)
      bindingFrame = 0
      const jobs = bindingQueue.splice(0, config.performance.maxTextureUploadsPerFrame)
      await Promise.allSettled(jobs.map(async ({ task, resolve, reject }) => {
        try { resolve(await task()) } catch (error) { reject(error) }
      }))
      scheduleBindingDrain()
    })
    pendingAnimationFrames.add(bindingFrame)
  }

  const enqueueBinding = (task) => new Promise((resolve, reject) => {
    bindingQueue.push({ task, resolve, reject })
    scheduleBindingDrain()
  })

  const loadAsset = (key) => {
    if (isLoaded(key)) return { key, status: 'already-loaded' }
    if (bindingPromises.has(key)) return bindingPromises.get(key)
    const id = assetEntryByKey.get(key)
    const url = config.assets[key]
    assetStatus.set(key, 'loading')
    const promise = preloadSession.preloadImage(key).then((readyImage) => enqueueBinding(async () => {
      debugLog('layerLoaded', { layerId: key, fileName: url.split('/').pop(), url: readyImage.currentSrc || readyImage.src })
      debugLog('layerDecoded', { layerId: key, fileName: url.split('/').pop(), url: readyImage.currentSrc || readyImage.src })
      await bindReadyImage(id, key, readyImage)
      assetStatus.set(key, 'loaded')
      if (key === 'background') debugLog('page2BackgroundReady', { decoded: true, path: url })
      updateAssetReadiness()
      return { key, status: 'loaded', url }
    })).catch((error) => {
      assetStatus.set(key, 'failed')
      page2Runtime.failedAssets.set(key, { url, error: error?.message || String(error) })
      console.error('[page2] Asset failed', { layerId: key, fileName: url?.split('/').pop(), url, error })
      if (tracked) {
        errorNotice.textContent = '部分可视化资源加载失败，请重新扫描'
        setHtmlVisible(errorNotice, true)
      }
      updateAssetReadiness()
      throw error
    })
    bindingPromises.set(key, promise)
    return promise
  }

  const moduleAssetKeys = Object.freeze({
    initial: ['title', 'mainBase', 'mainRing', 'mainScene', 'mainSparks', 'mainPerformers', 'mainDancers', 'mainDragon', 'mainPearl'],
    intro: ['introDragon', 'introText'],
    map: ['mapMain', 'mapText', 'mapTongliang'],
    types: ['typesTitle', 'typesBack', 'typesMid', 'typesFront'],
    timeline: ['timelineBase', 'timelineNodes', 'timelineTexts'],
  })

  const loadModuleAssets = (moduleName) => {
    const keys = moduleAssetKeys[moduleName] || []
    return Promise.allSettled(keys.map((key) => loadAsset(key)))
  }

  const startAssetLoading = () => {
    if (assetLoadingPromise || destroyed) return assetLoadingPromise
    assetLoadingPromise = (async () => {
      const results = await Promise.allSettled([
        loadAsset('background'),
        ...moduleAssetKeys.initial.map((key) => loadAsset(key)),
      ])
      updateAssetReadiness()
      return results
    })()
    updateAssetReadiness()
    return assetLoadingPromise
  }

  const unsubscribePreload = preloadSession.subscribe((snapshot) => {
    page2Runtime.resourcesLoaded = snapshot.resourcesLoaded
    page2Runtime.allAssetsSettled = snapshot.settledCount === snapshot.totalCount
    page2Runtime.criticalAssetsReady = snapshot.criticalReady
    if (snapshot.maxTextureUploadMs >= config.performance.slowTextureUploadMs) {
      enterLiteMode(`texture-upload-${snapshot.maxTextureUploadMs.toFixed(1)}ms`)
    } else if (!snapshot.criticalReady && snapshot.elapsedMs >= config.performance.criticalTextureTimeoutMs) {
      enterLiteMode(`critical-timeout-${Math.round(snapshot.elapsedMs)}ms`)
    }
    updateReadinessDebug()
  })

  const activate = ({ replay = page2Runtime.replayArmed } = {}) => {
    const lostDuration = page2Runtime.lostStartedAt ? performance.now() - page2Runtime.lostStartedAt : 0
    debugLog('targetFound', {
      replay,
      lostDuration,
      at: Math.round(performance.now()),
      nextSession: replay ? page2Runtime.scanSessionId + 1 : page2Runtime.scanSessionId,
    })
    markTiming('targetFound', { replay, lostDuration })
    suspended = false
    tracked = true
    page2Runtime.targetVisible = true
    page2Runtime.lostStartedAt = 0
    page2Runtime.entranceRequested = true
    root.querySelector('.page1-ar')?.classList.add('is-page2-active')
    onActivate?.()
    stable.setTracked(true)
    startAssetLoading()
    if (!preloadSession.getSnapshot().criticalReady) {
      preloadSession.setPhaseMessage?.('识别成功，正在展开龙脉图景')
    }
    setHtmlVisible(lostNotice, false)
    if (!replay && resumeState !== PAGE2_STATES.HIDDEN) {
      setState(resumeState)
      setHtmlVisible(guide, state === PAGE2_STATES.GUIDE)
      setHtmlVisible(overviewHint, state === PAGE2_STATES.OVERVIEW)
      if ([PAGE2_STATES.MODEL, PAGE2_STATES.COMPLETE].includes(state)) enableModelUi(true)
      setHtmlVisible(completeCard, state === PAGE2_STATES.COMPLETE)
      if (state === PAGE2_STATES.GUIDE) maybeStartPage2Entrance()
      if (state === PAGE2_STATES.OVERVIEW_ENTERING) maybeStartBackgroundTimeline()
      updateReadinessDebug()
      return
    }
    page2Runtime.scanSessionId += 1
    page2Runtime.replayArmed = false
    setState(PAGE2_STATES.GUIDE)
    resetPage2EntranceVisualState()
  }

  const loseTracking = () => {
    if (!tracked) return
    debugLog('targetLost', {
      state,
      at: Math.round(performance.now()),
      replayThresholdMs: config.rescanReplay.lostThresholdMs,
    })
    tracked = false
    page2Runtime.targetVisible = false
    page2Runtime.lostStartedAt = performance.now()
    resumeState = state
    if (state === PAGE2_STATES.GUIDE) {
      stableElapsed = 0
      page2Runtime.trackingStable = false
    }
    setState(PAGE2_STATES.TRACKING_LOST)
    stable.setTracked(false)
    closeCard()
    setHtmlVisible(guide, false)
    setHtmlVisible(completeCard, false)
    enableModelUi(false)
    setHtmlVisible(overviewHint, false)
    setHtmlVisible(lostNotice, false)
    updateReadinessDebug()
  }

  const confirmReplayAfterLoss = () => {
    if (tracked || !page2Runtime.lostStartedAt) return
    const lostDuration = performance.now() - page2Runtime.lostStartedAt
    if (!config.rescanReplay.enabled || lostDuration < config.rescanReplay.lostThresholdMs) return
    page2Runtime.replayArmed = true
    page2Runtime.entranceRunId += 1
    entranceFramePending = false
    entranceTimelineActive = false
    backgroundTimelineStarted = false
    entranceAnimationFinished = false
    overview.resetEntry()
    overview.hide()
    floorBase.hide()
    setVisible(backgroundRoot, false)
    model.hide()
    particles.hide()
    setHtmlVisible(overviewHint, false)
    debugLog('page2ReplayArmed', {
      lostDuration: Math.round(lostDuration),
      thresholdMs: config.rescanReplay.lostThresholdMs,
      runId: page2Runtime.entranceRunId,
    })
    updateReadinessDebug()
  }

  lifecycle = createTargetLifecycle({
    target,
    lostDelayMs: config.rescanReplay.lostThresholdMs,
    signal,
    onFound({ firstFound, foundCount, lostCount }) {
      debugLog('targetFoundEvent', { firstFound, foundCount, lostCount, at: Math.round(performance.now()) })
      const shouldReplay = firstFound
        || (page2Runtime.replayArmed && config.rescanReplay.enabled && config.rescanReplay.replayFullEntrance)
      activate({ replay: shouldReplay })
    },
    onLost(data) {
      debugLog('targetLostEvent', { ...data, at: Math.round(performance.now()) })
      loseTracking()
    },
    onLostConfirmed: (data) => {
      debugLog('targetLostConfirmed', { ...data, thresholdMs: config.rescanReplay.lostThresholdMs })
      confirmReplayAfterLoss()
      setHtmlVisible(lostNotice, true)
    },
    onDebug: () => {},
  })

  const getFireHit = (clientX, clientY) => {
    if (state !== PAGE2_STATES.OVERVIEW || fireHit.object3D.visible === false || !scene.camera || !scene.canvas) return false
    const rect = scene.canvas.getBoundingClientRect()
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, scene.camera)
    return raycaster.intersectObject(fireHit.object3D, true).length > 0
  }

  const startModelTransition = () => {
    if (state !== PAGE2_STATES.OVERVIEW || !tracked || suspended) return false
    setHtmlVisible(overviewHint, false)
    setState(PAGE2_STATES.MODEL_ENTERING)
    rippleElapsed = 0
    setVisible(ripple, true)
    overview.startExit()
    return true
  }
  const enterModel = (event) => {
    if (state !== PAGE2_STATES.OVERVIEW || !tracked || suspended) return
    if (!getFireHit(event.clientX, event.clientY)) return
    event.preventDefault()
    startModelTransition()
  }
  scene.canvas.addEventListener('pointerup', enterModel, { signal })

  const returnOverview = () => {
    if (![PAGE2_STATES.MODEL, PAGE2_STATES.COMPLETE].includes(state)) return
    closeCard()
    setHtmlVisible(completeCard, false)
    enableModelUi(false)
    model.hide()
    particles.hide()
    setDarkness(0)
    setState(PAGE2_STATES.OVERVIEW_ENTERING)
    overview.restore()
  }

  const finishExploration = () => {
    if (progress.getCount() < config.hotspots.minimumViewed || ![PAGE2_STATES.MODEL, PAGE2_STATES.COMPLETE].includes(state)) return
    closeCard()
    progress.markCompleted()
    model.celebrate()
    particles.smallBurst()
    setState(PAGE2_STATES.COMPLETE)
    setHtmlVisible(completeCard, true)
  }

  root.querySelectorAll('[data-page2-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.page2Action
      if (action === 'overview') returnOverview()
      else if (action === 'reset') { closeCard(); model.resetView() }
      else if (action === 'close-card') closeCard()
      else if (action === 'complete') finishExploration()
    }, { signal })
  })

  const update = (time, delta) => {
    stable.update(time)
    if (page2Runtime.cameraStarted && performanceSampleElapsed < config.performance.fpsSampleDurationMs) {
      performanceSampleElapsed += delta
      performanceSampleFrames += 1
      if (performanceSampleElapsed >= config.performance.fpsSampleDurationMs) {
        const measuredFps = (performanceSampleFrames * 1000) / performanceSampleElapsed
        debugLog('page2PerformanceSample', { fps: Number(measuredFps.toFixed(1)), durationMs: Math.round(performanceSampleElapsed) })
        if (measuredFps < config.performance.liteFpsThreshold) enterLiteMode(`fps-${measuredFps.toFixed(1)}`)
      }
    }
    fpsElapsed += delta
    fpsFrames += 1
    if (fpsElapsed >= 800) {
      fps = Math.round((fpsFrames * 1000) / fpsElapsed)
      root.querySelector('[data-page2-debug-fps]')?.replaceChildren(String(fps))
      if (page2Runtime.entranceCompleted) {
        page2Runtime.visibleLayerCount = overview.validateVisibility().visibleLayerCount
      }
      fpsElapsed = 0
      fpsFrames = 0
      const preloadSnapshot = preloadSession.getSnapshot()
      if (!preloadSnapshot.criticalReady && preloadSnapshot.elapsedMs >= config.performance.criticalTextureTimeoutMs) {
        enterLiteMode(`critical-timeout-${Math.round(preloadSnapshot.elapsedMs)}ms`)
      }
      if (debug) renderDebugOutput()
    }
    if (!tracked || suspended || state === PAGE2_STATES.TRACKING_LOST) return
    floorBase.update(delta, page2Runtime.entranceRunId)
    const floorOpacity = floorBase.getDebugState().opacity
    if (floorOpacity > 0.01) markTiming('floorVisible', { opacity: Number(floorOpacity.toFixed(3)) })
    if (state === PAGE2_STATES.GUIDE) {
      if (stable.hasValidFullTransform()) stableElapsed += delta
      else stableElapsed = 0
      if (!page2Runtime.trackingStable && stableElapsed >= config.rescanReplay.stableDelayMs) {
        page2Runtime.trackingStable = true
        markTiming('trackingStable', { stableElapsed: Math.round(stableElapsed) })
        debugLog('page2TrackingStable', {
          stableElapsed: Math.round(stableElapsed),
          requiredMs: config.rescanReplay.stableDelayMs,
          at: Math.round(performance.now()),
        })
        updateReadinessDebug()
        maybeStartPage2Entrance()
      }
    }
    if (state === PAGE2_STATES.OVERVIEW_ENTERING && backgroundTimelineStarted) {
      backgroundElapsed += delta
      const startRotation = finiteOr(config.background.startRotationX, 0, 'background.startRotationX')
      const endRotation = finiteOr(config.background.endRotationX, 78, 'background.endRotationX')
      const t = easeInOutCubic(backgroundElapsed / finiteOr(config.background.openDuration, 900, 'background.openDuration'))
      backgroundRoot.object3D.rotation.x = THREE.MathUtils.degToRad(
        startRotation + (endRotation - startRotation) * t,
      )
    }
    if (state === PAGE2_STATES.MODEL_ENTERING) setDarkness(darkOpacity + delta / 1200)
    overview.update(delta)
    if (state === PAGE2_STATES.OVERVIEW_ENTERING && entranceTimelineActive) {
      page2EntranceProgress = overview.getProgress()
      updateReadinessDebug()
    }
    if (entranceAnimationFinished && !page2Runtime.entranceCompleted) {
      visibilityRetryElapsed += delta
      if (visibilityRetryElapsed >= 250) {
        visibilityRetryElapsed = 0
        finalizeOverviewIfVisible()
      }
    }
    model.update(delta)
    particles.update(delta)
    if (rippleElapsed >= 0) {
      rippleElapsed += delta
      const p = clamp(rippleElapsed / 520)
      ripple.object3D.scale.setScalar(1 + p * 8)
      ripple.setAttribute('material', 'opacity', (1 - p) * 0.9)
      if (p >= 1) { rippleElapsed = -1; setVisible(ripple, false) }
    }
  }

  registerRuntimeComponent()
  scene.__page2RuntimeTick = update
  scene.setAttribute('page2-runtime', '')

  const updateNormalizedDebug = () => {
    const fire = config.fireEntryHotspot
    fireHit.setAttribute('width', config.background.width * fire.width)
    fireHit.setAttribute('height', config.background.height * fire.height)
    const visual = root.querySelector('#page2-debug-fire-hotspot')
    visual.setAttribute('width', config.background.width * fire.width)
    visual.setAttribute('height', config.background.height * fire.height)
    overview.setDepthDirection(depthDirection)
  }

  const renderDebugOutput = () => {
    const output = root.querySelector('[data-page2-debug-output]')
    if (!output) return
    output.textContent = JSON.stringify({
      ringCenterX: config.mainVisual.ringCenterX,
      ringCenterY: config.mainVisual.ringCenterY,
      tongliang: {
        x: config.map.tongliangX,
        y: config.map.tongliangY,
        offsetX: config.map.tongliangOffsetX,
        offsetY: config.map.tongliangOffsetY,
      },
      fireEntryHotspot: config.fireEntryHotspot,
      readiness: {
        page2AllAssetsSettled: page2Runtime.allAssetsSettled,
        page2BackgroundReady: page2Runtime.backgroundReady,
        page2CriticalAssetsReady: page2Runtime.criticalAssetsReady,
        page2TrackingStable: page2Runtime.trackingStable,
        page2EntranceRequested: page2Runtime.entranceRequested,
        page2EntranceStarted: page2Runtime.entranceStarted,
        page2EntranceCompleted: page2Runtime.entranceCompleted,
        page2EntranceProgress,
        visibleLayerCount: page2Runtime.visibleLayerCount,
        page2ModelLoaded,
        resourcesLoaded: page2Runtime.resourcesLoaded,
        targetVisible: page2Runtime.targetVisible,
        lostDurationMs: page2Runtime.lostStartedAt ? performance.now() - page2Runtime.lostStartedAt : 0,
        replayArmed: page2Runtime.replayArmed,
        scanSessionId: page2Runtime.scanSessionId,
        entranceRunId: page2Runtime.entranceRunId,
        liteMode: page2Runtime.liteMode,
        liteReason: page2Runtime.liteReason,
      },
      timing: preloadSession.getTimingReport?.(),
      preload: {
        ...preloadSession.getSnapshot(),
        status: Object.fromEntries(preloadSession.getSnapshot().status),
        concurrency: preloadSession.concurrency,
      },
      floorBase: floorBase.getDebugState(),
      depthDirection,
      spatial: config.spatial,
      layers: config.layers,
      assets: Object.fromEntries(assetStatus),
      failedAssets: Object.fromEntries(page2Runtime.failedAssets),
      visibility: (() => {
        const visibility = overview.validateVisibility()
        return {
          visibleLayerIds: visibility.visibleLayerIds,
          visibleLayerCount: visibility.visibleLayerCount,
          visibleMainCount: visibility.visibleMainCount,
          strongLayerCount: visibility.strongLayerCount,
        }
      })(),
      overview: overview.getDebugState(),
      model: model.getDebugState(),
    }, null, 2)
  }

  if (debug) {
    const placeDebugAnchor = () => {
      anchor.object3D.position.set(0, -1.08, -3.15)
      anchor.object3D.quaternion.identity()
      anchor.object3D.scale.setScalar(1.4)
      setVisible(anchor, true)
    }
    const simulateRecognition = ({ fullReplay = false } = {}) => {
      if (fullReplay && tracked) {
        loseTracking()
        page2Runtime.lostStartedAt = performance.now() - config.rescanReplay.lostThresholdMs
        confirmReplayAfterLoss()
      }
      activate({ replay: fullReplay || page2Runtime.replayArmed })
      placeDebugAnchor()
      page2Runtime.trackingStable = true
      markTiming('trackingStable', { debugSimulated: true })
      maybeStartPage2Entrance()
    }
    const simulateShortJitter = () => {
      if (!tracked) return
      loseTracking()
      window.setTimeout(() => {
        activate({ replay: false })
        placeDebugAnchor()
      }, Math.min(300, config.rescanReplay.lostThresholdMs - 1))
    }
    const hotspotSelect = root.querySelector('[data-page2-debug="hotspot-id"]')
    const syncHotspotInputs = () => {
      const hotspot = PAGE2_HOTSPOTS.find((item) => item.id === hotspotSelect.value)
      root.querySelectorAll('[data-page2-hotspot-axis]').forEach((input) => { input.value = hotspot.position[input.dataset.page2HotspotAxis] })
    }
    root.querySelectorAll('[data-page2-debug]').forEach((input) => input.addEventListener('input', () => {
      const value = Number(input.value)
      if (!Number.isFinite(value)) return
      if (input.dataset.page2Debug === 'ring-x') config.mainVisual.ringCenterX = value
      if (input.dataset.page2Debug === 'ring-y') config.mainVisual.ringCenterY = value
      if (input.dataset.page2Debug === 'fire-x') config.fireEntryHotspot.x = value
      if (input.dataset.page2Debug === 'fire-y') config.fireEntryHotspot.y = value
      if (input.dataset.page2Debug === 'fire-w') config.fireEntryHotspot.width = clamp(value, 0.02, 1)
      if (input.dataset.page2Debug === 'fire-h') config.fireEntryHotspot.height = clamp(value, 0.02, 1)
      if (input.dataset.page2Debug === 'tongliang-x') config.map.tongliangOffsetX = value
      if (input.dataset.page2Debug === 'tongliang-y') config.map.tongliangOffsetY = value
      updateNormalizedDebug()
      renderDebugOutput()
    }, { signal }))
    hotspotSelect.addEventListener('change', syncHotspotInputs, { signal })
    root.querySelectorAll('[data-page2-hotspot-axis]').forEach((input) => input.addEventListener('input', () => {
      model.updateHotspotPosition(hotspotSelect.value, input.dataset.page2HotspotAxis, Number(input.value))
      renderDebugOutput()
    }, { signal }))
    root.querySelector('[data-page2-debug-action="print"]').addEventListener('click', () => {
      renderDebugOutput()
      console.info('[page2] 当前调试配置', JSON.parse(root.querySelector('[data-page2-debug-output]').textContent))
    }, { signal })
    root.querySelector('[data-page2-debug-action="simulate"]').addEventListener('click', () => {
      simulateRecognition({ fullReplay: tracked })
    }, { signal })
    root.querySelector('[data-page2-debug-action="jitter"]').addEventListener('click', simulateShortJitter, { signal })
    root.querySelector('[data-page2-debug-action="model"]').addEventListener('click', startModelTransition, { signal })
    syncHotspotInputs()
    renderDebugOutput()
    window.page2Debug = {
      config,
      hotspots: PAGE2_HOTSPOTS,
      activate: () => simulateRecognition(),
      simulateShortJitter,
      simulateRescan() { simulateRecognition({ fullReplay: true }) },
      enterModel: startModelTransition,
      showOverview: () => {
        activate({ replay: page2Runtime.replayArmed })
        placeDebugAnchor()
        detectDepthDirection()
        overview.showFinal()
        floorBase.showFinal()
        backgroundRoot.object3D.rotation.x = THREE.MathUtils.degToRad(config.background.endRotationX)
        setVisible(backgroundRoot, true)
        setState(PAGE2_STATES.OVERVIEW)
        page2Runtime.trackingStable = true
        page2Runtime.entranceStarted = true
        page2Runtime.entranceCompleted = true
        page2EntranceProgress = 1
        setHtmlVisible(guide, false)
        setHtmlVisible(overviewHint, true)
      },
    }
  }

  setVisible(backgroundRoot, false)
  setDarkness(0)
  updateStateUi()
  updateReadinessDebug()

  return {
    startAssetLoading,
    notifyCameraStarted(at = performance.now()) {
      page2Runtime.cameraStarted = true
      performanceSampleElapsed = 0
      performanceSampleFrames = 0
      markTiming('cameraStarted', null, at)
      updateReadinessDebug()
    },
    suspendForOtherTarget() {
      if (!tracked && state === PAGE2_STATES.HIDDEN) return
      stateBeforeSuspension = state === PAGE2_STATES.TRACKING_LOST ? resumeState : state
      resumeState = stateBeforeSuspension
      suspended = true
      tracked = false
      page2Runtime.targetVisible = false
      page2Runtime.replayArmed = true
      page2Runtime.entranceRunId += 1
      stable.setTracked(false)
      setVisible(anchor, false)
      root.querySelector('.page1-ar')?.classList.remove('is-page2-active')
      setHtmlVisible(lostNotice, false)
      setHtmlVisible(guide, false)
      setHtmlVisible(overviewHint, false)
      enableModelUi(false)
      closeCard()
      setHtmlVisible(completeCard, false)
    },
    resumeAfterSuspension() {
      resumeState = stateBeforeSuspension
      activate({ replay: page2Runtime.replayArmed })
    },
    getState: () => ({ state, tracked, suspended, resumeState, fps, ...page2Runtime }),
    destroy() {
      destroyed = true
      abortController.abort()
      unsubscribePreload()
      window.clearTimeout(replayGuideTimer)
      cancelScheduledModelPreload()
      assetLoadingPromise = null
      bindingPromises.clear()
      bindingQueue.splice(0)
      pendingAnimationFrames.forEach((id) => cancelAnimationFrame(id))
      pendingAnimationFrames.clear()
      lifecycle?.destroy()
      stable.destroy()
      overview.destroy()
      floorBase.destroy()
      model.destroy()
      particles.destroy()
      preloadSession.destroy?.()
      if (scene.__page2RuntimeTick === update) scene.__page2RuntimeTick = null
      if (debug) delete window.page2Debug
    },
  }
}
