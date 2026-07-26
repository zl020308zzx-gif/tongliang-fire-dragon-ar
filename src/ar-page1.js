import { PAGE1_PREVIEW_CONFIG } from './config.js'
import { createArUiController } from './ar-ui-controller.js'
import { createArLayoutTuner } from './ar-layout-tuner.js'
import { initializePage1Controller } from './page1-controller.js'
import { createMarkerHotspot } from './marker-hotspot.js'
import { createTargetLifecycle } from './target-lifecycle.js'
import { createPanelRiseController } from './tilt-controller.js'
import { createStableAnchorController } from './stable-anchor-controller.js'
import { PAGE2_CONFIG } from './page2/page2-config.js'
import { createPage2Experience, page2AssetsMarkup, page2SceneMarkup, page2UiMarkup } from './page2/page2.js'
import { createPage2Preloader } from './page2/page2-preloader.js'
import { PAGE3_CONFIG } from './page3/page3-config.js'
import { createPage3Experience, page3AssetsMarkup, page3SceneMarkup, page3UiMarkup } from './page3/page3.js'
import { createPage3Preloader } from './page3/page3-preloader.js'
import {
  createSharedModuleUi,
  sharedModuleUiMarkup,
  waitForFirstVisualFrame,
} from './shared-module-ui.js'
import { createModuleAssetLoader, loadImageElement } from './module-asset-loader.js'
import { prepareAFrameImageTexture } from './aframe-texture-preloader.js'

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

export const APP_AR_STATES = Object.freeze({
  LANDING: 'APP_LANDING',
  CAMERA_REQUESTING: 'CAMERA_REQUESTING',
  WAITING_FOR_TARGET: 'AR_WAITING_FOR_TARGET',
  MODULE_ACTIVE: 'MODULE_ACTIVE',
})

export const AR_ROUTES = Object.freeze({
  PAGE1: 'page1',
  PAGE2: 'page2',
  PAGE3: 'page3',
  COLLECTION: 'collection',
})

export const resolveActiveRoute = (search = window.location.search) => {
  const requested = new URLSearchParams(search).get('ar')
  return [AR_ROUTES.PAGE1, AR_ROUTES.PAGE2, AR_ROUTES.PAGE3].includes(requested)
    ? requested
    : AR_ROUTES.COLLECTION
}

const vector = (values) => values.join(' ')

const imageEntity = (
  assetId,
  entityConfig,
  extra = '',
  bindSource = true,
  depthWrite = true,
) => `
  <a-image ${bindSource ? `src="#${assetId}"` : ''} position="${vector(entityConfig.position)}"
    rotation="${vector(entityConfig.rotation)}" width="${entityConfig.size.width}"
    height="${entityConfig.size.height}"
    material="transparent: true; alphaTest: 0.01; depthWrite: ${depthWrite}; depthTest: true; side: double; shader: flat" ${extra}></a-image>
`

const explodedGroup = (config, bindSource = true) => `
  <a-entity id="explodedCraftGroup" position="${vector(config.groupPosition)}"
    rotation="${vector(config.groupRotation)}" visible="false">
    ${config.layers
      .map(
        (layer) => `<a-image data-explode-layer="${layer.id}" data-render-order="${layer.renderOrder}"
          ${layer.id === 'lineart' && bindSource ? `src="#explode-${layer.id}"` : ''}
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
  if (mode === 'tracking') return `<aside class="debug-panel ar-debug-panel"><p>arReady <strong data-ar-debug-ready>false</strong></p><p>targetTracked <strong data-ar-debug-tracked>false</strong></p><p>targetFound次数 <strong data-ar-debug-found>0</strong></p><p>targetLost次数 <strong data-ar-debug-lost>0</strong></p><p>丢失持续 <strong data-ar-debug-lost-duration>0 ms</strong></p><p>恢复状态 <strong data-ar-debug-resume>—</strong></p><p>Canvas保留 <strong data-ar-debug-canvas>true</strong></p><p>MindAR状态 <strong data-ar-debug-mindar>AR_NOT_STARTED</strong></p></aside>`
  if (mode === 'explode') return `<aside class="debug-panel explode-debug-panel ar-debug-panel"><p>爆炸状态 <strong data-debug-explode-state>EXPLODE_VIEW</strong></p><p>选中层 <strong data-debug-explode-selected>—</strong></p><p>展开进度 <strong data-debug-explode-progress>0%</strong></p><p>panelSurfaceZ <strong data-debug-explode-panel>${config.explodedView.panelSurfaceZ}</strong></p><p>frontDirectionSign <strong data-debug-explode-sign>${config.explodedView.frontDirectionSign}</strong></p><p>视差旋转 <strong data-debug-parallax>0, 0</strong></p><p>输入坐标 <strong data-debug-parallax-input>0, 0</strong></p><p data-debug-explode-warning>等待图层状态</p><pre data-debug-explode-layers></pre><p>可点击范围（屏幕 px）</p><pre data-debug-explode-click-bounds></pre></aside>`
  if (mode === 'stabilize') return `<aside class="debug-panel ar-debug-panel stabilize-debug"><p>rawTargetPosition <strong data-stable-raw-position>—</strong></p><p>stableAnchorPosition <strong data-stable-position>—</strong></p><p>rawQuaternion <strong data-stable-raw-quaternion>—</strong></p><p>stableQuaternion <strong data-stable-quaternion>—</strong></p><p>rawTargetScale <strong data-stable-raw-scale>—</strong></p><p>stableAnchorScale <strong data-stable-scale>—</strong></p><p>scaleDelta <strong data-stable-scale-delta>0</strong></p><p>positionDelta <strong data-stable-position-delta>0</strong></p><p>rotationDeltaDeg <strong data-stable-rotation-delta>0</strong></p><p>positionLerp <strong>${config.ar.trackingSmoothing.positionLerp}</strong></p><p>rotationSlerp <strong>${config.ar.trackingSmoothing.rotationSlerp}</strong></p><p>scaleLerp <strong>${config.ar.trackingSmoothing.scaleLerp}</strong></p><p>targetTracked <strong data-stable-tracked>false</strong></p><p>stableAnchorExists <strong data-stable-exists>false</strong></p><p>stableAnchorVisible <strong data-stable-visible>false</strong></p><p>stableAnchorParent <strong data-stable-parent>—</strong></p><p>stableAnchorParentScale <strong data-stable-parent-scale>—</strong></p><p>rawPoseValid <strong data-stable-pose-valid>false</strong></p><p>rawScaleValid <strong data-stable-scale-valid>false</strong></p><p>firstValidFullTransformReceived <strong data-stable-first-transform>false</strong></p><p>panelHingeVisible <strong data-stable-hinge-visible>false</strong></p><p>panelContentVisible <strong data-stable-content-visible>false</strong></p><p>craftPanelVisible <strong data-stable-panel-visible>false</strong></p><p>craftCanvasVisible <strong data-stable-canvas-visible>false</strong></p><p>lostHoldRemaining <strong data-stable-lost-hold>0 ms</strong></p><p class="ar-scale-warning" data-stable-scale-warning hidden>AR content scale is too small</p></aside>`
  if (mode === 'state') return `<aside class="debug-panel state-debug-panel ar-debug-panel"><p>AR状态 <strong data-debug-ar-state>AR_NOT_STARTED</strong></p><p>当前制作状态 <strong data-debug-current-state>LINEART</strong></p><p>上一个状态 <strong data-debug-previous-state>—</strong></p><p>bambooProgress <strong data-debug-state-bamboo>0%</strong></p><p>paperProgress <strong data-debug-state-paper>0%</strong></p><p>paintProgress <strong data-debug-state-paint>0%</strong></p><p>完成状态 <strong data-debug-completed>false</strong></p><p>page1存储字段 <strong data-debug-storage>—</strong></p><p>旧字段已清理 <strong data-debug-storage-cleaned>false</strong></p><p>需要重新点击竹篾 <strong data-debug-requires-bamboo>true</strong></p></aside>`
  return ''
}

