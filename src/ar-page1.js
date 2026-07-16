import { PAGE1_PREVIEW_CONFIG } from './config.js'
import { createArUiController } from './ar-ui-controller.js'
import { initializePage1Controller } from './page1-controller.js'
import { createMarkerHotspot } from './marker-hotspot.js'
import { createTargetLifecycle } from './target-lifecycle.js'
import { createPanelRiseController } from './tilt-controller.js'

export const AR_PAGE1_STATES = Object.freeze({
  AR_NOT_STARTED: 'AR_NOT_STARTED',
  AR_STARTING: 'AR_STARTING',
  AR_SCANNING: 'AR_SCANNING',
  TARGET_FOUND: 'TARGET_FOUND',
  WAIT_BAMBOO: 'WAIT_BAMBOO',
  WAIT_TILT: 'WAIT_TILT',
  SHOW_PLACEMENT_GUIDE: 'SHOW_PLACEMENT_GUIDE',
  PANEL_RISING: 'PANEL_RISING',
  TRACKING_PAUSED: 'TRACKING_PAUSED',
})

const vector = (values) => values.join(' ')

const imageEntity = (assetId, entityConfig, extra = '') => `
  <a-image src="#${assetId}" position="${vector(entityConfig.position)}"
    rotation="${vector(entityConfig.rotation)}" width="${entityConfig.size.width}"
    height="${entityConfig.size.height}"
    material="transparent: true; alphaTest: 0.01; depthWrite: true; depthTest: true; side: double; shader: flat" ${extra}></a-image>
`

const explodedGroup = (config) => `
  <a-entity id="explodedCraftGroup" position="${vector(config.groupPosition)}"
    rotation="${vector(config.groupRotation)}" visible="false">
    ${config.layers
      .map(
        (layer) => `<a-image data-explode-layer="${layer.id}" data-render-order="${layer.renderOrder}" src="#explode-${layer.id}"
          position="0 0 0" width="${config.planeSize.width}" height="${config.planeSize.height}"
          material="transparent: true; alphaTest: 0.01; opacity: 1; depthWrite: false; depthTest: true; side: double; shader: flat"></a-image>`,
      )
      .join('')}
    <a-plane id="explode-focus-outline" position="0 0 0"
      data-render-order="21"
      width="${config.planeSize.width + 0.05}" height="${config.planeSize.height + 0.05}"
      material="color: #d7a64a; wireframe: true; transparent: true; opacity: 0.78; shader: flat"
      visible="false"></a-plane>
  </a-entity>
`

