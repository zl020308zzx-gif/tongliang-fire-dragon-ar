import { createStableAnchorController } from '../stable-anchor-controller.js'
import { createTargetLifecycle } from '../target-lifecycle.js'
import { PAGE2_HOTSPOTS, createPage2Progress } from './page2-hotspots.js'
import { createPage2Model } from './page2-model.js'
import { createPage2Overview } from './page2-overview.js'
import { createPage2Particles } from './page2-particles.js'
import { PAGE2_CONFIG, PAGE2_STATES } from './page2-config.js'

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const easeInOutCubic = (value) => {
  const t = clamp(value)
  return t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2
}

const assetEntries = [
  ['page2-background-asset', 'background'],
  ['page2-title-asset', 'title'],
  ['page2-intro-dragon-asset', 'introDragon'],
  ['page2-intro-text-asset', 'introText'],
  ['page2-map-main-asset', 'mapMain'],
  ['page2-map-text-asset', 'mapText'],
  ['page2-map-tongliang-asset', 'mapTongliang'],
  ['page2-main-base-asset', 'mainBase'],
  ['page2-main-ring-asset', 'mainRing'],
  ['page2-main-scene-asset', 'mainScene'],
  ['page2-main-sparks-asset', 'mainSparks'],
  ['page2-main-performers-asset', 'mainPerformers'],
  ['page2-main-dancers-asset', 'mainDancers'],
  ['page2-main-dragon-asset', 'mainDragon'],
  ['page2-main-pearl-asset', 'mainPearl'],
  ['page2-types-title-asset', 'typesTitle'],
  ['page2-types-back-asset', 'typesBack'],
  ['page2-types-mid-asset', 'typesMid'],
  ['page2-types-front-asset', 'typesFront'],
  ['page2-timeline-base-asset', 'timelineBase'],
  ['page2-timeline-nodes-asset', 'timelineNodes'],
  ['page2-timeline-texts-asset', 'timelineTexts'],
]

