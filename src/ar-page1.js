import { PAGE1_PREVIEW_CONFIG } from './config.js'
import { createArUiController } from './ar-ui-controller.js'
import { initializePage1Controller } from './page1-controller.js'
import { createMarkerHotspot } from './marker-hotspot.js'
import { createTargetLifecycle } from './target-lifecycle.js'
import { createTiltController } from './tilt-controller.js'

export const AR_PAGE1_STATES = Object.freeze({
  AR_NOT_STARTED: 'AR_NOT_STARTED',
  AR_STARTING: 'AR_STARTING',
  AR_SCANNING: 'AR_SCANNING',
  TARGET_FOUND: 'TARGET_FOUND',
  WAIT_BAMBOO: 'WAIT_BAMBOO',
  WAIT_TILT: 'WAIT_TILT',
  PANEL_RISING: 'PANEL_RISING',
  TRACKING_PAUSED: 'TRACKING_PAUSED',
})

const vector = (values) => values.join(' ')

const imageEntity = (assetId, entityConfig, extra = '') => `
  <a-image src="#${assetId}" position="${vector(entityConfig.position)}"
    rotation="${vector(entityConfig.rotation)}" width="${entityConfig.size.width}"
    height="${entityConfig.size.height}"
    material="transparent: true; alphaTest: 0.01; shader: flat" ${extra}></a-image>
`

const explodedGroup = (config) => `
  <a-entity id="explodedCraftGroup" position="${vector(config.groupPosition)}"
    rotation="${vector(config.groupRotation)}" visible="false">
    ${config.layers
      .map(
        (layer) => `<a-image data-explode-layer="${layer.id}" src="#explode-${layer.id}"
          position="0 0 0" width="${config.planeSize.width}" height="${config.planeSize.height}"
          material="transparent: true; alphaTest: 0.01; opacity: 1; shader: flat"></a-image>`,
      )
      .join('')}
    <a-plane id="explode-focus-outline" position="0 0 -0.01"
      width="${config.planeSize.width + 0.05}" height="${config.planeSize.height + 0.05}"
      material="color: #d7a64a; wireframe: true; transparent: true; opacity: 0.78; shader: flat"
      visible="false"></a-plane>
  </a-entity>
`

const arDebugPanel = (mode, config) => {
  if (mode === 'hotspot') return `<aside class="debug-panel ar-debug-panel"><p>识别卡比例 <strong data-ar-debug-aspect>${config.ar.markerAspectFallback}</strong></p><p>点击 UV <strong data-ar-debug-uv>—</strong></p><p>imageX/Y <strong data-ar-debug-image>—</strong></p><p>命中热点 <strong data-ar-debug-hit>—</strong></p><pre>${JSON.stringify(config.ar.bambooHotspot, null, 2)}</pre></aside>`
  if (mode === 'tilt') return `<aside class="debug-panel ar-debug-panel"><p>目标追踪 <strong data-ar-debug-tracked>false</strong></p><p>初始角度 <strong data-ar-debug-initial>—</strong></p><p>绝对角度 <strong data-ar-debug-angle>—</strong></p><p>变化角度 <strong data-ar-debug-delta>—</strong></p><p>稳定计时 <strong data-ar-debug-stable>0 ms</strong></p><p>panelHinge旋转 <strong data-ar-debug-rotation>—</strong></p><p>满足条件 <strong data-ar-debug-satisfied>false</strong></p></aside>`
  if (mode === 'tracking') return `<aside class="debug-panel ar-debug-panel"><p>arReady <strong data-ar-debug-ready>false</strong></p><p>targetTracked <strong data-ar-debug-tracked>false</strong></p><p>targetFound次数 <strong data-ar-debug-found>0</strong></p><p>targetLost次数 <strong data-ar-debug-lost>0</strong></p><p>丢失持续 <strong data-ar-debug-lost-duration>0 ms</strong></p><p>恢复状态 <strong data-ar-debug-resume>—</strong></p><p>视频暂停 <strong data-ar-debug-video-paused>false</strong></p><p>Canvas保留 <strong data-ar-debug-canvas>true</strong></p><p>MindAR状态 <strong data-ar-debug-mindar>AR_NOT_STARTED</strong></p></aside>`
  if (mode === 'state') return `<aside class="debug-panel state-debug-panel ar-debug-panel"><p>AR状态 <strong data-debug-ar-state>AR_NOT_STARTED</strong></p><p>当前制作状态 <strong data-debug-current-state>LINEART</strong></p><p>上一个状态 <strong data-debug-previous-state>—</strong></p><p>bambooProgress <strong data-debug-state-bamboo>0%</strong></p><p>paperProgress <strong data-debug-state-paper>0%</strong></p><p>paintProgress <strong data-debug-state-paint>0%</strong></p><p>视频状态 <strong data-debug-video>idle</strong></p><p>完成状态 <strong data-debug-completed>false</strong></p></aside>`
  return ''
}