const arDebugPanel = (mode, config) => {
  if (mode === 'hotspot') return `<aside class="debug-panel ar-debug-panel"><p>识别卡比例 <strong data-ar-debug-aspect>${config.ar.markerAspectFallback}</strong></p><p>点击 UV <strong data-ar-debug-uv>—</strong></p><p>imageX/Y <strong data-ar-debug-image>—</strong></p><p>命中热点 <strong data-ar-debug-hit>—</strong></p><pre>${JSON.stringify(config.ar.bambooHotspot, null, 2)}</pre></aside>`
  if (mode === 'tilt' || mode === 'panel') return `<aside class="debug-panel ar-debug-panel"><p>panelHinge世界坐标 <strong data-panel-debug-hinge>—</strong></p><p>panelContent世界坐标 <strong data-panel-debug-content>—</strong></p><p>当前旋转 <strong data-panel-debug-rotation>—</strong></p><p>目标旋转 <strong data-panel-debug-target>—</strong></p><p>frontDirectionSign <strong data-panel-debug-sign>${config.ar.arPanel.frontDirectionSign}</strong></p><p>背景板局部正面方向 <strong data-panel-debug-front>—</strong></p><p>升起进度 <strong data-panel-debug-progress>0%</strong></p></aside>`
  if (mode === 'hints') return `<aside class="debug-panel ar-debug-panel"><p>页面状态 <strong data-hint-debug-state>AR_NOT_STARTED</strong></p><p>targetTracked <strong data-hint-debug-tracked>false</strong></p><p>craftCanvasVisible <strong data-hint-debug-visible>false</strong></p><p>panelReady <strong data-hint-debug-ready>false</strong></p><p>canvasScreenRect <strong data-hint-debug-rect>—</strong></p><p>hintVisible <strong data-hint-debug-hint>false</strong></p><p>hintScreenX <strong data-hint-debug-x>—</strong></p><p>hintScreenY <strong data-hint-debug-y>—</strong></p><p>隐藏原因 <strong data-hint-debug-reason>AR尚未开始</strong></p></aside>`
  if (mode === 'tracking') return `<aside class="debug-panel ar-debug-panel"><p>arReady <strong data-ar-debug-ready>false</strong></p><p>targetTracked <strong data-ar-debug-tracked>false</strong></p><p>targetFound次数 <strong data-ar-debug-found>0</strong></p><p>targetLost次数 <strong data-ar-debug-lost>0</strong></p><p>丢失持续 <strong data-ar-debug-lost-duration>0 ms</strong></p><p>恢复状态 <strong data-ar-debug-resume>—</strong></p><p>视频暂停 <strong data-ar-debug-video-paused>false</strong></p><p>Canvas保留 <strong data-ar-debug-canvas>true</strong></p><p>MindAR状态 <strong data-ar-debug-mindar>AR_NOT_STARTED</strong></p></aside>`
  if (mode === 'explode') return `<aside class="debug-panel explode-debug-panel ar-debug-panel"><p>爆炸状态 <strong data-debug-explode-state>EXPLODE_VIEW</strong></p><p>选中层 <strong data-debug-explode-selected>—</strong></p><p>展开进度 <strong data-debug-explode-progress>0%</strong></p><p>panelSurfaceZ <strong data-debug-explode-panel>${config.explodedView.panelSurfaceZ}</strong></p><p>frontDirectionSign <strong data-debug-explode-sign>${config.explodedView.frontDirectionSign}</strong></p><p>视差旋转 <strong data-debug-parallax>0, 0</strong></p><p>输入坐标 <strong data-debug-parallax-input>0, 0</strong></p><p data-debug-explode-warning>等待图层状态</p><pre data-debug-explode-layers></pre><p>可点击范围（屏幕 px）</p><pre data-debug-explode-click-bounds></pre></aside>`
  if (mode === 'state') return `<aside class="debug-panel state-debug-panel ar-debug-panel"><p>AR状态 <strong data-debug-ar-state>AR_NOT_STARTED</strong></p><p>当前制作状态 <strong data-debug-current-state>LINEART</strong></p><p>上一个状态 <strong data-debug-previous-state>—</strong></p><p>bambooProgress <strong data-debug-state-bamboo>0%</strong></p><p>paperProgress <strong data-debug-state-paper>0%</strong></p><p>paintProgress <strong data-debug-state-paint>0%</strong></p><p>视频状态 <strong data-debug-video>idle</strong></p><p>完成状态 <strong data-debug-completed>false</strong></p></aside>`
  return ''
}