const resolvePage2Config = (config) => {
  const source = config && typeof config === 'object' ? config : {}
  return {
    ...PAGE2_CONFIG,
    ...source,
    assets: { ...PAGE2_CONFIG.assets, ...(source.assets || {}) },
    background: { ...PAGE2_CONFIG.background, ...(source.background || {}) },
    map: { ...PAGE2_CONFIG.map, ...(source.map || {}) },
    mainVisual: { ...PAGE2_CONFIG.mainVisual, ...(source.mainVisual || {}) },
    fireEntryHotspot: { ...PAGE2_CONFIG.fireEntryHotspot, ...(source.fireEntryHotspot || {}) },
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
  <a-image data-page2-layer="${layer}" data-page2-asset-key="${assetKey}" src="#${assetId}" width="${PAGE2_CONFIG.background.width}" height="${PAGE2_CONFIG.background.height}" position="0 0 0"
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
      <a-entity id="page2-background-root" visible="false" position="${hinge.x} ${hinge.y} ${hinge.z}"
        rotation="${config.background.startRotationX} 0 0">
        <a-entity id="page2-board-center" position="0 ${height / 2} 0">
          <a-image id="page2-background-plane" src="#page2-background-asset" width="${width}" height="${height}"
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
        </a-entity>
        <a-entity id="page2-map-root">
          ${fullLayer('page2-map-main-asset', 'map-main', 'mapMain')}
          ${fullLayer('page2-map-text-asset', 'map-text', 'mapText')}
          <a-image id="page2-map-tongliang" data-page2-layer="map-tongliang" data-page2-asset-key="mapTongliang" src="#page2-map-tongliang-asset"
            width="${config.map.tongliangWidth}" height="${config.map.tongliangHeight}"
            material="shader: flat; transparent: true; depthWrite: false"></a-image>
          <a-ring id="page2-map-tongliang-pulse" radius-inner=".008" radius-outer=".011"
            material="shader: flat; color: #ffb745; transparent: true; opacity: 0; depthWrite: false; side: double"></a-ring>
        </a-entity>
        <a-entity id="page2-main-visual-root">
          ${fullLayer('page2-main-base-asset', 'main-base', 'mainBase')}
          <a-image id="page2-main-ring" data-page2-layer="main-ring" data-page2-asset-key="mainRing" src="#page2-main-ring-asset"
            width="${config.mainVisual.ringWidth}" height="${config.mainVisual.ringHeight}"
            material="shader: flat; transparent: true; alphaTest: .005; depthWrite: false"></a-image>
          ${fullLayer('page2-main-scene-asset', 'main-scene', 'mainScene')}
          ${fullLayer('page2-main-sparks-asset', 'main-sparks', 'mainSparks')}
          ${fullLayer('page2-main-performers-asset', 'main-performers', 'mainPerformers')}
          ${fullLayer('page2-main-dancers-asset', 'main-dancers', 'mainDancers')}
          ${fullLayer('page2-main-dragon-asset', 'main-dragon', 'mainDragon')}
          <a-image id="page2-main-pearl" data-page2-layer="main-pearl" data-page2-asset-key="mainPearl" src="#page2-main-pearl-asset"
            width="${config.mainVisual.pearlWidth}" height="${config.mainVisual.pearlHeight}"
            material="shader: flat; transparent: true; alphaTest: .005; depthWrite: false"></a-image>
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
        <a-plane id="page2-fire-entry-hit" width="${width * fire.width}" height="${height * fire.height}"
          material="shader: flat; transparent: true; opacity: .001; depthWrite: false; side: double"></a-plane>
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
  <section class="page2-ui" aria-label="龙脉探源 AR 界面">
    <header class="page2-title"><span>02</span><h1>龙脉探源</h1></header>
    <section class="page2-guide page2-glass-card" role="status" hidden>
      <strong>识别成功｜龙脉探源</strong><p>请保持识别图平放，缓慢抬起手机观看</p>
    </section>
    <p class="page2-overview-hint" role="status" hidden>点击火龙，进入模型探索</p>
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
    <p>all assets <b data-page2-debug-assets>false</b>｜background <b data-page2-debug-background>false</b></p>
    <p>overview textures <b data-page2-debug-textures>false</b>｜tracking stable <b data-page2-debug-stable>false</b></p>
    <p>entrance <b data-page2-debug-entrance>false</b>｜progress <b data-page2-debug-progress>0%</b></p>
    <p>overview ready <b data-page2-debug-overview>false</b>｜model loaded <b data-page2-debug-model>false</b></p>
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
    <button type="button" data-page2-debug-action="model">模型测试</button>
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

export function createPage2Experience({ root, scene, target, anchor, config, debug, onActivate }) {
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
  let page2AssetsReady = false
  let page2BackgroundReady = false
  let page2OverviewTexturesReady = false
  let page2TrackingStable = false
  let page2EntranceStarted = false
  let page2EntranceProgress = 0
  let page2OverviewReady = false
  let page2ModelLoaded = false
  let entranceTimelineActive = false
  let entranceFramePending = false
  let depthDirection = -1
  let destroyed = false
  let assetLoadingPromise = null
  let assetFallbackTimer = 0
  const assetStatus = new Map(assetEntries.map(([, key]) => [key, 'deferred']))
  const pendingAnimationFrames = new Set()

  const debugLog = (event, detail = '') => {
    if (debug) console.info(`[page2] ${event}`, detail)
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

  const particles = createPage2Particles({ root, config })
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
    onEntryComplete() {
      page2EntranceProgress = 1
      page2OverviewReady = true
      entranceTimelineActive = false
      debugLog('page2EntranceCompleted', true)
      updateReadinessDebug()
      renderDebugOutput()
      setState(PAGE2_STATES.OVERVIEW)
      setHtmlVisible(overviewHint, true)
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
    root.querySelector('[data-page2-debug-assets]')?.replaceChildren(String(page2AssetsReady))
    root.querySelector('[data-page2-debug-background]')?.replaceChildren(String(page2BackgroundReady))
    root.querySelector('[data-page2-debug-textures]')?.replaceChildren(String(page2OverviewTexturesReady))
    root.querySelector('[data-page2-debug-stable]')?.replaceChildren(String(page2TrackingStable))
    root.querySelector('[data-page2-debug-entrance]')?.replaceChildren(String(page2EntranceStarted))
    root.querySelector('[data-page2-debug-progress]')?.replaceChildren(`${Math.round(page2EntranceProgress * 100)}%`)
    root.querySelector('[data-page2-debug-overview]')?.replaceChildren(String(page2OverviewReady))
    root.querySelector('[data-page2-debug-model]')?.replaceChildren(String(page2ModelLoaded))
    root.querySelector('[data-page2-debug-depth]')?.replaceChildren('card front (-Y), up (+Z)')
  }

  const detectDepthDirection = () => {
    depthDirection = -1
    overview.setDepthDirection(depthDirection)
    model.setDepthDirection(depthDirection)
    updateReadinessDebug()
  }

  const afterTwoAnimationFrames = (callback) => {
    const first = requestAnimationFrame(() => {
      pendingAnimationFrames.delete(first)
      const second = requestAnimationFrame(() => {
        pendingAnimationFrames.delete(second)
        callback()
      })
      pendingAnimationFrames.add(second)
    })
    pendingAnimationFrames.add(first)
  }

  const tryStartOverview = () => {
    debugLog('page2EntranceRequested', { page2BackgroundReady, page2TrackingStable })
    if (destroyed || !tracked || suspended || !page2BackgroundReady || !page2TrackingStable || page2EntranceStarted || entranceFramePending) return
    entranceFramePending = true
    page2EntranceStarted = true
    page2OverviewReady = false
    page2EntranceProgress = 0
    backgroundElapsed = 0
    setHtmlVisible(guide, false)
    setVisible(backgroundRoot, true)
    backgroundRoot.object3D.rotation.x = THREE.MathUtils.degToRad(config.background.startRotationX)
    setState(PAGE2_STATES.OVERVIEW_ENTERING)
    updateReadinessDebug()
    afterTwoAnimationFrames(() => {
      entranceFramePending = false
      if (destroyed || !tracked || suspended) {
        page2EntranceStarted = false
        updateReadinessDebug()
        return
      }
      detectDepthDirection()
      overview.resetEntry()
      overview.startEntry()
      entranceTimelineActive = true
      debugLog('page2EntranceStarted', true)
      updateReadinessDebug()
    })
  }

  const refreshAssetReadiness = () => {
    const settled = [...assetStatus.values()].filter((status) => ['loaded', 'failed'].includes(status)).length
    page2AssetsReady = settled === assetEntries.length
    page2OverviewTexturesReady = assetEntries
      .filter(([, key]) => key !== 'background')
      .every(([, key]) => ['loaded', 'failed'].includes(assetStatus.get(key)))
    if (page2OverviewTexturesReady) debugLog('page2OverviewTexturesReady', true)
    updateReadinessDebug()
    renderDebugOutput()
  }

  const settleAsset = (id, key, loaded) => {
    if (destroyed || ['loaded', 'failed'].includes(assetStatus.get(key))) return
    assetStatus.set(key, loaded ? 'loaded' : 'failed')
    if (loaded) {
      root.querySelectorAll(`[data-page2-asset-key="${key}"]`).forEach((entity) => entity.setAttribute('src', `#${id}`))
      if (key === 'background') root.querySelector('#page2-background-plane')?.setAttribute('src', `#${id}`)
      overview.markAssetReady(key)
    } else {
      console.error(`[page2] 第二页素材加载失败：${config.assets[key]}`)
    }
    if (key === 'background') {
      page2BackgroundReady = true
      debugLog('page2BackgroundReady', { loaded, path: config.assets[key] })
      tryStartOverview()
    }
    refreshAssetReadiness()
  }

  const startAssetLoading = () => {
    if (assetLoadingPromise || destroyed) return assetLoadingPromise
    const loadTasks = assetEntries.map(([id, key]) => new Promise((resolve, reject) => {
      const element = root.querySelector(`#${id}`)
      if (!element) {
        settleAsset(id, key, false)
        reject(new Error(`Page2 image element missing: #${id}`))
        return
      }
      assetStatus.set(key, 'loading')
      element.addEventListener('load', () => {
        settleAsset(id, key, true)
        resolve({ key, path: element.dataset.page2Src })
      }, { once: true, signal })
      element.addEventListener('error', () => {
        settleAsset(id, key, false)
        reject(new Error(`Page2 image failed: ${element.dataset.page2Src}`))
      }, { once: true, signal })
      element.src = element.dataset.page2Src
    }))
    assetLoadingPromise = Promise.allSettled(loadTasks).then((results) => {
      refreshAssetReadiness()
      return results
    })
    assetFallbackTimer = window.setTimeout(() => {
      if (!page2BackgroundReady) {
        page2BackgroundReady = true
        debugLog('page2BackgroundReady', '700ms fallback; background continues loading')
        tryStartOverview()
      }
    }, 700)
    refreshAssetReadiness()
    if (page2BackgroundReady) tryStartOverview()
    return assetLoadingPromise
  }

  const activate = ({ resumed = false } = {}) => {
    debugLog('targetFound', { resumed })
    suspended = false
    tracked = true
    root.querySelector('.page1-ar')?.classList.add('is-page2-active')
    onActivate?.()
    stable.setTracked(true)
    startAssetLoading()
    model.preload()
    setHtmlVisible(lostNotice, false)
    if (resumed && resumeState !== PAGE2_STATES.HIDDEN) {
      setState(resumeState)
      setHtmlVisible(guide, state === PAGE2_STATES.GUIDE)
      setHtmlVisible(overviewHint, state === PAGE2_STATES.OVERVIEW)
      if ([PAGE2_STATES.MODEL, PAGE2_STATES.COMPLETE].includes(state)) enableModelUi(true)
      setHtmlVisible(completeCard, state === PAGE2_STATES.COMPLETE)
      if (state === PAGE2_STATES.GUIDE) tryStartOverview()
      if (state === PAGE2_STATES.OVERVIEW_ENTERING && !entranceTimelineActive) {
        page2EntranceStarted = false
        tryStartOverview()
      }
      return
    }
    setState(PAGE2_STATES.GUIDE)
    stableElapsed = 0
    backgroundElapsed = 0
    page2TrackingStable = false
    page2EntranceStarted = false
    page2EntranceProgress = 0
    page2OverviewReady = false
    entranceTimelineActive = false
    entranceFramePending = false
    overview.resetEntry()
    setVisible(backgroundRoot, false)
    setHtmlVisible(guide, true)
    guideText.textContent = '请保持识别图平放，缓慢抬起手机观看'
    updateReadinessDebug()
  }

  const loseTracking = () => {
    if (!tracked) return
    tracked = false
    resumeState = state
    if (state === PAGE2_STATES.GUIDE) {
      stableElapsed = 0
      page2TrackingStable = false
    }
    setState(PAGE2_STATES.TRACKING_LOST)
    stable.setTracked(false)
    closeCard()
    setHtmlVisible(guide, false)
    setHtmlVisible(completeCard, false)
    enableModelUi(false)
    setHtmlVisible(overviewHint, false)
    setHtmlVisible(lostNotice, true)
    updateReadinessDebug()
  }

  lifecycle = createTargetLifecycle({
    target,
    lostDelayMs: config.trackingSmoothing.lostHoldDuration,
    signal,
    onFound({ firstFound }) {
      activate({ resumed: !firstFound && resumeState !== PAGE2_STATES.HIDDEN })
    },
    onLost: loseTracking,
    onLostConfirmed: () => setHtmlVisible(lostNotice, true),
    onDebug: () => {},
  })

  const getFireHit = (clientX, clientY) => {
    if (!scene.camera || !scene.canvas) return false
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
    fpsElapsed += delta
    fpsFrames += 1
    if (fpsElapsed >= 800) {
      fps = Math.round((fpsFrames * 1000) / fpsElapsed)
      root.querySelector('[data-page2-debug-fps]')?.replaceChildren(String(fps))
      fpsElapsed = 0
      fpsFrames = 0
      if (debug) renderDebugOutput()
    }
    if (!tracked || suspended || state === PAGE2_STATES.TRACKING_LOST) return
    if (state === PAGE2_STATES.GUIDE) {
      if (stable.hasValidFullTransform()) stableElapsed += delta
      else stableElapsed = 0
      if (!page2TrackingStable && stableElapsed >= config.overviewStableDelay) {
        page2TrackingStable = true
        debugLog('page2TrackingStable', true)
        guideText.textContent = '视角已就绪'
        updateReadinessDebug()
        tryStartOverview()
      }
    }
    if (state === PAGE2_STATES.OVERVIEW_ENTERING && entranceTimelineActive) {
      backgroundElapsed += delta
      const t = easeInOutCubic(backgroundElapsed / config.background.openDuration)
      backgroundRoot.object3D.rotation.x = THREE.MathUtils.degToRad(
        config.background.startRotationX + (config.background.endRotationX - config.background.startRotationX) * t,
      )
    }
    if (state === PAGE2_STATES.MODEL_ENTERING) setDarkness(darkOpacity + delta / 1200)
    overview.update(delta)
    if (state === PAGE2_STATES.OVERVIEW_ENTERING && entranceTimelineActive) {
      page2EntranceProgress = overview.getProgress()
      updateReadinessDebug()
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
        page2AssetsReady,
        page2BackgroundReady,
        page2OverviewTexturesReady,
        page2TrackingStable,
        page2EntranceStarted,
        page2EntranceProgress,
        page2OverviewReady,
        page2ModelLoaded,
      },
      depthDirection,
      spatial: config.spatial,
      layers: config.layers,
      assets: Object.fromEntries(assetStatus),
      overview: overview.getDebugState(),
      model: model.getDebugState(),
    }, null, 2)
  }

  if (debug) {
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
      activate()
      anchor.object3D.position.set(0, -1.08, -3.15)
      anchor.object3D.quaternion.identity()
      anchor.object3D.scale.setScalar(1.4)
      setVisible(anchor, true)
      page2TrackingStable = true
      page2EntranceStarted = false
      tryStartOverview()
    }, { signal })
    root.querySelector('[data-page2-debug-action="model"]').addEventListener('click', startModelTransition, { signal })
    syncHotspotInputs()
    renderDebugOutput()
    window.page2Debug = {
      config,
      hotspots: PAGE2_HOTSPOTS,
      activate,
      enterModel: startModelTransition,
      showOverview: () => {
        activate()
        anchor.object3D.position.set(0, -1.08, -3.15)
        anchor.object3D.quaternion.identity()
        anchor.object3D.scale.setScalar(1.4)
        setVisible(anchor, true)
        detectDepthDirection()
        overview.showFinal()
        backgroundRoot.object3D.rotation.x = THREE.MathUtils.degToRad(config.background.endRotationX)
        setVisible(backgroundRoot, true)
        setState(PAGE2_STATES.OVERVIEW)
        page2TrackingStable = true
        page2EntranceStarted = true
        page2EntranceProgress = 1
        page2OverviewReady = true
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
    suspendForOtherTarget() {
      if (!tracked && state === PAGE2_STATES.HIDDEN) return
      stateBeforeSuspension = state === PAGE2_STATES.TRACKING_LOST ? resumeState : state
      resumeState = stateBeforeSuspension
      suspended = true
      tracked = false
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
      activate({ resumed: true })
    },
    getState: () => ({ state, tracked, suspended, resumeState, fps }),
    destroy() {
      destroyed = true
      abortController.abort()
      window.clearTimeout(assetFallbackTimer)
      assetLoadingPromise = null
      pendingAnimationFrames.forEach((id) => cancelAnimationFrame(id))
      pendingAnimationFrames.clear()
      lifecycle?.destroy()
      stable.destroy()
      overview.destroy()
      model.destroy()
      particles.destroy()
      if (scene.__page2RuntimeTick === update) scene.__page2RuntimeTick = null
      if (debug) delete window.page2Debug
    },
  }
}