export function renderArPage1(root) {
  root.__page1Cleanup?.()
  const config = PAGE1_PREVIEW_CONFIG
  const params = new URLSearchParams(window.location.search)
  const debugMode = ['hotspot', 'tilt', 'tracking', 'state'].includes(params.get('debug'))
    ? params.get('debug')
    : null
  const aspect = config.ar.markerAspectFallback
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

          <a-entity id="panelHinge" position="0 ${-aspect / 2} 0.008"
            rotation="${vector(config.ar.tiltGuide.panelStartRotation)}" visible="false">
            <a-entity id="ar-craft-content" position="0 ${aspect / 2} 0"
              scale="${config.ar.contentScale} ${config.ar.contentScale} ${config.ar.contentScale}">
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
              ${imageEntity('craft-panel-asset', config.backgroundBoard, 'id="craft-panel"')}
              <a-plane id="craft-plane" position="${vector(config.craftPlane.position)}"
                rotation="${vector(config.craftPlane.rotation)}" width="${config.craftPlane.size.width}"
                height="${config.craftPlane.size.height}"
                material="src: #${config.canvas.id}; transparent: true; alphaTest: 0.01; shader: flat"
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
      <section class="ar-tilt-prompt ar-overlay-card" hidden>
        <img src="${config.assets.phoneTiltGuide}" alt="手机立起示意" draggable="false" />
        <p>缓慢立起手机，从侧面观察龙首成形。</p>
        <button type="button" data-ar-action="manual-tilt" hidden>我已立起手机</button>
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
  let tilt = null
  let lifecycle = null
  let markerAspect = aspect
  let bambooActivated = false
  let storedCraftState = 'LINEART'

  try {
    bambooActivated = localStorage.getItem(config.bambooActivatedStorageKey) === 'true'
    storedCraftState = localStorage.getItem(config.lastStateStorageKey) || 'LINEART'
  } catch {
    bambooActivated = false
  }

  const setArState = (nextState) => {
    arState = nextState
    root.querySelector('[data-debug-ar-state]')?.replaceChildren(nextState)
    const mindarState = root.querySelector('[data-ar-debug-mindar]')
    if (mindarState) mindarState.textContent = nextState
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
    'manual-tilt': () => tilt?.completeManually(),
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
    debugMode: debugMode === 'state' ? 'state' : null,
    shouldReset: params.get('reset') === '1',
    arBridge,
    startPaused: true,
  })

  const applyMarkerAspect = (value) => {
    markerAspect = value || config.ar.markerAspectFallback
    hotspot?.updateAspect(markerAspect)
    panelHinge.object3D.position.y = -markerAspect / 2
    const content = root.querySelector('#ar-craft-content')
    content.object3D.position.y = markerAspect / 2
    root.querySelector('[data-ar-debug-aspect]')?.replaceChildren(markerAspect.toFixed(4))
  }

  const showTiltFlow = () => {
    if (craftStarted || arState === AR_PAGE1_STATES.WAIT_TILT || arState === AR_PAGE1_STATES.PANEL_RISING) return
    hotspot.setEnabled(false)
    ui.hideHotspot()
    panelHinge.object3D.visible = true
    panelHinge.setAttribute('visible', true)
    craftPlane.object3D.visible = false
    craftPlane.setAttribute('visible', false)
    setArState(AR_PAGE1_STATES.WAIT_TILT)
    ui.showTilt()
    tilt.start()
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
        showTiltFlow()
      },
      onDebug(data) {
        if (debugMode !== 'hotspot') return
        if (data.aspect) root.querySelector('[data-ar-debug-aspect]').textContent = data.aspect.toFixed(4)
        root.querySelector('[data-ar-debug-uv]').textContent = data.uv ? `${data.uv.x.toFixed(3)}, ${data.uv.y.toFixed(3)}` : '—'
        root.querySelector('[data-ar-debug-image]').textContent = data.image ? `${data.image.x.toFixed(3)}, ${data.image.y.toFixed(3)}` : '—'
        root.querySelector('[data-ar-debug-hit]').textContent = data.hit == null ? '—' : data.hit ? '是' : '否'
      },
    })

    tilt = createTiltController({
      scene,
      target,
      panelHinge,
      config: config.ar.tiltGuide,
      signal,
      isTracked: () => lifecycle?.isTracked() ?? false,
      onUpdate(data) {
        if (debugMode !== 'tilt') return
        root.querySelector('[data-ar-debug-tracked]').textContent = String(lifecycle?.isTracked() ?? false)
        root.querySelector('[data-ar-debug-initial]').textContent = data.initialAngle == null ? '—' : `${data.initialAngle.toFixed(1)}°`
        root.querySelector('[data-ar-debug-angle]').textContent = data.currentAngle == null ? '—' : `${data.currentAngle.toFixed(1)}°`
        root.querySelector('[data-ar-debug-delta]').textContent = data.deltaAngle == null ? '—' : `${data.deltaAngle.toFixed(1)}°`
        root.querySelector('[data-ar-debug-stable]').textContent = `${Math.round(data.stableMs)} ms`
        root.querySelector('[data-ar-debug-rotation]').textContent = data.rotation.map((value) => value.toFixed(1)).join(', ')
        root.querySelector('[data-ar-debug-satisfied]').textContent = String(data.satisfied)
      },
      onTimeout: () => ui.showManualTilt(),
      onRiseStart() {
        setArState(AR_PAGE1_STATES.PANEL_RISING)
        ui.showPanelRising()
      },
      onComplete() {
        craftStarted = true
        craftPlane.object3D.visible = true
        craftPlane.setAttribute('visible', true)
        arBridge.startCraft?.(storedCraftState)
        ui.showCraft()
        setArState('LINEART')
      },
    })

    lifecycle = createTargetLifecycle({
      target,
      lostDelayMs: config.ar.tracking.lostDelayMs,
      signal,
      onFound() {
        hotspot.setTracked(true)
        tilt.resume()
        ui.hideLost()
        setArState(AR_PAGE1_STATES.TARGET_FOUND)
        if (craftStarted) resumeTrackedExperience()
        else if (resumeArState === AR_PAGE1_STATES.PANEL_RISING) {
          setArState(AR_PAGE1_STATES.PANEL_RISING)
          ui.showTilt()
          ui.showPanelRising()
        } else if (resumeArState === AR_PAGE1_STATES.WAIT_TILT) {
          setArState(AR_PAGE1_STATES.WAIT_TILT)
          ui.showTilt()
        } else if (bambooActivated) showTiltFlow()
        else {
          setArState(AR_PAGE1_STATES.WAIT_BAMBOO)
          hotspot.setEnabled(true)
          ui.showHotspot()
        }
      },
      onLost() {
        resumeArState = arState
        hotspot.setTracked(false)
        tilt.pause()
        if (craftStarted) arBridge.pauseTracking?.()
        setArState(AR_PAGE1_STATES.TRACKING_PAUSED)
        updateTrackingDebug()
      },
      onLostConfirmed(data) {
        ui.showLost()
        updateTrackingDebug(data)
      },
      onDebug: updateTrackingDebug,
    })
    applyMarkerAspect(markerAspect)
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
    abortController.abort()
    hotspot?.destroy()
    tilt?.destroy()
    lifecycle?.destroy()
    pageCleanup()
    scene.systems['mindar-image-system']?.stop?.()
  }
}