export function renderArPage1(root) {
  root.__page1Cleanup?.()
  const config = PAGE1_PREVIEW_CONFIG
  const params = new URLSearchParams(window.location.search)
  const debugMode = ['hotspot', 'tilt', 'panel', 'tracking', 'state', 'hints', 'explode'].includes(params.get('debug'))
    ? params.get('debug')
    : null
  const aspect = config.ar.markerAspectFallback
  const panelConfig = config.ar.arPanel
  const panelStartRotation = [
    panelConfig.startRotation.x * panelConfig.frontDirectionSign,
    panelConfig.startRotation.y,
    panelConfig.startRotation.z,
  ]
  const panelHingePosition = [panelConfig.hingePosition.x, panelConfig.hingePosition.y, panelConfig.hingePosition.z]
  const panelContentPosition = [
    panelConfig.contentPosition.x,
    panelConfig.contentPosition.y,
    panelConfig.contentPosition.z + panelConfig.frontDirectionSign * panelConfig.frontOffset,
  ]
  const abortController = new AbortController()
  const { signal } = abortController
  const arBridge = {}

  if (params.get('reset') === '1') {
    try {
      localStorage.removeItem(config.bambooActivatedStorageKey)
      localStorage.removeItem(config.lastStateStorageKey)
    } catch {
      // 存储不可用不阻塞AR启动。
    }
  }

  root.innerHTML = `
    <main class="page1-preview page1-ar" style="--color-mask-url: url('${config.assets.colorMask}')">
      <a-scene id="page1-ar-scene" class="preview-scene ar-scene" embedded
        mindar-image="imageTargetSrc: ${config.ar.targetSrc}; autoStart: false; uiLoading: no; uiScanning: no; uiError: no"
        renderer="antialias: true; colorManagement: true; alpha: true"
        vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"
        loading-screen="enabled: false">
        <a-assets timeout="8000">
          <img id="marker-reference" src="${config.ar.markerImage}" alt="" draggable="false" />
          <img id="craft-panel-asset" src="${config.assets.backgroundBoard}" alt="" draggable="false" />
          <img id="badge-bamboo" src="${config.assets.badge}" alt="" draggable="false" />
          ${config.assets.craftLayers.map((layer) => `<img id="explode-${layer.id}" src="${layer.path}" alt="" draggable="false" />`).join('')}
          <video id="dragon-video" src="${config.assets.awakenVideo}" playsinline webkit-playsinline preload="metadata"></video>
          <canvas id="${config.canvas.id}" width="${config.canvas.width}" height="${config.canvas.height}"></canvas>
        </a-assets>

        <a-camera position="0 0 0" look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>
        <a-entity id="page1-target" mindar-image-target="targetIndex: ${config.ar.targetIndex}">
          <a-plane id="marker-touch-plane" width="1" height="${aspect}" position="0 0 0.004"
            material="transparent: true; opacity: 0; side: double"></a-plane>
          <a-plane id="marker-hotspot-visual" visible="false"
            material="color: #d7a64a; opacity: 0.82; transparent: true; wireframe: true; side: double"></a-plane>

          <a-entity id="panelHinge" position="${vector(panelHingePosition)}"
            rotation="${vector(panelStartRotation)}" visible="false">
            <a-entity id="panelContent" position="${vector(panelContentPosition)}"
              scale="${panelConfig.scale} ${panelConfig.scale} ${panelConfig.scale}">
              <a-plane id="ar-depth-glow" position="0 0 -0.13" width="4.2" height="7.2"
                material="color: #7c3e12; opacity: 0.16; transparent: true; shader: flat"></a-plane>
              <a-entity id="ar-spatial-particles" aria-hidden="true">
                ${[
                  [-1.25, -0.9, 0.08],
                  [1.2, -0.35, 0.07],
                  [-0.85, 1.1, 0.06],
                  [0.95, 1.35, 0.05],
                  [0.25, -1.15, 0.09],
                ]
                  .map(
                    (position, index) => `<a-circle position="${vector(position)}" radius="${0.025 + index * 0.004}"
                      material="color: #f0bd55; opacity: 0.28; transparent: true; shader: flat"
                      animation="property: position; dir: alternate; dur: ${900 + index * 170}; loop: true; to: ${position[0]} ${position[1] + 0.16} ${position[2]}"></a-circle>`,
                  )
                  .join('')}
              </a-entity>
              ${imageEntity('craft-panel-asset', config.backgroundBoard, 'id="craft-panel-surface" data-render-order="0"')}
              <a-plane id="craft-plane" position="${vector(config.craftPlane.position)}"
                rotation="${vector(config.craftPlane.rotation)}" width="${config.craftPlane.size.width}"
                height="${config.craftPlane.size.height}"
                material="src: #${config.canvas.id}; transparent: true; alphaTest: 0.01; depthWrite: false; depthTest: true; side: double; shader: flat"
                visible="false"></a-plane>
              <a-video id="dragon-video-plane" src="#dragon-video"
                position="${vector(config.videoPlane.position)}" rotation="${vector(config.videoPlane.rotation)}"
                width="${config.videoPlane.size.width}" height="${config.videoPlane.size.height}"
                material="shader: flat" visible="false"></a-video>
              ${imageEntity('badge-bamboo', config.badge, 'id="bamboo-badge" scale="0.6 0.6 0.6" visible="false"')}
              ${explodedGroup(config.explodedView)}
            </a-entity>
          </a-entity>
        </a-entity>
      </a-scene>

      <header class="page-title"><span>01</span><h1>竹骨成龙</h1></header>
      <div class="craft-stamps" aria-label="工艺进度印记">
        ${config.craftStamps.labels.map((label, index) => `<span data-craft-stamp="${index}" class="${index === 0 ? 'is-current' : ''}">${label}</span>`).join('')}
      </div>
      ${arDebugPanel(debugMode, config)}

      <div class="hold-interaction-hint" hidden><i></i><b>长按</b></div>
      <div class="paper-slider-hint" hidden><i>↔</i></div>
      <div class="paint-entry-hint" hidden><span>滑动彩绘</span></div>
      <div class="paint-brush-cursor" hidden></div>
      <div class="eye-interaction-hint" hidden><i></i><b>点击龙眼</b></div>
      <div class="stage-particles" aria-hidden="true"></div>
      <div class="review-ember-glow" aria-hidden="true" hidden></div>
      <div class="parallax-guide" hidden><i class="phone-shape"></i><span>←　→</span><b>左右摆动</b></div>
      <nav class="explode-stage-tabs" aria-label="四层成龙谱阶段" hidden>
        ${config.explodedView.layers.map((layer) => `<button type="button" data-explode-tag="${layer.id}"><strong>${layer.stage}</strong>${layer.shortLabel}</button>`).join('')}
      </nav>
      <div class="bamboo-annotations" hidden>
        ${config.explodedView.bambooAnnotations.map((item) => `<span data-annotation="${item.id}"><i></i>${item.label}</span>`).join('')}
      </div>
      <div class="ar-hotspot-label" hidden><i>☝</i><span>点击竹篾</span></div>
      <p class="layer-error" role="alert" hidden></p>

      <section class="step-card" aria-labelledby="step-title">
        <p class="step-number">步骤：<strong>01 / 04</strong></p>
        <h2 id="step-title">选材起稿</h2>
        <p class="step-description">根据龙头造型确定龙眼、鼻部、龙口、龙角和龙颈的位置，<br />为后续竹骨扎制建立基本轮廓。</p>
        <p class="step-hint"><span>操作提示</span>长按龙首，让竹骨逐渐成形。</p>
        <div class="card-actions">
          <button type="button" data-card-action="paper-complete" hidden>完成裱糊</button>
          <button type="button" data-card-action="retry" hidden>重新播放</button>
          <button type="button" data-card-action="skip" hidden>跳过视频</button>
          <button type="button" data-card-action="review" hidden>查看成龙过程</button>
          <button type="button" data-card-action="overview" hidden>返回全貌</button>
          <button type="button" data-card-action="restart" hidden>重新体验</button>
          <button type="button" data-card-action="end" hidden>结束预览</button>
        </div>
        <p class="preview-end-notice" role="status" hidden></p>
      </section>

      <section class="ar-start-screen ar-overlay-card">
        <span>铜梁火龙 · 第一页</span>
        <h2>扫描识别卡，唤醒竹骨成龙工艺</h2>
        <p>需要使用摄像头识别竹骨燃龙卡片。</p>
        <button type="button" data-ar-action="start">开启AR体验</button>
      </section>
      <p class="ar-scan-status" role="status" hidden>请扫描竹骨燃龙识别卡</p>
      <section class="ar-placement-guide ar-overlay-card" hidden>
        <img src="${config.assets.phoneTiltGuide}" alt="识别图摆放示意" draggable="false" />
        <p>建议将识别图缓慢平放于桌面，<br />体验火龙工艺展开效果更佳。</p>
        <p class="placement-note">识别图保持竖直时也可继续体验。</p>
        <button type="button" data-ar-action="continue-placement">继续体验</button>
      </section>
      <section class="ar-lost-dialog ar-overlay-card" role="dialog" hidden>
        <h2>识别卡已离开画面</h2>
        <p>当前制作进度已保存，请重新对准识别卡。</p>
        <div><button type="button" data-ar-action="continue-current">继续当前体验</button><button type="button" data-ar-action="return-scan">返回扫描</button></div>
      </section>
      <section class="ar-video-resume ar-overlay-card" hidden>
        <p>视频已暂停，点击后从当前位置继续。</p>
        <button type="button" data-ar-action="continue-video">继续播放</button>
      </section>
      <section class="ar-error-panel ar-overlay-card" role="alert" hidden>
        <p></p><button type="button" data-ar-action="restart-camera">重新开启摄像头</button>
      </section>
    </main>
  `

  const scene = root.querySelector('#page1-ar-scene')
  const target = root.querySelector('#page1-target')
  const panelHinge = root.querySelector('#panelHinge')
  const panelContent = root.querySelector('#panelContent')
  const craftPanel = root.querySelector('#craft-panel-surface')
  const craftPlane = root.querySelector('#craft-plane')
  const markerPlane = root.querySelector('#marker-touch-plane')
  const hotspotVisual = root.querySelector('#marker-hotspot-visual')
  const markerReference = root.querySelector('#marker-reference')
  let arState = AR_PAGE1_STATES.AR_NOT_STARTED
  let resumeArState = AR_PAGE1_STATES.AR_NOT_STARTED
  let arReady = false
  let craftStarted = false
  let controllersReady = false
  let hotspot = null
  let panelController = null
  let lifecycle = null
  let markerAspect = aspect
  let bambooActivated = false
  let storedCraftState = 'LINEART'
  let panelReady = false
  let placementTimer = null
  let placementFadeTimer = null
  let panelDebugState = {
    progress: 0,
    rotation: panelStartRotation,
    targetRotation: [
      panelConfig.endRotation.x * panelConfig.frontDirectionSign,
      panelConfig.endRotation.y,
      panelConfig.endRotation.z,
    ],
  }

  try {
    bambooActivated = localStorage.getItem(config.bambooActivatedStorageKey) === 'true'
    storedCraftState = localStorage.getItem(config.lastStateStorageKey) || 'LINEART'
    if (storedCraftState === AR_PAGE1_STATES.WAIT_TILT) {
      storedCraftState = 'LINEART'
      bambooActivated = true
    }
  } catch {
    bambooActivated = false
  }

  const setArState = (nextState) => {
    arState = nextState
    root.querySelector('[data-debug-ar-state]')?.replaceChildren(nextState)
    const mindarState = root.querySelector('[data-ar-debug-mindar]')
    if (mindarState) mindarState.textContent = nextState
    arBridge.refreshHints?.()
    updateHintDebug()
  }

  const isCraftCanvasVisible = () =>
    Boolean(craftPlane?.object3D?.visible && craftPlane.getAttribute('visible') !== false)

  const canShowBambooHint = ({ state, bounds, center }) => {
    if (!['LINEART', 'BAMBOO_BUILD'].includes(state)) return { allowed: false, reason: '当前制作状态禁止显示扎骨提示' }
    if (!(lifecycle?.isTracked() ?? false)) return { allowed: false, reason: 'targetTracked=false' }
    if (!panelReady) return { allowed: false, reason: 'panelRising动画尚未完成' }
    if (!isCraftCanvasVisible()) return { allowed: false, reason: 'craftCanvas平面当前不可见' }
    if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
      return { allowed: false, reason: 'craftCanvas屏幕投影尺寸无效' }
    }
    if (!center || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
      return { allowed: false, reason: '龙头热点位置不是有限数字' }
    }
    return { allowed: true, reason: '' }
  }

  const updateHintDebug = (snapshot = arBridge.getHintSnapshot?.() ?? {}) => {
    if (debugMode !== 'hints') return
    const rect = snapshot.canvasScreenRect
    root.querySelector('[data-hint-debug-state]').textContent = arState
    root.querySelector('[data-hint-debug-tracked]').textContent = String(lifecycle?.isTracked() ?? false)
    root.querySelector('[data-hint-debug-visible]').textContent = String(isCraftCanvasVisible())
    root.querySelector('[data-hint-debug-ready]').textContent = String(panelReady)
    root.querySelector('[data-hint-debug-rect]').textContent = rect
      ? `${rect.left.toFixed(1)}, ${rect.top.toFixed(1)}, ${rect.width.toFixed(1)} × ${rect.height.toFixed(1)}`
      : '—'
    root.querySelector('[data-hint-debug-hint]').textContent = String(snapshot.hintVisible ?? false)
    root.querySelector('[data-hint-debug-x]').textContent = Number.isFinite(snapshot.hintScreenX) ? snapshot.hintScreenX.toFixed(1) : '—'
    root.querySelector('[data-hint-debug-y]').textContent = Number.isFinite(snapshot.hintScreenY) ? snapshot.hintScreenY.toFixed(1) : '—'
    root.querySelector('[data-hint-debug-reason]').textContent = snapshot.hiddenReason || '—'
  }

  const updatePanelDebug = () => {
    if (!['tilt', 'panel'].includes(debugMode)) return
    const THREE = window.AFRAME.THREE
    const hingeWorld = new THREE.Vector3()
    const contentWorld = new THREE.Vector3()
    panelHinge.object3D.getWorldPosition(hingeWorld)
    panelContent.object3D.getWorldPosition(contentWorld)
    const format = (value) => `${value.x.toFixed(3)}, ${value.y.toFixed(3)}, ${value.z.toFixed(3)}`
    root.querySelector('[data-panel-debug-hinge]').textContent = format(hingeWorld)
    root.querySelector('[data-panel-debug-content]').textContent = format(contentWorld)
    root.querySelector('[data-panel-debug-rotation]').textContent = panelDebugState.rotation.map((value) => value.toFixed(1)).join(', ')
    root.querySelector('[data-panel-debug-target]').textContent = panelDebugState.targetRotation.map((value) => value.toFixed(1)).join(', ')
    root.querySelector('[data-panel-debug-front]').textContent = `0, 0, ${panelConfig.frontDirectionSign}`
    root.querySelector('[data-panel-debug-progress]').textContent = `${Math.round(panelDebugState.progress * 100)}%`
  }

  const updateTrackingDebug = (data = {}) => {
    if (debugMode !== 'tracking') return
    const snapshot = arBridge.getSnapshot?.() ?? {}
    const lifecycleState = lifecycle?.getState?.() ?? {}
    const lostDuration =
      data.lostDurationMs ??
      (lifecycleState.lostStartedAt == null ? 0 : performance.now() - lifecycleState.lostStartedAt)
    root.querySelector('[data-ar-debug-ready]').textContent = String(arReady)
    root.querySelector('[data-ar-debug-tracked]').textContent = String(data.targetTracked ?? lifecycle?.isTracked?.() ?? false)
    root.querySelector('[data-ar-debug-found]').textContent = String(data.foundCount ?? lifecycle?.getState?.().foundCount ?? 0)
    root.querySelector('[data-ar-debug-lost]').textContent = String(data.lostCount ?? lifecycle?.getState?.().lostCount ?? 0)
    root.querySelector('[data-ar-debug-lost-duration]').textContent = `${Math.round(lostDuration)} ms`
    root.querySelector('[data-ar-debug-resume]').textContent = snapshot.currentState ?? '—'
    root.querySelector('[data-ar-debug-video-paused]').textContent = String(snapshot.videoPausedByTracking ?? false)
    root.querySelector('[data-ar-debug-canvas]').textContent = String(snapshot.canvasPreserved ?? true)
  }

  const actions = {
    start: () => startAr(),
    'restart-camera': () => startAr(true),
    'continue-placement': () => finishPlacementGuide(true),
    'continue-current': () => {
      ui.hideLost()
      ui.showScanning('请重新对准竹骨燃龙识别卡')
      if (lifecycle?.isTracked()) resumeTrackedExperience()
    },
    'return-scan': () => {
      ui.hideLost()
      setArState(AR_PAGE1_STATES.AR_SCANNING)
      ui.showScanning()
    },
    'continue-video': () => {
      if (!lifecycle?.isTracked()) return
      arBridge.resumeTracking?.()
      arBridge.continueVideo?.()
      ui.hideVideoResume()
    },
  }
  const ui = createArUiController({ root, signal, actions })

  const pageCleanup = initializePage1Controller({
    root,
    config,
    debugLayers: false,
    debugMode: ['state', 'explode'].includes(debugMode) ? debugMode : null,
    shouldReset: params.get('reset') === '1',
    arBridge,
    startPaused: true,
    canShowBambooHint,
    onHintVisibilityChange: updateHintDebug,
    onStateChange(nextState) {
      if (!craftStarted || !panelReady || !(lifecycle?.isTracked() ?? false)) return
      arState = nextState
      updateHintDebug()
    },
  })

  const applyMarkerAspect = (value) => {
    markerAspect = value || config.ar.markerAspectFallback
    hotspot?.updateAspect(markerAspect)
    panelHinge.object3D.position.set(
      panelConfig.hingePosition.x,
      panelConfig.hingePosition.y * (markerAspect / config.ar.markerAspectFallback),
      panelConfig.hingePosition.z,
    )
    panelContent.object3D.position.set(
      panelConfig.contentPosition.x,
      panelConfig.contentPosition.y,
      panelConfig.contentPosition.z + panelConfig.frontDirectionSign * panelConfig.frontOffset,
    )
    root.querySelector('[data-ar-debug-aspect]')?.replaceChildren(markerAspect.toFixed(4))
  }

  const clearPlacementTimers = () => {
    if (placementTimer !== null) clearTimeout(placementTimer)
    if (placementFadeTimer !== null) clearTimeout(placementFadeTimer)
    placementTimer = null
    placementFadeTimer = null
  }

  const beginPanelRise = () => {
    if (craftStarted || !(lifecycle?.isTracked() ?? false)) return
    clearPlacementTimers()
    ui.hidePlacementGuide()
    hotspot.setEnabled(false)
    ui.hideHotspot()
    panelHinge.object3D.visible = true
    panelHinge.setAttribute('visible', true)
    craftPlane.object3D.visible = false
    craftPlane.setAttribute('visible', false)
    panelReady = false
    setArState(AR_PAGE1_STATES.PANEL_RISING)
    ui.showPanelRising()
    panelController.startRise()
  }

  const finishPlacementGuide = (immediate = false) => {
    if (arState !== AR_PAGE1_STATES.SHOW_PLACEMENT_GUIDE) return
    clearPlacementTimers()
    if (immediate) {
      ui.hidePlacementGuide()
      beginPanelRise()
      return
    }
    ui.fadePlacementGuide()
    placementFadeTimer = window.setTimeout(beginPanelRise, config.ar.placementGuide.fadeDurationMs)
  }

  const showPlacementFlow = () => {
    if (craftStarted || arState === AR_PAGE1_STATES.SHOW_PLACEMENT_GUIDE || arState === AR_PAGE1_STATES.PANEL_RISING) return
    clearPlacementTimers()
    hotspot.setEnabled(false)
    ui.hideHotspot()
    panelHinge.object3D.visible = false
    panelHinge.setAttribute('visible', false)
    craftPlane.object3D.visible = false
    craftPlane.setAttribute('visible', false)
    panelReady = false
    setArState(AR_PAGE1_STATES.SHOW_PLACEMENT_GUIDE)
    ui.showPlacementGuide()
    placementTimer = window.setTimeout(() => finishPlacementGuide(false), config.ar.placementGuide.durationMs)
  }

  const resumeTrackedExperience = () => {
    ui.hideLost()
    const snapshot = arBridge.resumeTracking?.() ?? arBridge.getSnapshot?.()
    ui.showCraft()
    setArState(snapshot?.currentState ?? AR_PAGE1_STATES.TARGET_FOUND)
    if (snapshot?.videoPausedByTracking) ui.showVideoResume()
    updateTrackingDebug()
  }

  const setupArControllers = () => {
    if (controllersReady || !scene.canvas) return
    controllersReady = true
    hotspot = createMarkerHotspot({
      scene,
      plane: markerPlane,
      visual: hotspotVisual,
      label: ui.hotspotLabel,
      config: config.ar,
      signal,
      debug: debugMode === 'hotspot',
      onActivate() {
        bambooActivated = true
        try {
          localStorage.setItem(config.bambooActivatedStorageKey, 'true')
        } catch {
          // 存储失败不阻塞当前体验。
        }
        showPlacementFlow()
      },
      onDebug(data) {
        if (debugMode !== 'hotspot') return
        if (data.aspect) root.querySelector('[data-ar-debug-aspect]').textContent = data.aspect.toFixed(4)
        root.querySelector('[data-ar-debug-uv]').textContent = data.uv ? `${data.uv.x.toFixed(3)}, ${data.uv.y.toFixed(3)}` : '—'
        root.querySelector('[data-ar-debug-image]').textContent = data.image ? `${data.image.x.toFixed(3)}, ${data.image.y.toFixed(3)}` : '—'
        root.querySelector('[data-ar-debug-hit]').textContent = data.hit == null ? '—' : data.hit ? '是' : '否'
      },
    })

    panelController = createPanelRiseController({
      panelHinge,
      config: panelConfig,
      onUpdate(data) {
        panelDebugState = {
          progress: data.progress,
          rotation: [data.rotation.x, data.rotation.y, data.rotation.z],
          targetRotation: [data.targetRotation.x, data.targetRotation.y, data.targetRotation.z],
        }
        updatePanelDebug()
      },
      onRiseStart() {
        setArState(AR_PAGE1_STATES.PANEL_RISING)
        ui.showPanelRising()
      },
      onComplete() {
        panelReady = true
        craftStarted = true
        craftPlane.object3D.visible = true
        craftPlane.setAttribute('visible', true)
        arBridge.startCraft?.(storedCraftState)
        ui.showCraft()
        setArState(arBridge.getSnapshot?.().currentState ?? 'LINEART')
        arBridge.refreshHints?.()
      },
    })

    lifecycle = createTargetLifecycle({
      target,
      lostDelayMs: config.ar.tracking.lostDelayMs,
      signal,
      onFound() {
        hotspot.setTracked(true)
        panelController.resume()
        ui.hideLost()
        setArState(AR_PAGE1_STATES.TARGET_FOUND)
        if (craftStarted) resumeTrackedExperience()
        else if (resumeArState === AR_PAGE1_STATES.PANEL_RISING) {
          setArState(AR_PAGE1_STATES.PANEL_RISING)
          ui.showPanelRising()
          panelHinge.object3D.visible = true
          panelHinge.setAttribute('visible', true)
          panelController.resume()
        } else if ([AR_PAGE1_STATES.SHOW_PLACEMENT_GUIDE, AR_PAGE1_STATES.WAIT_TILT].includes(resumeArState)) {
          showPlacementFlow()
        } else if (bambooActivated) showPlacementFlow()
        else {
          setArState(AR_PAGE1_STATES.WAIT_BAMBOO)
          hotspot.setEnabled(true)
          ui.showHotspot()
        }
      },
      onLost() {
        resumeArState = arState
        clearPlacementTimers()
        ui.hidePlacementGuide()
        hotspot.setTracked(false)
        panelController.pause()
        if (craftStarted) arBridge.pauseTracking?.()
        setArState(AR_PAGE1_STATES.TRACKING_PAUSED)
        arBridge.hideHints?.('targetLost或追踪暂停')
        updateTrackingDebug()
      },
      onLostConfirmed(data) {
        ui.showLost()
        updateTrackingDebug(data)
      },
      onDebug: updateTrackingDebug,
    })
    applyMarkerAspect(markerAspect)
    updatePanelDebug()
  }

  const startAr = async (restart = false) => {
    setArState(AR_PAGE1_STATES.AR_STARTING)
    ui.showStarting()
    try {
      if (!scene.hasLoaded) {
        await new Promise((resolve) => scene.addEventListener('loaded', resolve, { once: true }))
      }
      setupArControllers()
      const system = scene.systems['mindar-image-system']
      if (!system?.start) throw new Error('MindAR系统未加载')
      if (restart) await system.stop?.()
      await system.start()
      setArState(AR_PAGE1_STATES.AR_SCANNING)
      ui.showScanning()
    } catch (error) {
      setArState(AR_PAGE1_STATES.AR_NOT_STARTED)
      ui.showError(`AR启动失败：${error?.message || '无法访问摄像头'}`)
    }
  }

  scene.addEventListener(
    'arReady',
    () => {
      arReady = true
      if (!lifecycle?.isTracked()) ui.showScanning()
      updateTrackingDebug()
    },
    { signal },
  )
  scene.addEventListener(
    'arError',
    (event) => {
      arReady = false
      ui.showError(`AR运行错误：${event.detail?.error || event.detail || '摄像头或识别模块不可用'}`)
      updateTrackingDebug()
    },
    { signal },
  )
  markerReference.addEventListener(
    'load',
    () => applyMarkerAspect(markerReference.naturalHeight / markerReference.naturalWidth),
    { once: true, signal },
  )
  if (markerReference.complete && markerReference.naturalWidth) {
    applyMarkerAspect(markerReference.naturalHeight / markerReference.naturalWidth)
  }
  if (scene.hasLoaded) setupArControllers()
  else scene.addEventListener('loaded', setupArControllers, { once: true, signal })

  root.__page1Cleanup = () => {
    clearPlacementTimers()
    abortController.abort()
    hotspot?.destroy()
    panelController?.destroy()
    lifecycle?.destroy()
    pageCleanup()
    scene.systems['mindar-image-system']?.stop?.()
  }
}