export function renderArPage1(root) {
  root.__page1Cleanup?.()
  const config = PAGE1_PREVIEW_CONFIG
  const params = new URLSearchParams(window.location.search)
  const debugMode = ['hotspot', 'tilt', 'panel', 'tracking', 'state', 'hints', 'explode', 'stabilize'].includes(params.get('debug'))
    ? params.get('debug')
    : null
  const page2Debug = params.get('debug') === '1' && params.get('ar') === 'page2'
  const page3Debug = params.get('debug') === '1' && params.get('ar') === 'page3'
  const layoutTunerEnabled = params.get('layout') === '1'
  const activeRoute = resolveActiveRoute()
  const page1Entry = activeRoute === AR_ROUTES.PAGE1
  const page2Entry = activeRoute === AR_ROUTES.PAGE2
  const page3Entry = activeRoute === AR_ROUTES.PAGE3
  const collectionMode = activeRoute === AR_ROUTES.COLLECTION
  const page1Enabled = collectionMode || page1Entry
  const mindarTuning = `; warmupTolerance: ${PAGE2_CONFIG.mindar.warmupTolerance}; missTolerance: ${PAGE2_CONFIG.mindar.missTolerance}; filterMinCF: ${PAGE2_CONFIG.mindar.filterMinCF}; filterBeta: ${PAGE2_CONFIG.mindar.filterBeta}`
  const aspect = config.ar.markerAspectFallback
  const panelConfig = config.ar.arPanel
  const initialPanelMode = panelConfig.modes.vertical
  const panelStartRotation = [0, 0, 0]
  const panelHingePosition = [initialPanelMode.hingePosition.x, initialPanelMode.hingePosition.y, initialPanelMode.hingePosition.z]
  const panelContentPosition = [initialPanelMode.contentPosition.x, initialPanelMode.contentPosition.y, initialPanelMode.contentPosition.z]
  const abortController = new AbortController()
  const { signal } = abortController
  const arBridge = {}
  let page2Assets = ''
  let page2Scene = ''
  let page2Ui = ''
  let page3Assets = ''
  let page3Scene = ''
  let page3Ui = ''

  if (page2Entry) try {
    page2Assets = page2AssetsMarkup(PAGE2_CONFIG)
    page2Scene = page2SceneMarkup(PAGE2_CONFIG, page2Debug)
    page2Ui = page2UiMarkup(PAGE2_CONFIG, page2Debug)
  } catch (error) {
    console.error('[page2] Scene markup disabled; Page1 remains available.', error)
  }
  else if (collectionMode) {
    page2Scene = `<a-entity id="page2-target" mindar-image-target="targetIndex: ${PAGE2_CONFIG.targetIndex}"></a-entity>`
  }
  if (page3Entry) try {
    page3Assets = page3AssetsMarkup(PAGE3_CONFIG)
    page3Scene = page3SceneMarkup(PAGE3_CONFIG, page3Debug)
    page3Ui = page3UiMarkup(PAGE3_CONFIG, page3Debug)
  } catch (error) {
    console.error('[page3] Scene markup disabled; existing pages remain available.', error)
  }
  else if (collectionMode) {
    page3Scene = `<a-entity id="page3-target" mindar-image-target="targetIndex: ${PAGE3_CONFIG.targetIndex}"></a-entity>`
  }

  let legacyStorageCleaned = false
  try {
    config.legacyStorageKeys.forEach((key) => localStorage.removeItem(key))
    if (params.get('reset') === '1') localStorage.removeItem(config.storageKey)
    legacyStorageCleaned = true
  } catch {
    // 存储不可用不阻塞AR启动。
  }

  const page1ImageSource = (path) =>
    page1Entry ? `src="${path}"` : `data-page1-src="${path}"`

  root.innerHTML = `
    <main class="page1-preview page1-ar${page2Entry ? ' is-page2-route' : ''}${page3Entry ? ' is-page3-route' : ''}"
      data-app-state="${APP_AR_STATES.LANDING}" data-active-target="-1"
      style="--color-mask-url: ${page1Entry ? `url('${config.assets.colorMask}')` : 'none'}">
      <div class="ar-runtime-assets" hidden>
        <img id="craft-panel-asset" ${page1ImageSource(config.assets.backgroundBoard)} alt="" draggable="false" />
        <img id="page1-floor-asset" ${page1ImageSource(config.assets.floorBase)} alt="" draggable="false" crossorigin="anonymous" />
        <img id="page1-title-asset" ${page1ImageSource(config.assets.titleImage)} alt="" draggable="false" crossorigin="anonymous" />
        <img id="page1-color-mask-asset" data-page1-src="${config.assets.colorMask}" alt="" draggable="false" />
        <img id="badge-bamboo" data-page1-src="${config.assets.badge}" alt="" draggable="false" />
        ${config.assets.craftLayers.map((layer, index) =>
          `<img id="explode-${layer.id}" ${index === 0 ? page1ImageSource(layer.path) : `data-page1-src="${layer.path}"`} alt="" draggable="false" />`,
        ).join('')}
        <canvas id="${config.canvas.id}" width="${config.canvas.width}" height="${config.canvas.height}"></canvas>
        <div class="page2-preload-assets">${page2Assets}</div>
        <div class="page3-preload-assets">${page3Assets}</div>
      </div>
      <a-scene id="page1-ar-scene" class="preview-scene ar-scene" embedded
        mindar-image="imageTargetSrc: ${config.ar.targetSrc}; autoStart: false; uiLoading: no; uiScanning: no; uiError: no${mindarTuning}"
        renderer="antialias: true; colorManagement: true; alpha: true"
        vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false"
        loading-screen="enabled: false">
        <a-camera position="0 0 0" camera="near: 0.01; far: 1000" look-controls="enabled: false" wasd-controls="enabled: false"></a-camera>
        <a-entity id="page1-target" mindar-image-target="targetIndex: ${config.ar.targetIndex}">
          <a-plane id="marker-touch-plane" width="1" height="${aspect}" position="0 0 0.004"
            material="transparent: true; opacity: 0; side: double"></a-plane>
          <a-plane id="marker-hotspot-visual" visible="false"
            material="color: #d7a64a; opacity: 0.82; transparent: true; wireframe: true; side: double"></a-plane>
        </a-entity>

        <a-entity id="stableAnchor" visible="false">
          <a-image id="page1-floor-base" ${page1Entry ? 'src="#page1-floor-asset"' : ''}
            width="${config.ar.floor.width}" height="${config.ar.floor.height}"
            position="${vector(config.ar.floor.position)}" rotation="${vector(config.ar.floor.rotation)}"
            scale="${vector(config.ar.floor.scale)}" data-render-order="${config.ar.floor.renderOrder}"
            material="shader: flat; transparent: true; alphaTest: 0.005; opacity: ${config.ar.floor.opacity}; depthWrite: true; depthTest: true; side: double"
            visible="false"></a-image>
          <a-entity id="panelHinge" position="${vector(panelHingePosition)}"
            rotation="${vector(panelStartRotation)}" visible="false">
            <a-entity id="panelContent" position="${vector(panelContentPosition)}"
              scale="${panelConfig.baseScale * initialPanelMode.scale} ${panelConfig.baseScale * initialPanelMode.scale} ${panelConfig.baseScale * initialPanelMode.scale}">
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
              ${imageEntity('craft-panel-asset', config.backgroundBoard, 'id="craft-panel-surface" data-render-order="0"', page1Entry, false)}
              ${imageEntity('page1-title-asset', config.titleImage, 'id="page1-title-image" data-render-order="1" visible="false"', page1Entry)}
              <a-plane id="craft-plane" position="${vector(config.craftPlane.position)}"
                rotation="${vector(config.craftPlane.rotation)}" width="${config.craftPlane.size.width}"
                height="${config.craftPlane.size.height}"
                material="src: #${config.canvas.id}; transparent: true; alphaTest: 0.01; depthWrite: false; depthTest: false; side: double; shader: flat"
                visible="false"></a-plane>
              <a-image id="bamboo-badge" position="${vector(config.badge.position)}"
                rotation="${vector(config.badge.rotation)}" width="${config.badge.size.width}"
                height="${config.badge.size.height}" scale="0.6 0.6 0.6"
                material="transparent: true; alphaTest: 0.01; depthWrite: true; depthTest: true; side: double; shader: flat"
                visible="false"></a-image>
              ${explodedGroup(config.explodedView, page1Entry)}
            </a-entity>
          </a-entity>
        </a-entity>
        ${page2Scene}
        ${page3Scene}
      </a-scene>

      <header class="project-title" aria-label="项目标题">
        <strong>龙脉铜梁</strong>
        <span>铜梁火龙非遗AR互动体验设计</span>
      </header>
      <header class="page-title page1-module-title"><span>01</span><h1>竹骨成龙</h1></header>
      <div class="craft-stamps" aria-label="工艺进度印记">
        ${config.craftStamps.labels.map((label, index) => `<span data-craft-stamp="${index}" class="${index === 0 ? 'is-current' : ''}">${label}</span>`).join('')}
      </div>
      ${arDebugPanel(debugMode, config)}
      ${page2Ui}
      ${page3Ui}
      ${sharedModuleUiMarkup()}

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

      <section class="step-card" aria-labelledby="step-title">
        <p class="step-number">${config.copy.steps.lineart.number}</p>
        <h2 id="step-title">${config.copy.steps.lineart.title}</h2>
        <p class="step-description">${config.copy.steps.lineart.description}</p>
        <p class="step-hint"><span>操作提示</span>点击识别图左下角竹篾，完成起稿准备。</p>
        <div class="card-actions">
          <button type="button" data-card-action="review" hidden>查看工艺总览</button>
          <button type="button" data-card-action="restart" hidden>重新体验</button>
          <button type="button" data-card-action="end" hidden>结束预览</button>
        </div>
        <p class="preview-end-notice" role="status" hidden></p>
      </section>

      <section class="ar-start-screen ar-overlay-card">
        <p>扫描任意识别卡，进入对应AR体验</p>
        <div class="entry-module-tags" aria-label="体验内容"><span>制作</span><i>·</i><span>探源</span><i>·</i><span>表演</span></div>
        <button type="button" data-ar-action="start">开启AR体验</button>
      </section>
      <section class="ar-waiting-screen" role="status" hidden>
        <strong>请扫描识别卡</strong>
        <small>扫描成功后请保持手机与识别卡垂直，以获得更好的体验</small>
      </section>
      <p class="ar-scan-status" role="status" hidden></p>
      ${params.get('debug') === '1' ? `<aside class="debug-panel app-debug-panel">
        <p>appState <strong data-app-debug-state>${APP_AR_STATES.LANDING}</strong></p>
        <p>activeTargetIndex <strong data-app-debug-target>-1</strong></p>
        <p>activeModule <strong data-app-debug-module>—</strong></p>
        <p>cameraPermissionGranted <strong data-app-debug-camera>false</strong></p>
        <p>waitingScanUIVisible <strong data-app-debug-waiting>false</strong></p>
        <p>page1FloorTextureReady <strong data-app-debug-page1-floor>false</strong></p>
        <p>page1FloorMounted <strong data-app-debug-page1-mounted>false</strong></p>
        <p>page1FloorVisible <strong data-app-debug-page1-visible>false</strong></p>
        <p>page1FloorWorldPosition <strong data-app-debug-page1-position>—</strong></p>
        <p>page1FloorRotation <strong data-app-debug-page1-rotation>—</strong></p>
        <p>page1BoardFloorAngle <strong data-app-debug-page1-angle>—</strong></p>
        <p>page2FloorTextureReady <strong data-app-debug-page2-floor>false</strong></p>
        <p>page2FloorMounted <strong data-app-debug-page2-mounted>false</strong></p>
        <p>page2FloorVisible <strong data-app-debug-page2-visible>false</strong></p>
        <p>page2FloorWorldPosition <strong data-app-debug-page2-position>—</strong></p>
        <p>page2FloorRotation <strong data-app-debug-page2-rotation>—</strong></p>
        <p>page2BoardFloorAngle <strong data-app-debug-page2-angle>—</strong></p>
        <p>page3BoardFloorAngle <strong data-app-debug-page3-angle>—</strong></p>
        <pre data-app-debug-extended>等待运行数据</pre>
      </aside>` : ''}
      <section class="ar-lost-dialog ar-overlay-card" role="dialog" hidden>
        <h2>识别卡已离开画面</h2>
        <p>当前制作进度已保存，请重新对准识别卡。</p>
        <div><button type="button" data-ar-action="continue-current">继续当前体验</button><button type="button" data-ar-action="return-scan">返回扫描</button></div>
      </section>
      <section class="ar-error-panel ar-overlay-card" role="alert" hidden>
        <p></p><button type="button" data-ar-action="restart-camera">重新开启摄像头</button>
      </section>
    </main>
  `

  const scene = root.querySelector('#page1-ar-scene')
  const target = root.querySelector('#page1-target')
  let page2Target = root.querySelector('#page2-target')
  let page2Anchor = root.querySelector('#page2-anchor')
  let page2Preloader = page2Entry ? createPage2Preloader({ root, config: PAGE2_CONFIG, debug: page2Debug }) : null
  let page3Target = root.querySelector('#page3-target')
  let page3Anchor = root.querySelector('#page3-anchor')
  let page3Preloader = page3Entry ? createPage3Preloader({ root, config: PAGE3_CONFIG, debug: page3Debug }) : null
  const stableAnchor = root.querySelector('#stableAnchor')
  const preview = root.querySelector('.page1-ar')
  const page1FloorImage = root.querySelector('#page1-floor-asset')
  const page1Floor = root.querySelector('#page1-floor-base')
  const page1TitleImage = root.querySelector('#page1-title-asset')
  const page1TitleEntity = root.querySelector('#page1-title-image')
  const panelHinge = root.querySelector('#panelHinge')
  const panelContent = root.querySelector('#panelContent')
  const craftPanel = root.querySelector('#craft-panel-surface')
  const craftPlane = root.querySelector('#craft-plane')
  const markerPlane = root.querySelector('#marker-touch-plane')
  const hotspotVisual = root.querySelector('#marker-hotspot-visual')
  const startActionButton = root.querySelector('[data-ar-action="start"]')
  const sharedModuleUi = createSharedModuleUi({ root, signal })
  const layoutTuner = layoutTunerEnabled
    ? createArLayoutTuner({ root, scene, signal })
    : null
  let arState = AR_PAGE1_STATES.AR_NOT_STARTED
  let resumeArState = AR_PAGE1_STATES.AR_NOT_STARTED
  let arReady = false
  let craftStarted = false
  let controllersReady = false
  let hotspot = null
  let panelController = null
  let stableAnchorController = null
  let lifecycle = null
  let page2Controller = null
  let page3Controller = null
  let cameraStartRequested = false
  let cameraStartPromise = null
  let cameraStarted = false
  let cameraPermissionGranted = false
  let appState = APP_AR_STATES.LANDING
  let activeTargetIndex = -1
  let page1FloorReady = false
  let page1FloorReadyPromise = null
  let page1TitleReady = false
  let page1PendingEnter = false
  let page1FoundationVisibleRequested = false
  let page1FirstVisualFrameReady = false
  let page1FirstVisualGatePromise = null
  let page1CriticalSnapshot = { criticalProgress: 0, criticalReady: false, criticalFailed: false }
  let page1ActivationId = 0
  let retryPage1Critical = () => Promise.resolve(null)
  const page1DebugCounters = {
    page1TargetFoundCount: 0,
    page1TargetLostCount: 0,
    stableAnchorVisibleChangeCount: 0,
    page1FloorVisibleChangeCount: 0,
    page1BackgroundVisibleChangeCount: 0,
    lineartLoadAttemptCount: 0,
  }
  let appDebugTimer = null
  const angleWarnings = new Set()
  let markerAspect = aspect
  let bambooClicked = false
  let panelReady = false
  let pendingPanelRise = false
  let liftGuideTimer = null
  let stableDebugState = null
  let panelDebugState = {
    progress: 0,
    rotation: panelStartRotation,
    targetRotation: [
      initialPanelMode.endRotation.x * panelConfig.frontDirectionSign,
      initialPanelMode.endRotation.y,
      initialPanelMode.endRotation.z,
    ],
  }

  const setAppState = (nextState, targetIndex = activeTargetIndex) => {
    appState = nextState
    activeTargetIndex = nextState === APP_AR_STATES.MODULE_ACTIVE ? targetIndex : -1
    preview.dataset.appState = nextState
    preview.dataset.activeTarget = String(activeTargetIndex)
    preview.classList.toggle('is-page1-active', activeTargetIndex === 0)
    preview.classList.toggle('is-page2-active', activeTargetIndex === 1)
    preview.classList.toggle('is-page3-active', activeTargetIndex === 2)
    root.querySelector('[data-app-debug-state]')?.replaceChildren(nextState)
    root.querySelector('[data-app-debug-target]')?.replaceChildren(String(activeTargetIndex))
    if (nextState === APP_AR_STATES.MODULE_ACTIVE) sharedModuleUi.activate(activeTargetIndex)
    else sharedModuleUi.deactivate()
  }

  const ensureAFrameImageReady = async (image, entity, path, reportStage = () => {}) => {
    await loadImageElement(image, path, {
      onLoaded: () => reportStage('loaded'),
      onRequest: () => {
        if (path === config.assets.craftLayers[0].path) page1DebugCounters.lineartLoadAttemptCount += 1
      },
    })
    reportStage('decoded')
    if (!scene.hasLoaded) await new Promise((resolve) => scene.addEventListener('loaded', resolve, { once: true }))
    if (!entity.object3D?.parent) throw new Error(`实体尚未挂载：${path}`)
    const transform = entity.object3D
    if (
      [...transform.position.toArray(), ...transform.scale.toArray()].some((value) => !Number.isFinite(value)) ||
      transform.scale.toArray().some((value) => Math.abs(value) <= 1e-6)
    ) throw new Error(`实体transform无效：${path}`)
    await prepareAFrameImageTexture({
      scene,
      entity,
      image,
      assetKey: path,
    })
    reportStage('gpuReady')
    return true
  }

  const ensurePage1FloorReady = (reportStage) => {
    if (page1FloorReady) return Promise.resolve(true)
    if (page1FloorReadyPromise) return page1FloorReadyPromise
    page1FloorReadyPromise = ensureAFrameImageReady(page1FloorImage, page1Floor, config.assets.floorBase, reportStage)
      .then(() => {
        page1FloorReady = true
        root.querySelector('[data-app-debug-page1-floor]')?.replaceChildren('true')
        return true
      })
      .catch((error) => {
        page1FloorReadyPromise = null
        throw error
      })
    return page1FloorReadyPromise
  }

  const page1Loader = createModuleAssetLoader({
    modules: {
      page1: {
        criticalAssets: [
          {
            key: 'background',
            path: config.assets.backgroundBoard,
            load: (reportStage) => ensureAFrameImageReady(
              root.querySelector('#craft-panel-asset'),
              craftPanel,
              config.assets.backgroundBoard,
              reportStage,
            ),
          },
          { key: 'floor', path: config.assets.floorBase, load: ensurePage1FloorReady },
          {
            key: 'title',
            path: config.assets.titleImage,
            load: (reportStage) => ensureAFrameImageReady(
              page1TitleImage,
              page1TitleEntity,
              config.assets.titleImage,
              reportStage,
            ).then(() => {
              page1TitleReady = true
            }),
          },
          {
            key: 'lineart',
            path: config.assets.craftLayers[0].path,
            load: (reportStage) => loadImageElement(
              root.querySelector('#explode-lineart'),
              config.assets.craftLayers[0].path,
              {
                onLoaded: () => reportStage('loaded'),
                onRequest: () => {
                  page1DebugCounters.lineartLoadAttemptCount += 1
                },
              },
            ).then((image) => {
              reportStage('decoded')
              root.querySelector('[data-explode-layer="lineart"]')?.setAttribute('src', '#explode-lineart')
              return image
            }),
            validate: () => Boolean(craftPlane?.object3D?.parent),
          },
        ],
        nextStepAssets: [
          {
            key: 'bamboo',
            stepId: 'bamboo',
            path: config.assets.craftLayers[1].path,
            load: () => loadImageElement(root.querySelector('#explode-bamboo'), config.assets.craftLayers[1].path)
              .then(() => root.querySelector('[data-explode-layer="bamboo"]')?.setAttribute('src', '#explode-bamboo')),
          },
          ...config.assets.craftLayers.slice(2).map((layer) => ({
            key: layer.id,
            stepId: layer.id === 'paper' ? 'paper' : 'paint',
            path: layer.path,
            load: () => loadImageElement(root.querySelector(`#explode-${layer.id}`), layer.path)
              .then(() => root.querySelector(`[data-explode-layer="${layer.id}"]`)?.setAttribute('src', `#explode-${layer.id}`)),
          })),
          {
            key: 'colorMask',
            stepId: 'paint',
            path: config.assets.colorMask,
            load: () => loadImageElement(root.querySelector('#page1-color-mask-asset'), config.assets.colorMask),
          },
        ],
        laterAssets: [
          {
            key: 'badge',
            path: config.assets.badge,
            load: () => ensureAFrameImageReady(root.querySelector('#badge-bamboo'), badge, config.assets.badge),
          },
        ],
      },
    },
    onChange(moduleId, snapshot) {
      if (moduleId !== 'page1') return
      page1CriticalSnapshot = snapshot
      if (page1PendingEnter) {
        const establishingVisual = snapshot.criticalReady && !snapshot.criticalFailed
        sharedModuleUi.showLoading({
          targetIndex: 0,
          title: '正在加载《竹骨成龙》',
          progress: establishingVisual ? 99 : Math.min(99, snapshot.criticalProgress),
          stage: establishingVisual ? 'scene' : snapshot.currentStage,
          currentPath: snapshot.currentAssetPath,
          failed: snapshot.criticalFailed,
          onRetry: () => retryPage1Critical(),
        })
      }
    },
  })

  const startPage1FirstVisualFrameGate = (activationId) => {
    if (page1FirstVisualFrameReady) return Promise.resolve(true)
    if (page1FirstVisualGatePromise) return page1FirstVisualGatePromise
    page1FoundationVisibleRequested = true
    const lineartEntity = root.querySelector('[data-explode-layer="lineart"]')
    const textureEntities = [craftPanel, page1Floor, page1TitleEntity, lineartEntity]
      .filter(Boolean)
      .map((entity) => ({ entity, requireVisible: false }))
    const initialVisualEntity = craftStarted
      ? craftPlane
      : bambooClicked
        ? craftPanel
        : hotspotVisual
    page1FirstVisualGatePromise = waitForFirstVisualFrame({
      sceneEl: scene,
      entities: [
        ...textureEntities,
        {
          entity: initialVisualEntity,
          requireTexture: initialVisualEntity !== hotspotVisual,
          requireOpacity: initialVisualEntity !== hotspotVisual,
        },
      ],
      isAnchorVisible: () => stableAnchor?.object3D?.visible !== false,
      isActive: () => !signal.aborted && activationId === page1ActivationId,
      signal,
    }).then((ready) => {
      if (!ready || activationId !== page1ActivationId) return false
      page1FirstVisualFrameReady = true
      page1PendingEnter = false
      sharedModuleUi.completeLoading(0)
      updateAppDebug()
      return true
    }).finally(() => {
      if (activationId === page1ActivationId) page1FirstVisualGatePromise = null
    })
    return page1FirstVisualGatePromise
  }

  const updateAppDebug = () => {
    if (params.get('debug') !== '1') return
    const THREE = window.AFRAME?.THREE
    const page2State = page2Controller?.getState?.()
    const page3State = page3Controller?.getState?.()
    const page2FloorReady = page2State?.floorBase?.textureReady ?? false
    const page3FloorReady = page3State?.foundation?.floorTextureReady ?? false
    const waitingVisible = !root.querySelector('.ar-waiting-screen')?.hidden
      && getComputedStyle(root.querySelector('.ar-waiting-screen')).display !== 'none'
    const moduleNames = { 0: '01 竹骨成龙', 1: '02 龙脉探源', 2: '03 火舞夜空' }
    const formatVector = (values) => values?.every(Number.isFinite)
      ? values.map((value) => value.toFixed(3)).join(', ')
      : '—'
    const inspectEntity = (floorEntity, boardEntity, anchorId) => {
      if (!THREE || !floorEntity?.object3D || !boardEntity?.object3D) {
        return { mounted: false, visible: false, position: null, rotation: null, angle: null }
      }
      const position = new THREE.Vector3()
      floorEntity.object3D.getWorldPosition(position)
      const rotation = floorEntity.object3D.rotation
      const mounted = Boolean(floorEntity.closest(`#${anchorId}`))
      let node = floorEntity
      let visible = true
      while (node && node !== root) {
        if (node.object3D?.visible === false || node.getAttribute?.('visible') === false) visible = false
        node = node.parentElement
      }
      const floorNormal = new THREE.Vector3(0, 0, 1)
      const boardNormal = new THREE.Vector3(0, 0, 1)
      floorNormal.applyQuaternion(floorEntity.object3D.getWorldQuaternion(new THREE.Quaternion())).normalize()
      boardNormal.applyQuaternion(boardEntity.object3D.getWorldQuaternion(new THREE.Quaternion())).normalize()
      const angle = THREE.MathUtils.radToDeg(floorNormal.angleTo(boardNormal))
      return {
        mounted,
        visible,
        position: position.toArray(),
        rotation: [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg),
        angle: Number.isFinite(angle) ? angle : null,
      }
    }
    const page1Info = inspectEntity(page1Floor, craftPanel, 'stableAnchor')
    const page2Info = inspectEntity(
      root.querySelector('#page2-floor-base'),
      root.querySelector('#page2-background-plane'),
      'page2-anchor',
    )
    const page3Info = inspectEntity(
      root.querySelector('#page3-floor-plane'),
      root.querySelector('#page3-background-plane'),
      'page3-anchor',
    )
    const angleLabel = (value) => Number.isFinite(value) ? `${value.toFixed(1)}°` : '—'
    ;[
      ['page1', 0, page1Info, panelReady],
      ['page2', 1, page2Info, ['PAGE2_OVERVIEW', 'PAGE2_MODEL', 'PAGE2_COMPLETE'].includes(page2State?.state)],
      ['page3', 2, page3Info, !['PAGE3_HIDDEN', 'PAGE3_LOADING'].includes(page3State?.state)],
    ].forEach(([name, targetIndex, info, settled]) => {
      const invalidTransform = [...(info.position || []), ...(info.rotation || [])].some((value) => !Number.isFinite(value))
      if (invalidTransform && !angleWarnings.has(`${name}-transform`)) {
        angleWarnings.add(`${name}-transform`)
        console.warn(`[${name}] Floor transform contains NaN/invalid values`, info)
      }
      if (settled && appState === APP_AR_STATES.MODULE_ACTIVE && activeTargetIndex === targetIndex
        && Number.isFinite(info.angle) && (info.angle < 80 || info.angle > 100) && !angleWarnings.has(name)) {
        angleWarnings.add(name)
        console.warn(`[${name}] Background/floor angle outside 80°–100°`, info.angle)
      }
    })
    root.querySelector('[data-app-debug-camera]')?.replaceChildren(String(cameraPermissionGranted))
    root.querySelector('[data-app-debug-waiting]')?.replaceChildren(String(waitingVisible))
    root.querySelector('[data-app-debug-module]')?.replaceChildren(moduleNames[activeTargetIndex] || '—')
    root.querySelector('[data-app-debug-page1-floor]')?.replaceChildren(String(page1FloorReady))
    root.querySelector('[data-app-debug-page1-mounted]')?.replaceChildren(String(page1Info.mounted))
    root.querySelector('[data-app-debug-page1-visible]')?.replaceChildren(String(page1Info.visible))
    root.querySelector('[data-app-debug-page1-position]')?.replaceChildren(formatVector(page1Info.position))
    root.querySelector('[data-app-debug-page1-rotation]')?.replaceChildren(formatVector(page1Info.rotation))
    root.querySelector('[data-app-debug-page1-angle]')?.replaceChildren(angleLabel(page1Info.angle))
    root.querySelector('[data-app-debug-page2-floor]')?.replaceChildren(String(page2FloorReady))
    root.querySelector('[data-app-debug-page2-mounted]')?.replaceChildren(String(page2Info.mounted))
    root.querySelector('[data-app-debug-page2-visible]')?.replaceChildren(String(page2Info.visible))
    root.querySelector('[data-app-debug-page2-position]')?.replaceChildren(formatVector(page2Info.position))
    root.querySelector('[data-app-debug-page2-rotation]')?.replaceChildren(formatVector(page2Info.rotation))
    root.querySelector('[data-app-debug-page2-angle]')?.replaceChildren(angleLabel(page2Info.angle))
    root.querySelector('[data-app-debug-page3-angle]')?.replaceChildren(
      `${angleLabel(page3Info.angle)} / floorReady ${page3FloorReady}`,
    )
    const activeState = activeTargetIndex === 0
      ? arBridge.getSnapshot?.()
      : activeTargetIndex === 1
        ? page2State
        : activeTargetIndex === 2
          ? page3State
          : null
    const activePreload = activeTargetIndex === 0
      ? page1CriticalSnapshot
      : activeState?.preload || null
    const rootEntity = activeTargetIndex === 0
      ? stableAnchor
      : activeTargetIndex === 1
        ? root.querySelector('#page2-anchor')
        : activeTargetIndex === 2
          ? root.querySelector('#page3-anchor')
          : null
    const isVisible = (entity) => {
      let node = entity
      while (node && node !== root) {
        if (node.object3D?.visible === false || node.getAttribute?.('visible') === false) return false
        node = node.parentElement
      }
      return Boolean(entity?.object3D)
    }
    const page1Progress = page1CriticalSnapshot
    const page2Progress = page2State?.preload || {}
    const page3Progress = page3State?.preload || {}
    const page1RootMounted = Boolean(stableAnchor?.object3D?.parent)
    const page2Root = root.querySelector('#page2-anchor')
    const page3Root = root.querySelector('#page3-anchor')
    const page2OverviewRoot = root.querySelector('#page2-overview-root')
    const p3Video = root.querySelector('#page3-dragon-video')
    const p3IronVideo = root.querySelector('#page3-ironflower-video')
    const extended = {
      build: typeof __BUILD_META__ === 'undefined' ? null : __BUILD_META__,
      baseUrl: import.meta.env.BASE_URL,
      activeRoute,
      mobileAssets: activeTargetIndex === 0
        ? Boolean(config.mobileAssets)
        : activeTargetIndex === 1
          ? Boolean(PAGE2_CONFIG.mobileAssets)
          : activeTargetIndex === 2
            ? Boolean(PAGE3_CONFIG.mobileAssets)
            : false,
      criticalAssetPaths: activeTargetIndex === 0
        ? [
            config.assets.backgroundBoard,
            config.assets.floorBase,
            config.assets.titleImage,
            config.assets.craftLayers[0].path,
          ]
        : activeTargetIndex === 1
          ? ['floor', 'background', 'title', 'mainBase'].map((key) => PAGE2_CONFIG.assets[key])
          : activeTargetIndex === 2
            ? ['background', 'floor', 'title', 'drum'].map((key) => PAGE3_CONFIG.assets[key])
            : [],
      failedStage: activePreload?.failedStage || activePreload?.currentStage || '',
      ...page1DebugCounters,
      currentModule: moduleNames[activeTargetIndex] || null,
      currentState: activeState?.currentState || activeState?.state || arState,
      activeTargetIndex,
      pendingTargetIndex: page1PendingEnter
        ? 0
        : page2State?.pendingEnter
          ? 1
          : page3State?.pendingEnter
            ? 2
            : -1,
      targetFoundCount: lifecycle?.getState?.().foundCount ?? null,
      targetLostCount: lifecycle?.getState?.().lostCount ?? null,
      targetFound: activeState?.tracked ?? lifecycle?.isTracked?.() ?? false,
      targetLost: activeTargetIndex >= 0 && !(activeState?.tracked ?? lifecycle?.isTracked?.() ?? false),
      criticalProgress: Math.round(activePreload?.criticalProgress ?? activePreload?.progress ?? 0),
      criticalReady: Boolean(activePreload?.criticalReady),
      criticalGpuReady: Boolean(activePreload?.criticalReady),
      criticalFailed: Boolean(activePreload?.criticalFailed || activePreload?.targetFailed),
      foundationVisibleRequested: activeTargetIndex === 0
        ? page1FoundationVisibleRequested
        : Boolean(activeState?.foundationVisibleRequested),
      firstVisualFrameReady: activeTargetIndex === 0
        ? page1FirstVisualFrameReady
        : Boolean(activeState?.firstVisualFrameReady),
      pendingEnter: Boolean(page1PendingEnter || activeState?.pendingEnter),
      rootMounted: Boolean(rootEntity?.object3D?.parent),
      rootVisible: Boolean(rootEntity?.object3D?.visible && rootEntity?.getAttribute('visible') !== false),
      page1CriticalProgress: Math.round(page1Progress.criticalProgress || 0),
      page2CriticalProgress: Math.round(page2Progress.criticalProgress || page2Progress.progress || 0),
      page3CriticalProgress: Math.round(page3Progress.criticalProgress || 0),
      page1CriticalReady: Boolean(page1Progress.criticalReady),
      page2CriticalReady: Boolean(page2Progress.criticalReady),
      page3CriticalReady: Boolean(page3Progress.criticalReady),
      page2RequestCount: page2Progress.requestedCount || 0,
      page3RequestCount: page3Progress.requestCount || 0,
      page2GpuReadyCount: page2Progress.gpuReadyCount || 0,
      page3GpuReadyCount: page3Progress.gpuReadyCount || 0,
      page2CurrentLoadingPath: page2Progress.currentLoadingPath || '',
      page3CurrentLoadingPath: page3Progress.currentLoadingPath || '',
      page2MobileAssets: Boolean(page2Progress.mobileAssets),
      page3MobileAssets: Boolean(page3Progress.mobileAssets),
      page2Timing: page2Progress.timing || null,
      page3Timing: page3Progress.timing || null,
      page1PendingEnter,
      page2PendingEnter: Boolean(page2State?.pendingEnter),
      page3PendingEnter: Boolean(page3State?.pendingEnter),
      page1RootMounted,
      page2RootMounted: Boolean(page2Root?.object3D?.parent),
      page3RootMounted: Boolean(page3Root?.object3D?.parent),
      page1RootVisible: isVisible(stableAnchor),
      page2RootVisible: isVisible(page2Root),
      page3RootVisible: isVisible(page3Root),
      page1LowerLeftHotspotVisible: Boolean(!bambooClicked && activeTargetIndex === 0 && !root.querySelector('.ar-hotspot-label')?.hidden),
      page1MiddleHotspotExists: false,
      page1BackgroundVisible: isVisible(craftPanel),
      page1FloorVisible: isVisible(page1Floor),
      page1TitleImageVisible: isVisible(page1TitleEntity),
      page1OverviewLayerGap: {
        local: config.explodedView.layerGap,
        world: config.explodedView.layerGap * panelConfig.baseScale * initialPanelMode.scale,
      },
      page2BackgroundVisible: isVisible(root.querySelector('#page2-background-plane')),
      page2FloorVisible: isVisible(root.querySelector('#page2-floor-base')),
      page2FirstScreenVisible: isVisible(page2OverviewRoot),
      page2ModelLoaded: Boolean(page2State?.page2ModelLoaded),
      page3BackgroundVisible: isVisible(root.querySelector('#page3-background-plane')),
      page3FloorVisible: isVisible(root.querySelector('#page3-floor-plane')),
      page3DrumVisible: isVisible(root.querySelector('#page3-drum-plane')),
      page3StageBackVisible: isVisible(root.querySelector('#page3-stage-back')),
      platformVideoMode: page3State?.performanceVideoSource || PAGE3_CONFIG.platform.performanceVideoSource,
      dragonVideoSource: p3Video?.getAttribute('src') || PAGE3_CONFIG.assets.dragonVideo,
      ironflowerVideoSource: p3IronVideo?.getAttribute('src') || PAGE3_CONFIG.assets.ironflowerVideo,
      dragonVideoReadyState: p3Video?.readyState ?? 0,
      ironflowerVideoReadyState: p3IronVideo?.readyState ?? 0,
      materialType: page3State?.performanceMaterialType || PAGE3_CONFIG.platform.performanceMaterialType,
      ...sharedModuleUi.getState(),
    }
    root.querySelector('[data-app-debug-extended]')?.replaceChildren(JSON.stringify(extended, null, 2))
  }

  if (params.get('debug') === '1') appDebugTimer = window.setInterval(updateAppDebug, 500)

  if (!scene.hasLoaded && startActionButton) {
    startActionButton.disabled = true
    startActionButton.textContent = '正在准备AR…'
    scene.addEventListener('loaded', () => {
      if (!cameraStartRequested) {
        startActionButton.disabled = false
        startActionButton.textContent = '开启AR体验'
      }
    }, { once: true, signal })
  }

  const setArState = (nextState) => {
    arState = nextState
    root.querySelector('[data-debug-ar-state]')?.replaceChildren(nextState)
    const mindarState = root.querySelector('[data-ar-debug-mindar]')
    if (mindarState) mindarState.textContent = nextState
    arBridge.refreshHints?.()
    updateHintDebug()
    updateStorageDebug()
  }

  const isCraftCanvasVisible = () =>
    Boolean(craftPlane?.object3D?.visible && craftPlane.getAttribute('visible') !== false)

  const isEntityVisible = (entity) =>
    Boolean(entity?.object3D?.visible && entity.getAttribute('visible') !== false)

  const setEntityVisible = (entity, visible) => {
    if (!entity?.object3D) return
    const previous = isEntityVisible(entity)
    if (previous !== visible) {
      if (entity === page1Floor) page1DebugCounters.page1FloorVisibleChangeCount += 1
      if (entity === craftPanel) page1DebugCounters.page1BackgroundVisibleChangeCount += 1
    }
    entity.object3D.visible = visible
    entity.setAttribute('visible', visible)
  }

  const setEntityOpacity = (entity, opacity) => {
    if (!entity?.object3D) return
    entity.setAttribute('material', 'opacity', opacity)
    entity.object3D.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach((material) => {
        material.transparent = true
        material.opacity = opacity
        material.needsUpdate = true
      })
    })
  }

  const fadeEntityIn = (entity, duration = config.titleImage.fadeDurationMs) => {
    setEntityVisible(entity, true)
    setEntityOpacity(entity, 0)
    const startedAt = performance.now()
    const frame = (time) => {
      if (signal.aborted) return
      const progress = Math.min(1, (time - startedAt) / duration)
      setEntityOpacity(entity, progress)
      if (progress < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  const confirmCraftVisibility = () => {
    const entities = [stableAnchor, page1Floor, panelHinge, panelContent, craftPanel, page1TitleEntity, craftPlane]
    entities.forEach((entity) => setEntityVisible(entity, true))
  }

  const canShowBambooHint = ({ state, bounds, center }) => {
    if (state !== 'BAMBOO_BUILD') return { allowed: false, reason: '当前制作状态禁止显示扎骨提示' }
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

  const formatArray = (values, digits = 3) => values?.map((value) => Number(value).toFixed(digits)).join(', ') ?? '—'

  const getPanelMetrics = () => {
    const THREE = window.AFRAME?.THREE
    const camera = scene.camera
    const canvas = scene.canvas
    if (!THREE || !camera || !canvas || !panelContent?.object3D || !craftPanel?.object3D) return null

    const panelWorldPosition = new THREE.Vector3()
    const cameraWorldPosition = new THREE.Vector3()
    const panelWorldScale = new THREE.Vector3()
    const craftPanelWorldScale = new THREE.Vector3()
    panelContent.object3D.updateWorldMatrix(true, true)
    craftPanel.object3D.updateWorldMatrix(true, true)
    panelContent.object3D.getWorldPosition(panelWorldPosition)
    camera.getWorldPosition(cameraWorldPosition)
    panelContent.object3D.getWorldScale(panelWorldScale)
    craftPanel.object3D.getWorldScale(craftPanelWorldScale)

    const box = new THREE.Box3().setFromObject(craftPanel.object3D)
    const points = []
    if (!box.isEmpty()) {
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const point = new THREE.Vector3(x, y, z).project(camera)
            if (Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)) {
              points.push({
                x: (point.x + 1) * 0.5 * canvas.clientWidth,
                y: (1 - point.y) * 0.5 * canvas.clientHeight,
              })
            }
          }
        }
      }
    }

    const width = points.length ? Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x)) : 0
    const height = points.length ? Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y)) : 0
    const stableScaleTooSmall = stableAnchor.object3D.scale.toArray().some((value) => Math.abs(value) <= 1e-6)
    const projectedTooSmall = Math.max(width, height) < 2
    return {
      panelWorldScale,
      craftPanelWorldScale,
      cameraDistance: panelWorldPosition.distanceTo(cameraWorldPosition),
      screenWidth: width,
      screenHeight: height,
      scaleTooSmall: stableScaleTooSmall || projectedTooSmall,
    }
  }

  const updateStabilizeDebug = (state = stableDebugState) => {
    if (debugMode !== 'stabilize' || !state) return
    const metrics = getPanelMetrics()
    root.querySelector('[data-stable-raw-position]').textContent = formatArray(state.rawTargetPosition)
    root.querySelector('[data-stable-position]').textContent = formatArray(state.stableAnchorPosition)
    root.querySelector('[data-stable-raw-quaternion]').textContent = formatArray(state.rawQuaternion, 4)
    root.querySelector('[data-stable-quaternion]').textContent = formatArray(state.stableQuaternion, 4)
    root.querySelector('[data-stable-raw-scale]').textContent = formatArray(state.rawTargetScale, 6)
    root.querySelector('[data-stable-scale]').textContent = formatArray(state.stableAnchorScale, 6)
    root.querySelector('[data-stable-scale-delta]').textContent = state.scaleDelta.toFixed(6)
    root.querySelector('[data-stable-position-delta]').textContent = state.positionDelta.toFixed(5)
    root.querySelector('[data-stable-rotation-delta]').textContent = state.rotationDeltaDeg.toFixed(3)
    root.querySelector('[data-stable-tracked]').textContent = String(state.targetTracked)
    root.querySelector('[data-stable-exists]').textContent = String(state.stableAnchorExists)
    root.querySelector('[data-stable-visible]').textContent = String(state.stableAnchorVisible)
    root.querySelector('[data-stable-parent]').textContent = state.stableAnchorParent
    root.querySelector('[data-stable-parent-scale]').textContent = formatArray(state.stableAnchorParentScale, 6)
    root.querySelector('[data-stable-pose-valid]').textContent = String(state.rawPoseValid)
    root.querySelector('[data-stable-scale-valid]').textContent = String(state.rawScaleValid)
    root.querySelector('[data-stable-first-transform]').textContent = String(state.firstValidFullTransformReceived)
    root.querySelector('[data-stable-hinge-visible]').textContent = String(isEntityVisible(panelHinge))
    root.querySelector('[data-stable-content-visible]').textContent = String(isEntityVisible(panelContent))
    root.querySelector('[data-stable-panel-visible]').textContent = String(isEntityVisible(craftPanel))
    root.querySelector('[data-stable-canvas-visible]').textContent = String(isEntityVisible(craftPlane))
    root.querySelector('[data-stable-lost-hold]').textContent = `${Math.round(state.lostHoldRemaining)} ms`
    root.querySelector('[data-stable-scale-warning]').hidden = !(metrics?.scaleTooSmall ?? false)
  }

  const updateStorageDebug = () => {
    if (debugMode !== 'state') return
    let keys = []
    try {
      keys = Object.keys(localStorage).filter((key) => /page1|bambooActivated/i.test(key))
    } catch {
      keys = ['localStorage不可用']
    }
    root.querySelector('[data-debug-storage]').textContent = keys.length ? keys.join(', ') : '无'
    root.querySelector('[data-debug-storage-cleaned]').textContent = String(legacyStorageCleaned)
    root.querySelector('[data-debug-requires-bamboo]').textContent = String(!bambooClicked && !craftStarted)
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
    root.querySelector('[data-ar-debug-canvas]').textContent = String(snapshot.canvasPreserved ?? true)
  }

  const actions = {
    start: () => startAr(),
    'restart-camera': () => startAr(true),
    'continue-current': () => {
      ui.hideLost()
      ui.showModuleScanning('请重新对准第一页识别卡')
      if (lifecycle?.isTracked()) resumeTrackedExperience()
    },
    'return-scan': () => {
      ui.hideLost()
      setArState(AR_PAGE1_STATES.AR_SCANNING)
      setAppState(APP_AR_STATES.WAITING_FOR_TARGET)
      ui.showScanning()
    },
  }
  const ui = createArUiController({
    root,
    signal,
    actions,
  })
  arBridge.onImageLoadAttempt = (path) => {
    if (path === config.assets.craftLayers[0].path) page1DebugCounters.lineartLoadAttemptCount += 1
  }
  arBridge.onAssetError = ({ path = '', stage = 'network' } = {}) => {
    if (activeTargetIndex !== 0) return
    sharedModuleUi.showError(0, {
      path,
      stage,
      progress: page1CriticalSnapshot.criticalProgress,
    }, () => retryPage1Critical())
  }

  let page1ControllerInitialized = false
  let pageCleanup = () => {}
  const ensurePage1Controller = () => {
    if (page1ControllerInitialized) return false
    page1ControllerInitialized = true
    pageCleanup = initializePage1Controller({
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
      onStageEnter(nextState) {
        if (nextState === 'BAMBOO_BUILD') page1Loader.preloadNextStep('page1', 'bamboo')
        if (nextState === 'BAMBOO_COMPLETE') page1Loader.preloadNextStep('page1', 'paper')
        if (nextState === 'PAPER_COMPLETE') page1Loader.preloadNextStep('page1', 'paint')
        if (nextState === 'AWAKEN_REVIEW') page1Loader.preloadIdleAssets('page1')
      },
    })
    return true
  }
  if (page1Entry) ensurePage1Controller()

  const applyMarkerAspect = (value) => {
    markerAspect = value || config.ar.markerAspectFallback
    hotspot?.updateAspect(markerAspect)
    panelController?.updateMarkerAspect(markerAspect)
    root.querySelector('[data-ar-debug-aspect]')?.replaceChildren(markerAspect.toFixed(4))
  }

  const beginPanelRise = () => {
    if (craftStarted || !(lifecycle?.isTracked() ?? false)) return
    if (!stableAnchorController?.hasValidFullTransform()) {
      pendingPanelRise = true
      return
    }
    pendingPanelRise = false
    window.clearTimeout(liftGuideTimer)
    liftGuideTimer = null
    hotspot.setEnabled(false)
    ui.hideHotspot()
    fadeEntityIn(page1Floor)
    fadeEntityIn(craftPanel)
    fadeEntityIn(page1TitleEntity)
    panelHinge.object3D.visible = true
    panelHinge.setAttribute('visible', true)
    craftPlane.object3D.visible = false
    craftPlane.setAttribute('visible', false)
    panelReady = false
    setArState(AR_PAGE1_STATES.PANEL_RISING)
    ui.showPanelRising()
    panelController.startRise()
  }

  const beginLiftGuide = () => {
    if (craftStarted || arState === AR_PAGE1_STATES.PANEL_RISING || !(lifecycle?.isTracked() ?? false)) return
    pendingPanelRise = false
    hotspot.setEnabled(false)
    ui.hideHotspot()
    panelHinge.object3D.visible = false
    panelHinge.setAttribute('visible', false)
    craftPlane.object3D.visible = false
    craftPlane.setAttribute('visible', false)
    setEntityVisible(page1Floor, false)
    setEntityVisible(page1TitleEntity, false)
    panelReady = false
    setArState(AR_PAGE1_STATES.WAIT_TILT)
    panelController.configure(panelConfig.modes.vertical, markerAspect)
    ui.showLiftGuide()
    window.clearTimeout(liftGuideTimer)
    liftGuideTimer = window.setTimeout(() => {
      liftGuideTimer = null
      beginPanelRise()
    }, config.ar.bambooDrag.liftGuideDurationMs)
  }

  arBridge.restartOpening = () => {
    bambooClicked = false
    craftStarted = false
    panelReady = false
    pendingPanelRise = false
    resumeArState = AR_PAGE1_STATES.WAIT_BAMBOO
    panelController?.reset()
    panelHinge.object3D.visible = false
    panelHinge.setAttribute('visible', false)
    craftPlane.object3D.visible = false
    craftPlane.setAttribute('visible', false)
    setEntityVisible(page1Floor, false)
    setEntityVisible(page1TitleEntity, false)
    window.clearTimeout(liftGuideTimer)
    liftGuideTimer = null
    ui.hideLost()
    if (lifecycle?.isTracked()) {
      setArState(AR_PAGE1_STATES.WAIT_BAMBOO)
      hotspot?.setEnabled(true)
      ui.showHotspot()
    } else {
      setArState(AR_PAGE1_STATES.AR_SCANNING)
      setAppState(APP_AR_STATES.WAITING_FOR_TARGET)
      ui.showScanning()
    }
    updateStorageDebug()
  }

  const resetPage1ForOtherTarget = () => {
    page1ActivationId += 1
    page1FirstVisualGatePromise = null
    page1PendingEnter = false
    page1FoundationVisibleRequested = false
    page1FirstVisualFrameReady = false
    arBridge.resetExperience?.()
    stableAnchorController?.setTracked(false)
    setEntityVisible(stableAnchor, false)
    hotspot?.setTracked(false)
    panelController?.pause()
    ui.hideLost()
    arBridge.hideHints?.('已切换至其他识别图')
  }

  const resumeTrackedExperience = () => {
    ui.hideLost()
    const snapshot = arBridge.resumeTracking?.() ?? arBridge.getSnapshot?.()
    ui.showCraft()
    setArState(snapshot?.currentState ?? AR_PAGE1_STATES.TARGET_FOUND)
    updateTrackingDebug()
  }

  const continuePage1Entry = (snapshot, activationId) => {
    if (activationId !== page1ActivationId || !lifecycle?.isTracked() || !snapshot?.criticalReady) {
      return false
    }
    setArState(AR_PAGE1_STATES.TARGET_FOUND)
    if (craftStarted) resumeTrackedExperience()
    else if (resumeArState === AR_PAGE1_STATES.PANEL_RISING) {
      setArState(AR_PAGE1_STATES.PANEL_RISING)
      ui.showPanelRising()
      panelHinge.object3D.visible = true
      panelHinge.setAttribute('visible', true)
      panelController.resume()
    } else if (resumeArState === AR_PAGE1_STATES.WAIT_TILT) {
      beginLiftGuide()
    } else if (bambooClicked) {
      panelController.configure(panelConfig.modes.vertical, markerAspect)
      beginPanelRise()
    } else {
      setArState(AR_PAGE1_STATES.WAIT_BAMBOO)
      hotspot.setEnabled(true)
      ui.showHotspot()
    }
    if (page1PendingEnter) {
      sharedModuleUi.showLoading({
        targetIndex: 0,
        title: '正在加载《竹骨成龙》',
        progress: 99,
        stage: 'scene',
        onRetry: () => retryPage1Critical(),
      })
      startPage1FirstVisualFrameGate(activationId)
    }
    return true
  }

  retryPage1Critical = () => page1Loader.retryFailedAssets('page1').then((snapshot) => {
    continuePage1Entry(snapshot, page1ActivationId)
    return snapshot
  })

  let page2PreloadUnsubscribe = () => {}
  let page3PreloadUnsubscribe = () => {}

  const showModuleLoader = (targetIndex, snapshot, controller, retry) => {
    const state = controller?.getState?.() || {}
    if (activeTargetIndex !== targetIndex) return
    if (state.firstVisualFrameReady) {
      sharedModuleUi.completeLoading(targetIndex)
      return
    }
    const loadingPending = state.pendingEnter
      || state.moduleEntered
      || state.foundationVisibleRequested
    if (!loadingPending) return
    const establishingVisual = snapshot.criticalReady && !snapshot.criticalFailed
    sharedModuleUi.showLoading({
      targetIndex,
      title: targetIndex === 1
        ? '正在加载《龙脉探源》'
        : '正在加载《火舞夜空》',
      progress: establishingVisual ? 99 : Math.min(99, snapshot.criticalProgress || 0),
      stage: establishingVisual ? 'scene' : snapshot.failedStage || snapshot.currentStage,
      currentPath: snapshot.currentLoadingPath
        || snapshot.criticalFailedPaths?.[0]
        || snapshot.criticalTimedOutPaths?.[0]
        || '',
      failed: snapshot.criticalFailed,
      onRetry: retry,
    })
  }

  const installCollectionModule = (targetIndex) => {
    if (!collectionMode) return
    const isPage2 = targetIndex === 1
    const targetElement = isPage2 ? page2Target : page3Target
    const anchorId = isPage2 ? 'page2-anchor' : 'page3-anchor'
    if (!targetElement || root.querySelector(`#${anchorId}`)) return
    const assetsMarkup = isPage2
      ? page2AssetsMarkup(PAGE2_CONFIG)
      : page3AssetsMarkup(PAGE3_CONFIG)
    const sceneMarkup = isPage2
      ? page2SceneMarkup(PAGE2_CONFIG, page2Debug)
      : page3SceneMarkup(PAGE3_CONFIG, page3Debug)
    const uiMarkup = isPage2
      ? page2UiMarkup(PAGE2_CONFIG, page2Debug)
      : page3UiMarkup(PAGE3_CONFIG, page3Debug)
    const assetsHost = root.querySelector(isPage2 ? '.page2-preload-assets' : '.page3-preload-assets')
    if (assetsHost) assetsHost.innerHTML = assetsMarkup
    const template = document.createElement('template')
    template.innerHTML = sceneMarkup
    const generatedTarget = template.content.querySelector(isPage2 ? '#page2-target' : '#page3-target')
    if (generatedTarget) targetElement.replaceChildren(...generatedTarget.childNodes)
    const generatedAnchor = template.content.querySelector(`#${anchorId}`)
    if (generatedAnchor) scene.append(generatedAnchor)
    preview.insertAdjacentHTML('beforeend', uiMarkup)
    page2Target = root.querySelector('#page2-target')
    page2Anchor = root.querySelector('#page2-anchor')
    page3Target = root.querySelector('#page3-target')
    page3Anchor = root.querySelector('#page3-anchor')
  }

  const ensurePage2Experience = (syncTracked = false) => {
    if (page2Controller) return page2Controller
    installCollectionModule(1)
    if (!page2Target || !page2Anchor) return null
    page2Preloader ||= createPage2Preloader({ root, config: PAGE2_CONFIG, debug: page2Debug })
    page2Controller = createPage2Experience({
      root,
      scene,
      target: page2Target,
      anchor: page2Anchor,
      config: PAGE2_CONFIG,
      debug: page2Debug,
      preloader: page2Preloader,
      onActivate() {
        const previousTargetIndex = activeTargetIndex
        page1ActivationId += 1
        page1FirstVisualGatePromise = null
        if (previousTargetIndex === 0) resetPage1ForOtherTarget()
        setAppState(APP_AR_STATES.MODULE_ACTIVE, 1)
        const snapshot = page2Preloader.getSnapshot()
        sharedModuleUi.showLoading({
          targetIndex: 1,
          title: '正在加载《龙脉探源》',
          progress: Math.min(99, snapshot.criticalProgress || 0),
          stage: snapshot.currentStage || 'idle',
          currentPath: snapshot.currentLoadingPath || '',
          failed: snapshot.criticalFailed,
          onRetry: () => page2Controller.retryFailed(),
        })
        ui.showModule()
        page3Controller?.suspendForOtherTarget()
        stableAnchorController?.setTracked(false)
        setEntityVisible(stableAnchor, false)
        hotspot?.setTracked(false)
        panelController?.pause()
        if (craftStarted) arBridge.pauseTracking?.()
        ui.hideLost()
        arBridge.hideHints?.('已切换至第二页识别图')
      },
      onTrackingFound: () => sharedModuleUi.hideLost(1),
      onTrackingLost: () => sharedModuleUi.hideLost(1),
      onTrackingLostConfirmed: () => sharedModuleUi.showLost(1),
      onEntryStateChange: () => showModuleLoader(
        1,
        page2Preloader.getSnapshot(),
        page2Controller,
        () => page2Controller.retryFailed(),
      ),
      onFirstVisualFrameReady: () => showModuleLoader(
        1,
        page2Preloader.getSnapshot(),
        page2Controller,
        () => page2Controller.retryFailed(),
      ),
      onAssetError: (failure) => {
        if (activeTargetIndex === 1 && !page2Controller?.getState?.().firstVisualFrameReady) {
          sharedModuleUi.showError(1, failure, () => page2Controller.retryFailed())
        }
      },
    })
    page2PreloadUnsubscribe = page2Preloader.subscribe((snapshot) => showModuleLoader(
      1,
      snapshot,
      page2Controller,
      () => page2Controller.retryFailed(),
    ))
    if (syncTracked) page2Controller.syncTracked(true)
    return page2Controller
  }

  const ensurePage3Experience = (syncTracked = false) => {
    if (page3Controller) return page3Controller
    installCollectionModule(2)
    if (!page3Target || !page3Anchor) return null
    page3Preloader ||= createPage3Preloader({ root, config: PAGE3_CONFIG, debug: page3Debug })
    page3Controller = createPage3Experience({
      root,
      scene,
      target: page3Target,
      anchor: page3Anchor,
      config: PAGE3_CONFIG,
      debug: page3Debug,
      preloader: page3Preloader,
      onActivate() {
        const previousTargetIndex = activeTargetIndex
        page1ActivationId += 1
        page1FirstVisualGatePromise = null
        if (previousTargetIndex === 0) resetPage1ForOtherTarget()
        setAppState(APP_AR_STATES.MODULE_ACTIVE, 2)
        const snapshot = page3Preloader.getSnapshot()
        sharedModuleUi.showLoading({
          targetIndex: 2,
          title: '正在加载《火舞夜空》',
          progress: Math.min(99, snapshot.criticalProgress || 0),
          stage: snapshot.currentStage || 'idle',
          currentPath: snapshot.currentLoadingPath || '',
          failed: snapshot.criticalFailed,
          onRetry: () => page3Preloader.retryFailed().then(() => page3Preloader.startCritical()),
        })
        ui.showModule()
        page2Controller?.suspendForOtherTarget()
        stableAnchorController?.setTracked(false)
        setEntityVisible(stableAnchor, false)
        hotspot?.setTracked(false)
        panelController?.pause()
        if (craftStarted) arBridge.pauseTracking?.()
        ui.hideLost()
        arBridge.hideHints?.('已切换至第三页识别图')
      },
      onTrackingFound: () => sharedModuleUi.hideLost(2),
      onTrackingLost: () => sharedModuleUi.hideLost(2),
      onTrackingLostConfirmed: () => sharedModuleUi.showLost(2),
      onEntryStateChange: () => showModuleLoader(
        2,
        page3Preloader.getSnapshot(),
        page3Controller,
        () => page3Preloader.retryFailed().then(() => page3Preloader.startCritical()),
      ),
      onFirstVisualFrameReady: () => showModuleLoader(
        2,
        page3Preloader.getSnapshot(),
        page3Controller,
        () => page3Preloader.retryFailed().then(() => page3Preloader.startCritical()),
      ),
      onAssetError: (failure) => {
        if (activeTargetIndex === 2 && !page3Controller?.getState?.().firstVisualFrameReady) {
          sharedModuleUi.showError(2, failure, () =>
            page3Preloader.retryFailed().then(() => page3Preloader.startCritical()))
        }
      },
    })
    page3PreloadUnsubscribe = page3Preloader.subscribe((snapshot) => showModuleLoader(
      2,
      snapshot,
      page3Controller,
      () => page3Preloader.retryFailed().then(() => page3Preloader.startCritical()),
    ))
    if (syncTracked) page3Controller.syncTracked(true)
    return page3Controller
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
        bambooClicked = true
        updateStorageDebug()
        beginLiftGuide()
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
      panelContent,
      config: panelConfig,
      markerAspectFallback: config.ar.markerAspectFallback,
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
        confirmCraftVisibility()
        arBridge.startCraft?.('LINEART')
        ui.showCraft()
        setArState(arBridge.getSnapshot?.().currentState ?? 'LINEART')
        arBridge.refreshHints?.()
      },
    })

    stableAnchorController = createStableAnchorController({
      target,
      anchor: stableAnchor,
      config: config.ar.trackingSmoothing,
      onVisibleChange() {
        page1DebugCounters.stableAnchorVisibleChangeCount += 1
      },
      onUpdate(state) {
        stableDebugState = state
        updateStabilizeDebug(state)
        if (pendingPanelRise && state.firstValidFullTransformReceived && state.targetTracked) {
          beginPanelRise()
        }
        const craftState = arBridge.getSnapshot?.().currentState
        if (
          state.targetTracked &&
          craftStarted &&
          (debugMode === 'hints' || ['EXPLODE_VIEW', 'LAYER_FOCUS'].includes(craftState))
        ) {
          arBridge.refreshProjectedUi?.()
        }
      },
    })

    if (page2Entry) {
      try {
        ensurePage2Experience()
      } catch (error) {
        console.error('[page2] initialization failed', error)
        sharedModuleUi.showError(1, { message: error.message, stage: 'scene' })
      }
    }

    if (page3Entry) {
      try {
        ensurePage3Experience()
      } catch (error) {
        console.error('[page3] initialization failed', error)
        sharedModuleUi.showError(2, { message: error.message, stage: 'scene' })
      }
    }

    if (page1Enabled) lifecycle = createTargetLifecycle({
      target,
      lostDelayMs: config.ar.tracking.lostDelayMs,
      signal,
      onFound() {
        page1DebugCounters.page1TargetFoundCount += 1
        ensurePage1Controller()
        const activationId = ++page1ActivationId
        page2Controller?.suspendForOtherTarget()
        page3Controller?.suspendForOtherTarget()
        stableAnchorController.setTracked(true)
        hotspot.setTracked(true)
        panelController.resume()
        ui.hideLost()
        sharedModuleUi.hideLost(0)
        setAppState(APP_AR_STATES.MODULE_ACTIVE, 0)
        ui.showModule()
        page1PendingEnter = !page1FirstVisualFrameReady
        const initialSnapshot = page1Loader.getProgress('page1')
        if (page1PendingEnter) {
          sharedModuleUi.showLoading({
            targetIndex: 0,
            title: '正在加载《竹骨成龙》',
            progress: Math.min(99, initialSnapshot.criticalProgress),
            stage: initialSnapshot.currentStage,
            currentPath: initialSnapshot.currentAssetPath,
            failed: initialSnapshot.criticalFailed,
            onRetry: () => retryPage1Critical(),
          })
        }
        page1Loader.loadCriticalAssets('page1')
          .then((snapshot) => continuePage1Entry(snapshot, activationId))
      },
      onLost() {
        page1DebugCounters.page1TargetLostCount += 1
        page1ActivationId += 1
        page1FirstVisualGatePromise = null
        resumeArState = arState
        stableAnchorController.setTracked(false)
        hotspot.setTracked(false)
        panelController.pause()
        if (craftStarted) arBridge.pauseTracking?.()
        setArState(AR_PAGE1_STATES.TRACKING_PAUSED)
        sharedModuleUi.hideLost(0)
        arBridge.hideHints?.('targetLost或追踪暂停')
        updateTrackingDebug()
      },
      onLostConfirmed(data) {
        if (
          root.querySelector('.page1-ar')?.classList.contains('is-page2-active') ||
          root.querySelector('.page1-ar')?.classList.contains('is-page3-active')
        ) return
        sharedModuleUi.showLost(0)
        updateTrackingDebug(data)
      },
      onDebug: updateTrackingDebug,
    })
    applyMarkerAspect(markerAspect)
    updatePanelDebug()
  }

  if (collectionMode) {
    page2Target?.addEventListener('targetFound', () => {
      try {
        ensurePage2Experience(true)
      } catch (error) {
        console.error('[page2] lazy initialization failed', error)
        sharedModuleUi.showError(1, { message: error.message, stage: 'scene' })
      }
    }, { signal })
    page3Target?.addEventListener('targetFound', () => {
      try {
        ensurePage3Experience(true)
      } catch (error) {
        console.error('[page3] lazy initialization failed', error)
        sharedModuleUi.showError(2, { message: error.message, stage: 'scene' })
      }
    }, { signal })
  }

  const waitForCameraFrame = async (system) => {
    const video = system?.video || scene.querySelector('video[autoplay]') || [...document.querySelectorAll('video')]
      .find((element) => element.srcObject)
    if (video && video.readyState < 2) {
      await Promise.race([
        new Promise((resolve) => video.addEventListener('playing', resolve, { once: true })),
        new Promise((resolve) => window.setTimeout(resolve, 1200)),
      ])
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  }

  const requestCameraStart = () => {
    if (cameraStarted) return Promise.resolve()
    if (cameraStartPromise) return cameraStartPromise
    cameraStartRequested = true
    cameraStartPromise = (async () => {
      if (!scene.hasLoaded) {
        await new Promise((resolve) => scene.addEventListener('loaded', resolve, { once: true }))
      }
      const system = scene.systems['mindar-image-system']
      if (!system?.start) throw new Error('MindAR系统未加载')
      setupArControllers()
      const sceneLoadedAt = performance.now()
      page2Controller?.notifySceneLoaded?.(sceneLoadedAt)
      page3Controller?.notifySceneLoaded?.(sceneLoadedAt)
      await system.start()
      cameraStarted = true
      cameraPermissionGranted = true
      const cameraStartedAt = performance.now()
      page2Preloader?.markTiming?.('cameraStarted', null, cameraStartedAt)
      page2Controller?.notifyCameraStarted?.(cameraStartedAt)
      page3Controller?.notifyCameraStarted?.(cameraStartedAt)
      await waitForCameraFrame(system)
      const firstCameraFrameAt = performance.now()
      page2Controller?.notifyFirstCameraFrame?.(firstCameraFrameAt)
      page3Controller?.notifyFirstCameraFrame?.(firstCameraFrameAt)
    })().catch((error) => {
      cameraStartRequested = false
      cameraStartPromise = null
      cameraStarted = false
      throw error
    })
    return cameraStartPromise
  }

  const startAr = async () => {
    setArState(AR_PAGE1_STATES.AR_STARTING)
    setAppState(APP_AR_STATES.CAMERA_REQUESTING)
    ui.showStarting()
    try {
      await requestCameraStart()
      setArState(AR_PAGE1_STATES.AR_SCANNING)
      setAppState(APP_AR_STATES.WAITING_FOR_TARGET)
      ui.showScanning()
    } catch (error) {
      setArState(AR_PAGE1_STATES.AR_NOT_STARTED)
      setAppState(APP_AR_STATES.LANDING)
      ui.showError(`AR启动失败：${error?.message || '无法访问摄像头'}`)
    }
  }

  scene.addEventListener(
    'arReady',
    () => {
      arReady = true
      if (appState !== APP_AR_STATES.MODULE_ACTIVE && !lifecycle?.isTracked()) ui.showScanning()
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
  applyMarkerAspect(config.a5Layout.aspectRatio)
  updateStorageDebug()
  if (page2Entry || page3Entry) {
    const prepareArControllers = () => {
      setupArControllers()
      const sceneLoadedAt = performance.now()
      page2Controller?.notifySceneLoaded?.(sceneLoadedAt)
      page3Controller?.notifySceneLoaded?.(sceneLoadedAt)
    }
    if (scene.hasLoaded) prepareArControllers()
    else scene.addEventListener('loaded', prepareArControllers, { once: true, signal })
  }
  root.__page1Cleanup = () => {
    abortController.abort()
    hotspot?.destroy()
    panelController?.destroy()
    window.clearTimeout(liftGuideTimer)
    window.clearInterval(appDebugTimer)
    stableAnchorController?.destroy()
    lifecycle?.destroy()
    page2PreloadUnsubscribe()
    page3PreloadUnsubscribe()
    page2Controller?.destroy()
    page3Controller?.destroy()
    layoutTuner?.destroy()
    pageCleanup()
    if (cameraStartRequested || cameraStarted) scene.systems['mindar-image-system']?.stop?.()
    cameraStartPromise = null
    cameraStartRequested = false
    cameraStarted = false
  }
}
