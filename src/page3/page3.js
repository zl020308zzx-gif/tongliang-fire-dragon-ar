import { createStableAnchorController } from '../stable-anchor-controller.js'
import { createTargetLifecycle } from '../target-lifecycle.js'
import { PAGE3_CONTENT } from './page3-content.js'
import {
  PAGE3_CONFIG,
  PAGE3_IMAGE_ENTRIES,
  PAGE3_STATES,
} from './page3-config.js'
import { createPage3Effects } from './page3-effects.js'
import { createPage3Preloader } from './page3-preloader.js'

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const lerp = (from, to, progress) => from + (to - from) * progress
const easeOutCubic = (value) => 1 - (1 - clamp(value)) ** 3
const easeInOutCubic = (value) => {
  const progress = clamp(value)
  return progress < 0.5 ? 4 * progress ** 3 : 1 - ((-2 * progress + 2) ** 3) / 2
}
const vector = (values) => {
  if (Array.isArray(values)) return values.join(' ')
  if (values && ['x', 'y', 'z'].every((key) => Number.isFinite(values[key]))) {
    return `${values.x} ${values.y} ${values.z}`
  }
  throw new TypeError('[page3] position/rotation 配置必须是 [x, y, z] 或 { x, y, z }')
}

const setVisible = (entity, visible) => {
  if (!entity) return
  entity.object3D.visible = visible
  entity.setAttribute('visible', visible)
}

const setOpacity = (entity, opacity) => {
  if (!entity) return
  const value = clamp(opacity)
  if (entity.__page3Opacity === value) return
  entity.__page3Opacity = value
  entity.setAttribute('material', 'opacity', value)
  entity.object3D.traverse((object) => {
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.filter(Boolean).forEach((material) => {
      material.transparent = true
      material.opacity = value
      material.needsUpdate = true
    })
  })
}

const stopAndReset = (media) => {
  if (!media) return
  media.pause()
  try {
    media.currentTime = 0
  } catch {
    // 元数据尚未就绪时不阻塞重置。
  }
}

const applyRenderOrder = (entity, order) => {
  if (!entity) return
  entity.object3D.traverse((object) => {
    object.renderOrder = order
  })
}

const imageAsset = (id, key, config) =>
  `<img id="${id}" data-page3-src="${config.assets[key]}" alt="" draggable="false" crossorigin="anonymous" />`

export const page3AssetsMarkup = (config = PAGE3_CONFIG) => `
  ${PAGE3_IMAGE_ENTRIES.map(([id, key]) => imageAsset(id, key, config)).join('')}
  <video id="page3-dragon-video" data-page3-src="${config.assets.dragonVideo}"
    muted loop playsinline webkit-playsinline preload="none" crossorigin="anonymous"></video>
  <video id="page3-ironflower-video" data-page3-src="${config.assets.ironflowerVideo}"
    muted loop playsinline webkit-playsinline preload="none" crossorigin="anonymous"></video>
  <audio id="page3-dragon-bgm" data-page3-src="${config.assets.dragonBgm}" preload="none" loop></audio>
  <audio id="page3-climax-bgm" data-page3-src="${config.assets.climaxBgm}" preload="none" loop></audio>
  <audio id="page3-drum-sfx" data-page3-src="${config.assets.drumSfx}" preload="none"></audio>
  <audio id="page3-ironflower-sfx" data-page3-src="${config.assets.ironflowerSfx}" preload="none"></audio>
`

const fullPlane = (id, key, config, z, renderOrder, extra = '', position = [0, 0, z]) => `
  <a-image id="${id}" data-page3-asset-key="${key}" width="${config.layout.width}" height="${config.layout.height}"
    position="${vector(position)}" data-render-order="${renderOrder}"
    material="shader: flat; transparent: true; alphaTest: .005; opacity: 0; depthWrite: false; depthTest: true; side: double" ${extra}></a-image>
`

export function page3SceneMarkup(config = PAGE3_CONFIG, debug = false) {
  const hotspot = config.layout.drumHotspot
  return `
    <a-entity id="page3-target" mindar-image-target="targetIndex: ${config.targetIndex}">
      <a-plane id="page3-marker-plane" width="1" height="${config.markerAspect}" position="0 0 .003"
        material="transparent: true; opacity: 0; side: double"></a-plane>
    </a-entity>
    <a-entity id="page3-anchor" visible="false">
      <a-entity id="page3-foundation-root"
        position="${vector(config.layout.root.position)}"
        rotation="${vector(config.layout.root.rotationDegrees)}"
        scale="${vector(config.layout.root.scale)}">
        <a-entity id="page3-floor-root" visible="false"
          position="0 0 0" rotation="0 0 0" scale="1 1 1">
          <a-image id="page3-floor-plane" data-page3-asset-key="floor"
            width="${config.layout.floor.width}" height="${config.layout.floor.depth}"
            position="${vector(config.layout.floor.position)}"
            rotation="${vector(config.layout.floor.rotationDegrees)}"
            scale="${vector(config.layout.floor.scale)}"
            data-render-order="${config.layout.floor.renderOrder}"
            material="shader: flat; transparent: true; alphaTest: .005; opacity: 0; depthWrite: true; depthTest: true; side: double"></a-image>
          <a-entity id="page3-drum-root"
            position="${vector(config.layout.drumPivot.position)}"
            rotation="${vector(config.layout.drumPivot.rotationDegrees)}"
            scale="${vector(config.layout.drumPivot.scale)}" visible="false">
            ${fullPlane(
              'page3-drum-plane',
              'drum',
              config,
              config.layout.drumAssetOffset.z,
              config.renderOrder.drum,
              '',
              config.layout.drumAssetOffset,
            )}
            <a-plane id="page3-drum-hit"
              position="${vector(hotspot.position)}"
              width="${hotspot.width}" height="${hotspot.height}"
              material="shader: flat; transparent: true; opacity: ${debug ? 0.2 : 0.001}; wireframe: ${debug}; color: #ffd268; depthWrite: false; side: double"></a-plane>
          </a-entity>
        </a-entity>

        <a-entity id="page3-background-root" visible="false"
          position="${vector(config.layout.backboardHinge.position)}"
          rotation="${vector(config.layout.backboardHinge.rotationStartDegrees)}"
          scale="${vector(config.layout.backboardHinge.scale)}">
          <a-entity id="page3-board-center"
            position="${vector(config.layout.backgroundBoard.position)}"
            rotation="${vector(config.layout.backgroundBoard.rotationDegrees)}"
            scale="${vector(config.layout.backgroundBoard.scale)}">
            <a-image id="page3-background-plane" data-page3-asset-key="background"
              width="${config.layout.backgroundBoard.width}" height="${config.layout.backgroundBoard.height}"
              position="0 0 0" data-render-order="${config.layout.backgroundBoard.renderOrder}"
              material="shader: flat; transparent: true; alphaTest: .005; opacity: 0; depthWrite: true; depthTest: true; side: double"></a-image>
            ${fullPlane(
              'page3-cloud-back',
              'cloudBack',
              config,
              config.layout.cloudBack.position[2],
              config.renderOrder.cloudBack,
              `scale="${vector(config.layout.cloudBack.scale)}"`,
              config.layout.cloudBack.position,
            )}
            ${fullPlane('page3-title-plane', 'title', config, config.z.title, config.renderOrder.title)}
          </a-entity>
        </a-entity>

        <a-entity id="page3-stage-root" visible="false"
          position="${vector(config.layout.stageRoot.position)}"
          rotation="${vector(config.layout.stageRoot.rotationDegrees)}"
          scale="${vector(config.layout.stageRoot.scale)}">
          ${fullPlane(
            'page3-cloud-middle',
            'cloudMiddle',
            config,
            config.layout.cloudMiddle.position[2],
            config.renderOrder.cloudMiddle,
            `scale="${vector(config.layout.cloudMiddle.scale)}"`,
            config.layout.cloudMiddle.position,
          )}
          ${fullPlane('page3-stage-back', 'stageBack', config, config.z.stageBack, config.renderOrder.stageBack)}
          <a-image id="page3-stage-lights" data-page3-asset-key="stageLights"
            position="${vector(config.layout.stageLights.position)}"
            width="${config.layout.stageLights.width}" height="${config.layout.stageLights.height}"
            data-render-order="${config.renderOrder.lights}"
            material="shader: flat; transparent: true; alphaTest: .005; opacity: 0; depthWrite: false; depthTest: true; side: double"></a-image>
          <a-video id="page3-ironflower-plane" position="${vector(config.layout.ironflowerVideo.position)}"
            width="${config.layout.ironflowerVideo.width}" height="${config.layout.ironflowerVideo.maxHeight}"
            data-render-order="${config.renderOrder.ironflowerVideo}" visible="false"
            material="shader: flat; transparent: true; alphaTest: .003; opacity: 0; depthWrite: false; depthTest: true; side: double"></a-video>
          <a-video id="page3-dragon-plane" position="${vector(config.layout.dragonVideo.position)}"
            width="${config.layout.dragonVideo.width}" height="${config.layout.dragonVideo.maxHeight}"
            data-render-order="${config.renderOrder.dragonVideo}" visible="false"
            material="shader: flat; transparent: true; alphaTest: .003; opacity: 0; depthWrite: false; depthTest: true; side: double"></a-video>
          <a-entity id="page3-pearl-root" position="${vector([
            config.layout.pearlPivot.x,
            config.layout.pearlPivot.y,
            config.layout.pearlPivot.z,
          ])}" visible="false">
            ${fullPlane(
              'page3-pearl-plane',
              'pearl',
              config,
              config.layout.pearlAssetOffset.z,
              config.renderOrder.pearl,
              '',
              config.layout.pearlAssetOffset,
            )}
          </a-entity>
          ${fullPlane('page3-stage-front', 'stageFront', config, config.z.stageFront, config.renderOrder.stageFront)}
          ${fullPlane(
            'page3-cloud-front',
            'cloudFront',
            config,
            config.layout.cloudFront.position[2],
            config.renderOrder.cloudFront,
            `scale="${vector(config.layout.cloudFront.scale)}"`,
            config.layout.cloudFront.position,
          )}
          <a-entity id="page3-effect-root" position="0 0 ${config.z.effects}"></a-entity>
          <a-plane id="page3-debug-stage-safe" visible="${debug}"
            position="${(config.layout.stageSafeArea.x + config.layout.stageSafeArea.width / 2 - 0.5) * config.layout.width}
              ${(0.5 - config.layout.stageSafeArea.y - config.layout.stageSafeArea.height / 2) * config.layout.height}
              ${config.z.effects + 0.001}"
            width="${config.layout.stageSafeArea.width * config.layout.width}"
            height="${config.layout.stageSafeArea.height * config.layout.height}"
            material="shader: flat; wireframe: true; color: #6dffc6; transparent: true; opacity: .78; depthWrite: false"></a-plane>
        </a-entity>
      </a-entity>
    </a-entity>
  `
}

export const page3UiMarkup = (config = PAGE3_CONFIG, debug = false) => `
  <section class="page3-ui" aria-label="火舞夜空 AR 界面">
    <header class="page3-header"><span>03</span><h1>火舞夜空</h1></header>
    <section class="page3-placement-guide" role="status" hidden>
      <strong>请将第三页识别卡平放在桌面</strong>
      <span>保持手机斜向观察，立体舞台即将展开</span>
    </section>
    <section class="page3-loading page3-glass-card" role="status" hidden>
      <strong>识别成功｜火舞夜空</strong>
      <span data-page3-loading-text>正在准备火舞舞台</span>
    </section>
    <section class="page3-step-card page3-glass-card" hidden>
      <span data-page3-step-number>01</span>
      <div><h2 data-page3-step-title>擂鼓起势</h2><p data-page3-step-description>${PAGE3_CONTENT.ready.description}</p></div>
    </section>
    <ol class="page3-progress" aria-label="表演进度" hidden>
      ${PAGE3_CONTENT.progress.map((item) => `<li data-page3-progress="${item.id}">${item.label}</li>`).join('')}
    </ol>
    <p class="page3-drum-prompt" role="status" hidden>${PAGE3_CONTENT.ready.prompt}</p>
    <section class="page3-end-options page3-glass-card" hidden>
      <strong>火舞表演完成</strong>
      <div>
        <button type="button" data-page3-action="restart">重新体验</button>
        <button type="button" data-page3-action="real-video">观看真实铜梁火龙表演</button>
      </div>
    </section>
    <p class="page3-tracking-lost page3-glass-card" role="status" hidden>请重新对准第三页识别卡</p>
    <section class="page3-error page3-glass-card" role="alert" hidden>
      <span data-page3-error-text></span>
      <button type="button" data-page3-action="retry">重新加载</button>
    </section>
  </section>
  <section class="page3-real-video-overlay" hidden>
    <button type="button" class="page3-real-video-close" data-page3-action="close-real-video" aria-label="关闭实拍视频">×</button>
    <video id="page3-real-video" data-page3-real-player data-page3-src="${config.assets.realVideo}"
      data-page3-poster="${config.assets.realPoster}" playsinline webkit-playsinline preload="none" controls></video>
    <p data-page3-real-message hidden>视频暂未开始，请点击播放。</p>
  </section>
  <section class="page3-complete-screen" role="status" hidden>
    <p>${PAGE3_CONTENT.completion}</p>
  </section>
  ${debug ? `<aside class="page3-debug-panel">
    <strong>Page 3 Debug</strong>
    <p>状态 <b data-page3-debug-state>${PAGE3_STATES.HIDDEN}</b></p>
    <p>targetIndex <b>${config.targetIndex}</b>｜tracked <b data-page3-debug-tracked>false</b></p>
    <p>关键资源 <b data-page3-debug-critical>false</b>｜延后资源 <b data-page3-debug-deferred>false</b></p>
    <p>鼓可点击 <b data-page3-debug-drum>false</b>｜击鼓次数 <b data-page3-debug-hits>0</b></p>
    <p>舞龙尺寸 <b data-page3-debug-dragon-size>—</b></p>
    <p>铁花尺寸 <b data-page3-debug-iron-size>—</b></p>
    <p>bgTextureReady <b data-page3-debug-bg-texture>false</b></p>
    <p>floorTextureReady <b data-page3-debug-floor-texture>false</b></p>
    <p>drumTextureReady <b data-page3-debug-drum-texture>false</b></p>
    <p>mounted bg/floor/drum <b data-page3-debug-mounted>false / false / false</b></p>
    <p>visible bg/floor/drum <b data-page3-debug-foundation-visible>false / false / false</b></p>
    <p>opacity bg/floor/drum <b data-page3-debug-foundation-opacity>0 / 0 / 0</b></p>
    <p>scale bg/floor/drum <b data-page3-debug-foundation-scale>0 / 0 / 0</b></p>
    <p>bgWorldPosition <b data-page3-debug-bg-world>—</b></p>
    <p>floorWorldPosition <b data-page3-debug-floor-world>—</b></p>
    <p>drumWorldPosition <b data-page3-debug-drum-world>—</b></p>
    <p>page3Root P/R/S <b data-page3-debug-root-transform>—</b></p>
    <p>floorRoot P/R/S <b data-page3-debug-floor-transform>—</b></p>
    <p>backboardHinge position <b data-page3-debug-hinge-position>—</b></p>
    <p>backboardHinge rotation <b data-page3-debug-hinge-rotation>—</b></p>
    <p>bgBoard localPosition <b data-page3-debug-bg-local>—</b></p>
    <p>bgBoard worldRotation <b data-page3-debug-bg-rotation>—</b></p>
    <p>backgroundFloorAngle <b data-page3-debug-angle>—</b></p>
    <p>stageRoot worldPosition <b data-page3-debug-stage-world>—</b></p>
    <p>stageRoot worldRotation <b data-page3-debug-stage-rotation>—</b></p>
    <p>targetFound <b data-page3-debug-target-found>false</b></p>
    <p>page3RootVisible <b data-page3-debug-root-visible>false</b></p>
    <p>foundation frames <b data-page3-debug-foundation-frames>0 / ${config.foundation.readyRenderFrames}</b></p>
    <p>FPS <b data-page3-debug-fps>0</b></p>
    <button type="button" data-page3-debug-action="simulate">模拟识别</button>
    <button type="button" data-page3-debug-action="drum">模拟击鼓</button>
    <button type="button" data-page3-debug-action="next">跳到下一状态</button>
    <button type="button" data-page3-debug-action="reset">重置</button>
  </aside>` : ''}
`

const registerPage3Runtime = () => {
  if (!window.AFRAME || window.AFRAME.components['page3-runtime']) return
  window.AFRAME.registerComponent('page3-runtime', {
    tick(time, delta) {
      this.el.sceneEl.__page3RuntimeTick?.(time, Math.min(delta || 0, 50))
    },
  })
}

const contentForState = (state) => {
  if ([PAGE3_STATES.READY, PAGE3_STATES.STAGE_BUILDING, PAGE3_STATES.WAIT_PEARL].includes(state)) {
    return state === PAGE3_STATES.READY ? PAGE3_CONTENT.ready : PAGE3_CONTENT.stage
  }
  if ([PAGE3_STATES.PEARL_GUIDING, PAGE3_STATES.WAIT_DRAGON].includes(state)) return PAGE3_CONTENT.pearl
  if ([PAGE3_STATES.DRAGON_DANCING, PAGE3_STATES.WAIT_CLIMAX].includes(state)) return PAGE3_CONTENT.dragon
  if (state === PAGE3_STATES.IRONFLOWER_CLIMAX) return PAGE3_CONTENT.climax
  if ([PAGE3_STATES.CLOSING, PAGE3_STATES.END_OPTIONS].includes(state)) return PAGE3_CONTENT.closing
  return PAGE3_CONTENT.ready
}

const progressIdForState = (state) => {
  if ([PAGE3_STATES.READY, PAGE3_STATES.STAGE_BUILDING, PAGE3_STATES.WAIT_PEARL].includes(state)) return 'stage'
  if ([PAGE3_STATES.PEARL_GUIDING, PAGE3_STATES.WAIT_DRAGON].includes(state)) return 'pearl'
  if ([PAGE3_STATES.DRAGON_DANCING, PAGE3_STATES.WAIT_CLIMAX].includes(state)) return 'dragon'
  if (state === PAGE3_STATES.IRONFLOWER_CLIMAX) return 'climax'
  if ([PAGE3_STATES.CLOSING, PAGE3_STATES.END_OPTIONS].includes(state)) return 'closing'
  return null
}

export function createPage3Experience({
  root,
  scene,
  target,
  anchor,
  config = PAGE3_CONFIG,
  debug = false,
  preloader = null,
  onActivate,
}) {
  registerPage3Runtime()
  scene.renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.performance.maxPixelRatio))
  const abortController = new AbortController()
  const { signal } = abortController
  const preloaderSession = preloader || createPage3Preloader({ root, config, debug })
  const foundationRoot = root.querySelector('#page3-foundation-root')
  const backgroundRoot = root.querySelector('#page3-background-root')
  const boardCenter = root.querySelector('#page3-board-center')
  const floorRoot = root.querySelector('#page3-floor-root')
  const stageRoot = root.querySelector('#page3-stage-root')
  const background = root.querySelector('#page3-background-plane')
  const floor = root.querySelector('#page3-floor-plane')
  const title = root.querySelector('#page3-title-plane')
  const cloudBack = root.querySelector('#page3-cloud-back')
  const cloudMiddle = root.querySelector('#page3-cloud-middle')
  const cloudFront = root.querySelector('#page3-cloud-front')
  const stageBack = root.querySelector('#page3-stage-back')
  const stageFront = root.querySelector('#page3-stage-front')
  const stageLights = root.querySelector('#page3-stage-lights')
  const drumRoot = root.querySelector('#page3-drum-root')
  const drumPlane = root.querySelector('#page3-drum-plane')
  const drumHit = root.querySelector('#page3-drum-hit')
  const pearlRoot = root.querySelector('#page3-pearl-root')
  const dragonPlane = root.querySelector('#page3-dragon-plane')
  const ironflowerPlane = root.querySelector('#page3-ironflower-plane')
  const dragonVideo = root.querySelector('#page3-dragon-video')
  const ironflowerVideo = root.querySelector('#page3-ironflower-video')
  const dragonBgm = root.querySelector('#page3-dragon-bgm')
  const climaxBgm = root.querySelector('#page3-climax-bgm')
  const drumSfx = root.querySelector('#page3-drum-sfx')
  const ironflowerSfx = root.querySelector('#page3-ironflower-sfx')
  const realVideoOverlay = root.querySelector('.page3-real-video-overlay')
  const realVideoPlayer = root.querySelector('[data-page3-real-player]')
  const realVideoMessage = root.querySelector('[data-page3-real-message]')
  const completeScreen = root.querySelector('.page3-complete-screen')
  const ui = root.querySelector('.page3-ui')
  const placementGuide = root.querySelector('.page3-placement-guide')
  const loading = root.querySelector('.page3-loading')
  const loadingText = root.querySelector('[data-page3-loading-text]')
  const stepCard = root.querySelector('.page3-step-card')
  const progress = root.querySelector('.page3-progress')
  const prompt = root.querySelector('.page3-drum-prompt')
  const endOptions = root.querySelector('.page3-end-options')
  const lostNotice = root.querySelector('.page3-tracking-lost')
  const errorNotice = root.querySelector('.page3-error')
  const errorText = root.querySelector('[data-page3-error-text]')
  const effects = createPage3Effects({ root, config })
  const THREE = window.AFRAME.THREE
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const pearlCurve = new THREE.CatmullRomCurve3(
    config.layout.pearlPath.map((point) => new THREE.Vector3(point.x, point.y, 0)),
    false,
    'catmullrom',
    0.5,
  )
  const baseDragonPosition = new THREE.Vector3(...config.layout.dragonVideo.position)
  const baseIronPosition = new THREE.Vector3(...config.layout.ironflowerVideo.position)
  const basePearlPosition = new THREE.Vector3(
    config.layout.pearlPivot.x,
    config.layout.pearlPivot.y,
    config.layout.pearlPivot.z,
  )

  let state = PAGE3_STATES.HIDDEN
  let stateElapsed = 0
  let tracked = false
  let suspended = false
  let stableElapsed = 0
  let lostStartedAt = 0
  let drumEnabled = false
  let drumFeedbackElapsed = -1
  let drumHitCount = 0
  let audioUnlocked = false
  let criticalReady = false
  let deferredSettled = false
  let stageAssetsReady = false
  let dragonReady = false
  let ironflowerReady = false
  let foundationRenderFrames = 0
  let foundationReady = false
  let placementGuideShown = false
  let placementGuideActive = false
  let backgroundAngleWarningShown = false
  let destroyed = false
  let stateFlags = new Set()
  let pointerStart = null
  let fpsElapsed = 0
  let fpsFrames = 0
  let fps = 0
  let lifecycle
  const foundationWarnings = new Set()
  let visibilityPaused = false
  const audioFades = new Map()
  const mediaPausedForTracking = new Set()

  const stable = createStableAnchorController({
    target,
    anchor,
    config: config.tracking,
    externalTick: true,
    onUpdate: () => {},
  })

  const showError = (message) => {
    console.error(`[page3] ${message}`)
    errorText.textContent = message
    errorNotice.hidden = false
  }
  const hideError = () => {
    errorNotice.hidden = true
    errorText.textContent = ''
  }

  const safePlay = (media, path, { restart = false } = {}) => {
    if (!media) return Promise.resolve(false)
    if (restart) {
      try {
        media.currentTime = 0
      } catch {
        // 元数据未就绪时由 loadeddata 后续恢复。
      }
    }
    try {
      const promise = media.play()
      return Promise.resolve(promise).then(() => true).catch((error) => {
        console.warn(`[page3] 媒体播放未开始：${path}`, error)
        return false
      })
    } catch (error) {
      console.warn(`[page3] 媒体播放失败：${path}`, error)
      return Promise.resolve(false)
    }
  }

  const setAudioTarget = (audio, targetVolume, durationMs = config.audio.fadeMs) => {
    if (!audio) return
    audioFades.set(audio, {
      from: audio.volume,
      to: clamp(targetVolume),
      elapsed: 0,
      duration: Math.max(1, durationMs),
    })
  }

  const updateAudioFades = (delta) => {
    audioFades.forEach((fade, audio) => {
      fade.elapsed += delta
      const value = lerp(fade.from, fade.to, clamp(fade.elapsed / fade.duration))
      audio.volume = value
      if (fade.elapsed >= fade.duration) {
        audio.volume = fade.to
        audioFades.delete(audio)
        if (fade.to === 0 && ![drumSfx, ironflowerSfx].includes(audio)) audio.pause()
      }
    })
  }

  const unlockAudio = () => {
    if (audioUnlocked) return
    audioUnlocked = true
    ;[dragonBgm, climaxBgm, ironflowerSfx].forEach((audio) => {
      if (!audio?.src) return
      const previousVolume = audio.volume
      audio.volume = 0
      try {
        const promise = audio.play()
        promise?.then(() => {
          audio.pause()
          audio.currentTime = 0
          audio.volume = previousVolume
        }).catch(() => {
          audio.volume = previousVolume
        })
      } catch {
        audio.volume = previousVolume
      }
    })
  }

  const playDrumSound = () => {
    if (!drumSfx?.src) return
    drumSfx.volume = config.audio.drumSfxVolume
    safePlay(drumSfx, config.assets.drumSfx, { restart: true })
  }

  const stopStageMedia = ({ reset = true } = {}) => {
    audioFades.clear()
    ;[dragonBgm, climaxBgm, drumSfx, ironflowerSfx, dragonVideo, ironflowerVideo].forEach((media) => {
      if (reset) stopAndReset(media)
      else media?.pause()
    })
  }

  const updateMediaPlaneSize = (video, plane, layout, debugOutput) => {
    if (!video.videoWidth || !video.videoHeight) return
    const aspect = video.videoWidth / video.videoHeight
    const width = Math.min(layout.width, layout.maxHeight * aspect)
    const height = width / aspect
    plane.setAttribute('width', width)
    plane.setAttribute('height', height)
    debugOutput?.replaceChildren(`${video.videoWidth}×${video.videoHeight} → ${width.toFixed(3)}×${height.toFixed(3)}`)
  }

  dragonVideo.addEventListener('loadedmetadata', () => {
    updateMediaPlaneSize(
      dragonVideo,
      dragonPlane,
      config.layout.dragonVideo,
      root.querySelector('[data-page3-debug-dragon-size]'),
    )
    dragonPlane.setAttribute('src', '#page3-dragon-video')
  }, { signal })
  ironflowerVideo.addEventListener('loadedmetadata', () => {
    updateMediaPlaneSize(
      ironflowerVideo,
      ironflowerPlane,
      config.layout.ironflowerVideo,
      root.querySelector('[data-page3-debug-iron-size]'),
    )
    ironflowerPlane.setAttribute('src', '#page3-ironflower-video')
  }, { signal })

  const bindReadyAssets = (snapshot) => {
    PAGE3_IMAGE_ENTRIES.forEach(([id, key]) => {
      if (snapshot.status.get(key) !== 'ready') return
      root.querySelectorAll(`[data-page3-asset-key="${key}"]`).forEach((entity) => {
        if (entity.dataset.page3Bound === 'true') return
        entity.dataset.page3Bound = 'true'
        entity.setAttribute('src', `#${id}`)
      })
    })
    criticalReady = snapshot.criticalReady
    deferredSettled = snapshot.deferredSettled
    stageAssetsReady = ['stageFront', 'stageLights', 'pearl', 'drumSfx']
      .every((key) => snapshot.status.get(key) === 'ready')
    dragonReady = snapshot.status.get('dragonVideo') === 'ready'
    ironflowerReady = snapshot.status.get('ironflowerVideo') === 'ready'
    const failedPaths = [...snapshot.errors.values()].map((failure) => failure.path)
    if (failedPaths.length) showError(`部分资源加载失败：${failedPaths.join('、')}`)
    renderDebug()
  }
  const setTransform = (entity, { position, rotation, scale } = {}) => {
    if (!entity?.object3D) return
    if (position) {
      entity.object3D.position.set(...position)
      entity.setAttribute('position', vector(position))
    }
    if (rotation) {
      entity.object3D.rotation.set(...rotation.map((value) => THREE.MathUtils.degToRad(value)))
      entity.setAttribute('rotation', vector(rotation))
    }
    if (scale) {
      entity.object3D.scale.set(...scale)
      entity.setAttribute('scale', vector(scale))
    }
    entity.object3D.updateMatrixWorld(true)
  }

  const getMaterialOpacity = (entity) => {
    const values = []
    entity?.object3D?.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach((material) => values.push(Number(material.opacity)))
    })
    const finiteValues = values.filter(Number.isFinite)
    if (finiteValues.length) return Math.max(...finiteValues)
    const material = entity?.getAttribute?.('material')
    return Number.isFinite(Number(material?.opacity)) ? Number(material.opacity) : 0
  }

  const getWorldVector = (entity, method) => {
    const output = new THREE.Vector3()
    if (!entity?.object3D?.[method]) return [NaN, NaN, NaN]
    entity.object3D.updateWorldMatrix(true, false)
    entity.object3D[method](output)
    return output.toArray()
  }

  const isTextureReady = (assetKey, entity) => {
    const assetEntry = PAGE3_IMAGE_ENTRIES.find(([, key]) => key === assetKey)
    const image = assetEntry ? root.querySelector(`#${assetEntry[0]}`) : null
    if (!(image instanceof HTMLImageElement) || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return false
    }
    let bound = false
    entity?.object3D?.traverse((object) => {
      if (bound) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      bound = materials.filter(Boolean).some((material) => {
        const mapImage = material.map?.image
        return mapImage === image ||
          (mapImage?.currentSrc && image.currentSrc && mapImage.currentSrc === image.currentSrc) ||
          (mapImage?.src && image.src && mapImage.src === image.src)
      })
    })
    return bound
  }

  const isMountedUnderAnchor = (entity) =>
    Boolean(entity && anchor.contains(entity) && entity.object3D?.parent)

  const isActuallyVisible = (...entities) =>
    entities.every((entity) => entity?.getAttribute('visible') !== false && entity?.object3D?.visible !== false)

  const isPositiveFiniteScale = (values) =>
    values.every((value) => Number.isFinite(value) && Math.abs(value) > 1e-6)
  const isFiniteTransform = (transform) =>
    transform.position.every(Number.isFinite) &&
    transform.rotation.every(Number.isFinite) &&
    transform.scale.every(Number.isFinite) &&
    isPositiveFiniteScale(transform.scale)

  const getWorldRotationDegrees = (entity) => {
    if (!entity?.object3D) return [NaN, NaN, NaN]
    const quaternion = new THREE.Quaternion()
    entity.object3D.updateWorldMatrix(true, false)
    entity.object3D.getWorldQuaternion(quaternion)
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')
    return [euler.x, euler.y, euler.z].map(THREE.MathUtils.radToDeg)
  }

  const getLocalTransform = (entity) => ({
    position: entity?.object3D?.position?.toArray?.() || [NaN, NaN, NaN],
    rotation: entity?.object3D
      ? [entity.object3D.rotation.x, entity.object3D.rotation.y, entity.object3D.rotation.z].map(THREE.MathUtils.radToDeg)
      : [NaN, NaN, NaN],
    scale: entity?.object3D?.scale?.toArray?.() || [NaN, NaN, NaN],
  })

  const getBackgroundFloorAngle = () => {
    if (!background?.object3D || !floor?.object3D) return NaN
    const boardQuaternion = new THREE.Quaternion()
    const floorQuaternion = new THREE.Quaternion()
    background.object3D.updateWorldMatrix(true, false)
    floor.object3D.updateWorldMatrix(true, false)
    background.object3D.getWorldQuaternion(boardQuaternion)
    floor.object3D.getWorldQuaternion(floorQuaternion)
    const boardNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(boardQuaternion).normalize()
    const floorNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(floorQuaternion).normalize()
    return THREE.MathUtils.radToDeg(boardNormal.angleTo(floorNormal))
  }

  const getFoundationDiagnostics = () => {
    const bgScale = getWorldVector(backgroundRoot, 'getWorldScale')
    const floorScale = getWorldVector(floor, 'getWorldScale')
    const drumScale = getWorldVector(drumRoot, 'getWorldScale')
    const bgWorldPosition = getWorldVector(background, 'getWorldPosition')
    const floorWorldPosition = getWorldVector(floor, 'getWorldPosition')
    const drumWorldPosition = getWorldVector(drumRoot, 'getWorldPosition')
    const stageWorldPosition = getWorldVector(stageRoot, 'getWorldPosition')
    const backgroundFloorAngle = getBackgroundFloorAngle()
    const rootTransform = getLocalTransform(foundationRoot)
    const floorRootTransform = getLocalTransform(floorRoot)
    const floorTransform = getLocalTransform(floor)
    const hingeTransform = getLocalTransform(backgroundRoot)
    const backgroundBoardTransform = getLocalTransform(boardCenter)
    const stageTransform = getLocalTransform(stageRoot)
    const drumTransform = getLocalTransform(drumRoot)
    const hingeTargetReached = hingeTransform.rotation.every((value, index) =>
      Math.abs(value - config.layout.backboardHinge.rotationEndDegrees[index]) <= 0.1)
    return {
      bgTextureReady: isTextureReady('background', background),
      floorTextureReady: isTextureReady('floor', floor),
      drumTextureReady: isTextureReady('drum', drumPlane),
      bgMounted: isMountedUnderAnchor(background),
      floorMounted: isMountedUnderAnchor(floor),
      drumMounted: isMountedUnderAnchor(drumPlane),
      bgVisible: isActuallyVisible(anchor, foundationRoot, backgroundRoot, background),
      floorVisible: isActuallyVisible(anchor, foundationRoot, floorRoot, floor),
      drumVisible: isActuallyVisible(anchor, foundationRoot, floorRoot, drumRoot, drumPlane),
      bgOpacity: getMaterialOpacity(background),
      floorOpacity: getMaterialOpacity(floor),
      drumOpacity: getMaterialOpacity(drumPlane),
      bgScale,
      floorScale,
      drumScale,
      bgWorldPosition,
      floorWorldPosition,
      drumWorldPosition,
      rootTransform,
      floorRootTransform,
      floorTransform,
      hingeTransform,
      backgroundBoardTransform,
      stageTransform,
      drumTransform,
      hingeTargetReached,
      bgLocalPosition: boardCenter.object3D?.position?.toArray?.() || [NaN, NaN, NaN],
      bgWorldRotation: getWorldRotationDegrees(background),
      backgroundFloorAngle,
      stageWorldPosition,
      stageWorldRotation: getWorldRotationDegrees(stageRoot),
      currentPage3State: state,
      targetFound: tracked,
      page3RootVisible: isActuallyVisible(anchor, foundationRoot),
    }
  }

  const foundationIsRenderable = (diagnostics) =>
    diagnostics.bgTextureReady &&
    diagnostics.floorTextureReady &&
    diagnostics.drumTextureReady &&
    diagnostics.bgMounted &&
    diagnostics.floorMounted &&
    diagnostics.drumMounted &&
    diagnostics.bgVisible &&
    diagnostics.floorVisible &&
    diagnostics.drumVisible &&
    diagnostics.bgOpacity > 0 &&
    diagnostics.floorOpacity > 0 &&
    diagnostics.drumOpacity > 0 &&
    isPositiveFiniteScale(diagnostics.bgScale) &&
    isPositiveFiniteScale(diagnostics.floorScale) &&
    isPositiveFiniteScale(diagnostics.drumScale) &&
    diagnostics.bgWorldPosition.every(Number.isFinite) &&
    diagnostics.floorWorldPosition.every(Number.isFinite) &&
    diagnostics.drumWorldPosition.every(Number.isFinite) &&
    isFiniteTransform(diagnostics.rootTransform) &&
    isFiniteTransform(diagnostics.floorRootTransform) &&
    isFiniteTransform(diagnostics.floorTransform) &&
    isFiniteTransform(diagnostics.hingeTransform) &&
    isFiniteTransform(diagnostics.backgroundBoardTransform) &&
    isFiniteTransform(diagnostics.stageTransform) &&
    isFiniteTransform(diagnostics.drumTransform) &&
    diagnostics.hingeTargetReached &&
    diagnostics.bgWorldRotation.every(Number.isFinite) &&
    diagnostics.stageWorldPosition.every(Number.isFinite) &&
    diagnostics.stageWorldRotation.every(Number.isFinite) &&
    Number.isFinite(diagnostics.backgroundFloorAngle) &&
    Math.abs(diagnostics.backgroundFloorAngle - 90) <= 2 &&
    diagnostics.targetFound &&
    diagnostics.page3RootVisible

  const warnFoundationProblems = (diagnostics) => {
    const problems = Object.entries({
      bgTextureReady: diagnostics.bgTextureReady,
      floorTextureReady: diagnostics.floorTextureReady,
      drumTextureReady: diagnostics.drumTextureReady,
      bgMounted: diagnostics.bgMounted,
      floorMounted: diagnostics.floorMounted,
      drumMounted: diagnostics.drumMounted,
      bgVisible: diagnostics.bgVisible,
      floorVisible: diagnostics.floorVisible,
      drumVisible: diagnostics.drumVisible,
      bgOpacity: diagnostics.bgOpacity > 0,
      floorOpacity: diagnostics.floorOpacity > 0,
      drumOpacity: diagnostics.drumOpacity > 0,
      bgScale: isPositiveFiniteScale(diagnostics.bgScale),
      floorScale: isPositiveFiniteScale(diagnostics.floorScale),
      drumScale: isPositiveFiniteScale(diagnostics.drumScale),
      bgWorldPosition: diagnostics.bgWorldPosition.every(Number.isFinite),
      floorWorldPosition: diagnostics.floorWorldPosition.every(Number.isFinite),
      drumWorldPosition: diagnostics.drumWorldPosition.every(Number.isFinite),
      backgroundFloorAngle: Number.isFinite(diagnostics.backgroundFloorAngle) &&
        Math.abs(diagnostics.backgroundFloorAngle - 90) <= 2,
      hingeTargetReached: diagnostics.hingeTargetReached,
      transformsFinite: [
        diagnostics.rootTransform,
        diagnostics.floorRootTransform,
        diagnostics.floorTransform,
        diagnostics.hingeTransform,
        diagnostics.backgroundBoardTransform,
        diagnostics.stageTransform,
        diagnostics.drumTransform,
      ].every(isFiniteTransform),
      page3RootVisible: diagnostics.page3RootVisible,
    }).filter(([, valid]) => !valid)
    problems.forEach(([problem]) => {
      if (foundationWarnings.has(problem)) return
      foundationWarnings.add(problem)
      console.warn(`[page3] foundation not renderable: ${problem}`, diagnostics)
    })
  }

  const applyFoundationTransforms = (
    hingeRotation = config.layout.backboardHinge.rotationStartDegrees,
  ) => {
    setTransform(foundationRoot, {
      position: config.layout.root.position,
      rotation: config.layout.root.rotationDegrees,
      scale: config.layout.root.scale,
    })
    setTransform(floorRoot, {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    })
    setTransform(backgroundRoot, {
      position: config.layout.backboardHinge.position,
      rotation: hingeRotation,
      scale: config.layout.backboardHinge.scale,
    })
    setTransform(boardCenter, {
      position: config.layout.backgroundBoard.position,
      rotation: config.layout.backgroundBoard.rotationDegrees,
      scale: config.layout.backgroundBoard.scale,
    })
    setTransform(floor, {
      position: config.layout.floor.position,
      rotation: config.layout.floor.rotationDegrees,
      scale: config.layout.floor.scale,
    })
    setTransform(stageRoot, {
      position: config.layout.stageRoot.position,
      rotation: config.layout.stageRoot.rotationDegrees,
      scale: config.layout.stageRoot.scale,
    })
    setTransform(drumRoot, {
      position: config.layout.drumPivot.position,
      rotation: config.layout.drumPivot.rotationDegrees,
      scale: config.layout.drumPivot.scale,
    })
    ;[
      [cloudBack, config.layout.cloudBack],
      [cloudMiddle, config.layout.cloudMiddle],
      [cloudFront, config.layout.cloudFront],
    ].forEach(([entity, cloudLayout]) => {
      setTransform(entity, {
        position: cloudLayout.position,
        rotation: [0, 0, 0],
        scale: cloudLayout.scale,
      })
    })
  }

  const showFoundation = () => {
    applyFoundationTransforms(config.layout.backboardHinge.rotationEndDegrees)
    setVisible(foundationRoot, true)
    setVisible(backgroundRoot, true)
    setVisible(floorRoot, true)
    setVisible(stageRoot, true)
    setVisible(background, true)
    setVisible(floor, true)
    setVisible(title, true)
    setVisible(cloudBack, true)
    setVisible(cloudMiddle, true)
    setVisible(cloudFront, true)
    setVisible(drumRoot, true)
    setVisible(drumPlane, true)
    setOpacity(background, 1)
    setOpacity(floor, 1)
    setOpacity(title, 1)
    setOpacity(cloudBack, config.clouds.back.opacityMin)
    setOpacity(cloudMiddle, config.clouds.middle.opacityMin)
    setOpacity(cloudFront, config.clouds.front.opacityMin)
    setOpacity(drumPlane, 1)
    applyRenderOrder(background, config.layout.backgroundBoard.renderOrder)
    applyRenderOrder(floor, config.layout.floor.renderOrder)
    applyRenderOrder(drumPlane, config.renderOrder.drum)
  }

  const prepareFoundationEntrance = () => {
    const holdMs = config.durations.placementGuideHoldMs
    const openMs = config.durations.foundationOpenMs
    const rawOpenProgress = clamp((stateElapsed - holdMs) / openMs)
    const openProgress = easeInOutCubic(rawOpenProgress)
    const startRotation = config.layout.backboardHinge.rotationStartDegrees
    const endRotation = config.layout.backboardHinge.rotationEndDegrees
    const hingeRotation = startRotation.map((value, index) => lerp(value, endRotation[index], openProgress))
    applyFoundationTransforms(hingeRotation)
    setVisible(foundationRoot, true)
    setVisible(backgroundRoot, true)
    setVisible(floorRoot, true)
    setVisible(stageRoot, true)
    setVisible(background, true)
    setVisible(floor, true)
    setVisible(title, true)
    const floorProgress = easeOutCubic((stateElapsed - Math.max(0, holdMs - 250)) / Math.max(1, openMs * 0.55))
    setOpacity(floor, lerp(0.16, 1, floorProgress))
    setOpacity(background, lerp(0.18, 1, openProgress))
    setOpacity(title, lerp(0.12, 1, openProgress))
    const finalContentVisible = rawOpenProgress >= 1
    ;[cloudBack, cloudMiddle, cloudFront, drumRoot, drumPlane].forEach((entity) => {
      setVisible(entity, finalContentVisible)
    })
    if (finalContentVisible) {
      setOpacity(cloudBack, config.clouds.back.opacityMin)
      setOpacity(cloudMiddle, config.clouds.middle.opacityMin)
      setOpacity(cloudFront, config.clouds.front.opacityMin)
      setOpacity(drumPlane, 1)
    }
    placementGuideActive = stateElapsed < holdMs
    placementGuide.hidden = !placementGuideActive
    loading.hidden = placementGuideActive
    return rawOpenProgress
  }

  const updateFoundationGate = () => {
    const openProgress = prepareFoundationEntrance()
    const diagnostics = getFoundationDiagnostics()
    if (
      openProgress >= 1 &&
      Number.isFinite(diagnostics.backgroundFloorAngle) &&
      (diagnostics.backgroundFloorAngle < 80 || diagnostics.backgroundFloorAngle > 100) &&
      !backgroundAngleWarningShown
    ) {
      backgroundAngleWarningShown = true
      console.warn('[Page3] Background board is not perpendicular to floor.', diagnostics)
    }
    if (openProgress >= 1 && foundationIsRenderable(diagnostics)) {
      foundationRenderFrames += 1
      foundationWarnings.clear()
    } else {
      foundationRenderFrames = 0
      if (openProgress >= 1) warnFoundationProblems(diagnostics)
    }
    foundationReady = foundationRenderFrames >= config.foundation.readyRenderFrames
    renderDebug(diagnostics)
    return foundationReady
  }

  const unsubscribePreloader = preloaderSession.subscribe(bindReadyAssets)

  const resetVisuals = () => {
    foundationRenderFrames = 0
    foundationReady = false
    backgroundAngleWarningShown = false
    applyFoundationTransforms(config.layout.backboardHinge.rotationStartDegrees)
    setVisible(foundationRoot, true)
    setVisible(backgroundRoot, false)
    setVisible(floorRoot, false)
    setVisible(stageRoot, false)
    setVisible(background, true)
    setVisible(floor, true)
    setVisible(title, true)
    setVisible(cloudBack, false)
    setVisible(cloudMiddle, false)
    setVisible(cloudFront, false)
    setVisible(stageBack, false)
    setVisible(stageFront, false)
    setVisible(stageLights, false)
    setVisible(drumRoot, false)
    setVisible(drumPlane, false)
    setVisible(drumHit, false)
    setVisible(pearlRoot, false)
    setVisible(dragonPlane, false)
    setVisible(ironflowerPlane, false)
    setOpacity(background, 0)
    setOpacity(floor, 0)
    setOpacity(title, 0)
    setOpacity(stageBack, 0)
    setOpacity(stageFront, 0)
    setOpacity(stageLights, 0)
    setOpacity(dragonPlane, 0)
    setOpacity(ironflowerPlane, 0)
    setOpacity(pearlRoot.querySelector('#page3-pearl-plane'), 0)
    setOpacity(cloudBack, 0)
    setOpacity(cloudMiddle, 0)
    setOpacity(cloudFront, 0)
    setOpacity(drumPlane, 0)
    setTransform(drumRoot, {
      position: config.layout.drumPivot.position,
      rotation: config.layout.drumPivot.rotationDegrees,
      scale: config.layout.drumPivot.scale,
    })
    pearlRoot.object3D.position.copy(basePearlPosition)
    pearlRoot.object3D.scale.setScalar(1)
    dragonPlane.object3D.position.copy(baseDragonPosition)
    dragonPlane.object3D.scale.setScalar(1)
    ironflowerPlane.object3D.position.copy(baseIronPosition)
    ironflowerPlane.object3D.scale.setScalar(1)
    effects.clear()
  }

  const updateStepUi = () => {
    const content = contentForState(state)
    root.querySelector('[data-page3-step-number]').textContent = content.number
    root.querySelector('[data-page3-step-title]').textContent = content.title
    root.querySelector('[data-page3-step-description]').textContent = content.description
    const activeProgress = progressIdForState(state)
    root.querySelectorAll('[data-page3-progress]').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.page3Progress === activeProgress)
    })
  }

  const updatePrompt = () => {
    let text = ''
    if (state === PAGE3_STATES.READY) {
      text = foundationReady && stageAssetsReady && stateElapsed >= config.durations.initialSecondaryDelayMs
        ? PAGE3_CONTENT.ready.prompt
        : '正在唤醒火龙舞台……'
    } else if (state === PAGE3_STATES.WAIT_PEARL) text = PAGE3_CONTENT.waits.pearl
    else if (state === PAGE3_STATES.WAIT_DRAGON) {
      text = dragonReady ? PAGE3_CONTENT.waits.dragon : '舞龙影像正在加载…'
    } else if (state === PAGE3_STATES.WAIT_CLIMAX) {
      text = ironflowerReady ? PAGE3_CONTENT.waits.climax : '打铁花影像正在加载…'
    } else if ([
      PAGE3_STATES.STAGE_BUILDING,
      PAGE3_STATES.PEARL_GUIDING,
      PAGE3_STATES.DRAGON_DANCING,
      PAGE3_STATES.IRONFLOWER_CLIMAX,
    ].includes(state)) {
      text = contentForState(state).prompt
    } else if (state === PAGE3_STATES.CLOSING) {
      text = PAGE3_CONTENT.closing.prompt
    }
    prompt.textContent = text
    prompt.hidden = !text
  }

  const updateDrumEnabled = () => {
    const nextEnabled =
      tracked &&
      !suspended &&
      (
        (
          state === PAGE3_STATES.READY &&
          foundationReady &&
          stateElapsed >= config.durations.initialSecondaryDelayMs &&
          stageAssetsReady
        ) ||
        state === PAGE3_STATES.WAIT_PEARL ||
        (state === PAGE3_STATES.WAIT_DRAGON && dragonReady) ||
        (state === PAGE3_STATES.WAIT_CLIMAX && ironflowerReady)
      )
    drumEnabled = nextEnabled
    setVisible(drumHit, nextEnabled || debug)
    drumRoot.classList.toggle('is-enabled', nextEnabled)
    root.querySelector('[data-page3-debug-drum]')?.replaceChildren(String(nextEnabled))
    updatePrompt()
  }

  function renderDebug(currentDiagnostics = null) {
    if (!debug) return
    const diagnostics = currentDiagnostics || getFoundationDiagnostics()
    const formatNumber = (value) => Number.isFinite(value) ? value.toFixed(3) : 'NaN'
    const formatVector = (values) => values.map(formatNumber).join(', ')
    const formatTransform = (transform) =>
      `P(${formatVector(transform.position)}) R(${formatVector(transform.rotation)}) S(${formatVector(transform.scale)})`
    root.querySelector('[data-page3-debug-state]').textContent = state
    root.querySelector('[data-page3-debug-tracked]').textContent = String(tracked)
    root.querySelector('[data-page3-debug-critical]').textContent = String(criticalReady)
    root.querySelector('[data-page3-debug-deferred]').textContent = String(deferredSettled)
    root.querySelector('[data-page3-debug-hits]').textContent = String(drumHitCount)
    root.querySelector('[data-page3-debug-bg-texture]').textContent = String(diagnostics.bgTextureReady)
    root.querySelector('[data-page3-debug-floor-texture]').textContent = String(diagnostics.floorTextureReady)
    root.querySelector('[data-page3-debug-drum-texture]').textContent = String(diagnostics.drumTextureReady)
    root.querySelector('[data-page3-debug-mounted]').textContent =
      `${diagnostics.bgMounted} / ${diagnostics.floorMounted} / ${diagnostics.drumMounted}`
    root.querySelector('[data-page3-debug-foundation-visible]').textContent =
      `${diagnostics.bgVisible} / ${diagnostics.floorVisible} / ${diagnostics.drumVisible}`
    root.querySelector('[data-page3-debug-foundation-opacity]').textContent =
      `${formatNumber(diagnostics.bgOpacity)} / ${formatNumber(diagnostics.floorOpacity)} / ${formatNumber(diagnostics.drumOpacity)}`
    root.querySelector('[data-page3-debug-foundation-scale]').textContent =
      `${formatVector(diagnostics.bgScale)} / ${formatVector(diagnostics.floorScale)} / ${formatVector(diagnostics.drumScale)}`
    root.querySelector('[data-page3-debug-bg-world]').textContent = formatVector(diagnostics.bgWorldPosition)
    root.querySelector('[data-page3-debug-floor-world]').textContent = formatVector(diagnostics.floorWorldPosition)
    root.querySelector('[data-page3-debug-drum-world]').textContent = formatVector(diagnostics.drumWorldPosition)
    root.querySelector('[data-page3-debug-root-transform]').textContent = formatTransform(diagnostics.rootTransform)
    root.querySelector('[data-page3-debug-floor-transform]').textContent = formatTransform(diagnostics.floorRootTransform)
    root.querySelector('[data-page3-debug-hinge-position]').textContent =
      formatVector(diagnostics.hingeTransform.position)
    root.querySelector('[data-page3-debug-hinge-rotation]').textContent =
      formatVector(diagnostics.hingeTransform.rotation)
    root.querySelector('[data-page3-debug-bg-local]').textContent = formatVector(diagnostics.bgLocalPosition)
    root.querySelector('[data-page3-debug-bg-rotation]').textContent =
      formatVector(diagnostics.bgWorldRotation)
    root.querySelector('[data-page3-debug-angle]').textContent =
      `${formatNumber(diagnostics.backgroundFloorAngle)}°`
    root.querySelector('[data-page3-debug-stage-world]').textContent =
      formatVector(diagnostics.stageWorldPosition)
    root.querySelector('[data-page3-debug-stage-rotation]').textContent =
      formatVector(diagnostics.stageWorldRotation)
    root.querySelector('[data-page3-debug-target-found]').textContent = String(diagnostics.targetFound)
    root.querySelector('[data-page3-debug-root-visible]').textContent = String(diagnostics.page3RootVisible)
    root.querySelector('[data-page3-debug-foundation-frames]').textContent =
      `${foundationRenderFrames} / ${config.foundation.readyRenderFrames}`
    root.querySelector('[data-page3-debug-fps]').textContent = String(fps)
  }

  const setPage3State = (nextState) => {
    if (destroyed || state === nextState) return false
    state = nextState
    stateElapsed = 0
    stateFlags = new Set()
    drumEnabled = false
    updateStepUi()
    loading.hidden = state !== PAGE3_STATES.LOADING || placementGuideActive
    stepCard.hidden = [PAGE3_STATES.HIDDEN, PAGE3_STATES.LOADING, PAGE3_STATES.REAL_VIDEO, PAGE3_STATES.COMPLETE].includes(state)
    progress.hidden = stepCard.hidden
    endOptions.hidden = state !== PAGE3_STATES.END_OPTIONS
    prompt.hidden = true
    if (state !== PAGE3_STATES.LOADING) placementGuide.hidden = true

    if (state === PAGE3_STATES.HIDDEN) {
      ui.hidden = true
      stopStageMedia()
      resetVisuals()
      setVisible(anchor, false)
    } else {
      ui.hidden = false
    }

    if (state === PAGE3_STATES.LOADING) {
      loadingText.textContent = '正在唤醒火龙舞台……'
      resetVisuals()
      placementGuide.hidden = !placementGuideActive
    } else if (state === PAGE3_STATES.READY) {
      stopStageMedia()
      resetVisuals()
      showFoundation()
      placementGuide.hidden = true
      foundationRenderFrames = config.foundation.readyRenderFrames
      foundationReady = true
      preloaderSession.loadDeferred().catch(() => {})
    } else if (state === PAGE3_STATES.STAGE_BUILDING) {
      setVisible(stageBack, true)
      setVisible(stageFront, true)
      setVisible(stageLights, true)
    } else if (state === PAGE3_STATES.WAIT_PEARL) {
      setOpacity(stageBack, 1)
      setOpacity(stageFront, 1)
      setOpacity(stageLights, 0.5)
    } else if (state === PAGE3_STATES.PEARL_GUIDING) {
      setVisible(pearlRoot, true)
      setOpacity(pearlRoot.querySelector('#page3-pearl-plane'), 0)
    } else if (state === PAGE3_STATES.DRAGON_DANCING) {
      setVisible(dragonPlane, true)
      setOpacity(dragonPlane, 0)
      dragonPlane.object3D.position.set(
        baseDragonPosition.x + config.layout.dragonVideo.entranceOffset.x,
        baseDragonPosition.y + config.layout.dragonVideo.entranceOffset.y,
        baseDragonPosition.z,
      )
      dragonPlane.object3D.scale.setScalar(0.92)
      dragonVideo.loop = true
      dragonVideo.muted = true
      safePlay(dragonVideo, config.assets.dragonVideo, { restart: true })
      dragonBgm.volume = 0
    } else if (state === PAGE3_STATES.IRONFLOWER_CLIMAX) {
      setVisible(ironflowerPlane, true)
      setOpacity(ironflowerPlane, 0)
      ironflowerPlane.object3D.position.copy(baseIronPosition)
      ironflowerPlane.object3D.scale.setScalar(0.94)
      ironflowerVideo.loop = true
      ironflowerVideo.muted = true
      safePlay(ironflowerVideo, config.assets.ironflowerVideo, { restart: true })
      ironflowerSfx.volume = config.audio.ironflowerSfxVolume
      safePlay(ironflowerSfx, config.assets.ironflowerSfx, { restart: true })
      setAudioTarget(dragonBgm, 0)
      climaxBgm.volume = 0
      safePlay(climaxBgm, config.assets.climaxBgm, { restart: true })
      setAudioTarget(climaxBgm, config.audio.climaxBgmVolume)
      effects.setContinuous(true)
      effects.burst(24)
    } else if (state === PAGE3_STATES.CLOSING) {
      effects.setContinuous(false)
      setAudioTarget(dragonBgm, 0)
      setAudioTarget(climaxBgm, 0)
      ironflowerSfx.pause()
    } else if (state === PAGE3_STATES.END_OPTIONS) {
      stopStageMedia()
      setVisible(dragonPlane, false)
      setVisible(ironflowerPlane, false)
      setVisible(pearlRoot, false)
      setOpacity(stageLights, 0.18)
      effects.clear()
    } else if (state === PAGE3_STATES.REAL_VIDEO) {
      stopStageMedia({ reset: false })
      setVisible(anchor, false)
      ui.hidden = true
      realVideoOverlay.hidden = false
    } else if (state === PAGE3_STATES.COMPLETE) {
      stopStageMedia()
      setVisible(anchor, false)
      ui.hidden = true
      realVideoOverlay.hidden = true
      completeScreen.hidden = false
    }
    updateDrumEnabled()
    renderDebug()
    if (debug) console.info('[page3] state', state)
    return true
  }

  const playDrumFeedback = () => {
    drumFeedbackElapsed = 0
    const drumWorldPosition = new THREE.Vector3()
    drumRoot.object3D.getWorldPosition(drumWorldPosition)
    const drumStagePosition = stageRoot.object3D.worldToLocal(drumWorldPosition.clone())
    for (let index = 0; index < config.drum.rippleCount; index += 1) {
      effects.addRipple(
        {
          x: drumStagePosition.x,
          y: drumStagePosition.y,
          z: drumStagePosition.z + 0.01,
        },
        index * config.drum.rippleDelayMs,
      )
    }
  }

  const handleDrumClick = () => {
    if (!drumEnabled || destroyed) return false
    drumEnabled = false
    drumHitCount += 1
    unlockAudio()
    playDrumSound()
    playDrumFeedback()
    if (state === PAGE3_STATES.READY) setPage3State(PAGE3_STATES.STAGE_BUILDING)
    else if (state === PAGE3_STATES.WAIT_PEARL) setPage3State(PAGE3_STATES.PEARL_GUIDING)
    else if (state === PAGE3_STATES.WAIT_DRAGON) setPage3State(PAGE3_STATES.DRAGON_DANCING)
    else if (state === PAGE3_STATES.WAIT_CLIMAX) setPage3State(PAGE3_STATES.IRONFLOWER_CLIMAX)
    renderDebug()
    return true
  }

  const resetPage3 = () => {
    setPage3State(PAGE3_STATES.HIDDEN)
    stopStageMedia()
    realVideoPlayer.pause()
    realVideoPlayer.removeAttribute('src')
    realVideoPlayer.removeAttribute('poster')
    realVideoPlayer.load()
    realVideoOverlay.hidden = true
    completeScreen.hidden = true
    realVideoMessage.hidden = true
    drumHitCount = 0
    lostNotice.hidden = true
    hideError()
    setVisible(anchor, true)
    setPage3State(PAGE3_STATES.READY)
    tracked = lifecycle.isTracked()
    lostNotice.hidden = tracked
    renderDebug()
  }

  const openRealVideo = () => {
    if (state !== PAGE3_STATES.END_OPTIONS) return
    setPage3State(PAGE3_STATES.REAL_VIDEO)
    const path = config.assets.realVideo
    realVideoPlayer.poster = config.assets.realPoster
    realVideoPlayer.src = path
    realVideoPlayer.load()
    preloaderSession.loadRealVideo().catch((error) => {
      showError(`实拍视频加载失败：${path}`)
      console.error(error)
    })
    safePlay(realVideoPlayer, path, { restart: true }).then((played) => {
      realVideoMessage.hidden = played
    })
  }

  const closeRealVideo = () => {
    if (state !== PAGE3_STATES.REAL_VIDEO) return
    stopAndReset(realVideoPlayer)
    realVideoOverlay.hidden = true
    setVisible(anchor, true)
    ui.hidden = false
    setPage3State(PAGE3_STATES.READY)
  }

  realVideoPlayer.addEventListener('ended', () => {
    if (state === PAGE3_STATES.REAL_VIDEO) setPage3State(PAGE3_STATES.COMPLETE)
  }, { signal })

  completeScreen.addEventListener('click', () => {
    if (state === PAGE3_STATES.COMPLETE) resetPage3()
  }, { signal })

  root.querySelectorAll('[data-page3-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.page3Action
      if (action === 'restart') resetPage3()
      else if (action === 'real-video') openRealVideo()
      else if (action === 'close-real-video') closeRealVideo()
      else if (action === 'retry') {
        hideError()
        preloaderSession.retryFailed().then(() => preloaderSession.loadDeferred()).catch(() => {})
      }
    }, { signal })
  })

  const getDrumHit = (clientX, clientY) => {
    if (!scene.camera || !scene.canvas || !drumHit.object3D.visible) return false
    const rect = scene.canvas.getBoundingClientRect()
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, scene.camera)
    return raycaster.intersectObject(drumHit.object3D, true).length > 0
  }

  scene.canvas.addEventListener('pointerdown', (event) => {
    if (!drumEnabled || (event.pointerType === 'mouse' && event.button !== 0)) return
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }, { signal })
  scene.canvas.addEventListener('pointerup', (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
    pointerStart = null
    if (distance <= 12 && getDrumHit(event.clientX, event.clientY)) {
      event.preventDefault()
      handleDrumClick()
    }
  }, { signal })
  scene.canvas.addEventListener('pointercancel', () => {
    pointerStart = null
  }, { signal })

  const pauseForTracking = () => {
    if ([PAGE3_STATES.REAL_VIDEO, PAGE3_STATES.COMPLETE].includes(state)) return
    mediaPausedForTracking.clear()
    ;[dragonVideo, ironflowerVideo, dragonBgm, climaxBgm].forEach((media) => {
      if (media && !media.paused) {
        mediaPausedForTracking.add(media)
        media.pause()
      }
    })
    drumEnabled = false
    updateDrumEnabled()
  }

  const resumeAfterTracking = () => {
    if ([PAGE3_STATES.REAL_VIDEO, PAGE3_STATES.COMPLETE].includes(state)) return
    mediaPausedForTracking.forEach((media) => {
      const path = media.dataset.page3Src || media.currentSrc
      safePlay(media, path)
    })
    mediaPausedForTracking.clear()
    updateDrumEnabled()
  }

  const activate = () => {
    if ([PAGE3_STATES.REAL_VIDEO, PAGE3_STATES.COMPLETE].includes(state)) {
      tracked = true
      lostStartedAt = 0
      return
    }
    suspended = false
    tracked = true
    lostStartedAt = 0
    root.querySelector('.page1-ar')?.classList.remove('is-page2-active')
    root.querySelector('.page1-ar')?.classList.add('is-page3-active')
    onActivate?.()
    stable.setTracked(true)
    lostNotice.hidden = true
    ui.hidden = false
    preloaderSession.loadCritical().catch((error) => {
      showError(error.message)
    })
    if (state === PAGE3_STATES.HIDDEN) {
      stableElapsed = 0
      if (!placementGuideShown) {
        placementGuideShown = true
        placementGuideActive = true
        placementGuide.hidden = false
      }
      loading.hidden = placementGuideActive
      loadingText.textContent = '正在唤醒火龙舞台……'
    } else {
      setVisible(anchor, true)
      resumeAfterTracking()
    }
    renderDebug()
  }

  const loseTracking = () => {
    if (!tracked) return
    if ([PAGE3_STATES.REAL_VIDEO, PAGE3_STATES.COMPLETE].includes(state)) {
      tracked = false
      return
    }
    tracked = false
    lostStartedAt = performance.now()
    stable.setTracked(false)
    pauseForTracking()
    renderDebug()
  }

  lifecycle = createTargetLifecycle({
    target,
    lostDelayMs: config.tracking.noticeDelayMs,
    signal,
    onFound: activate,
    onLost: loseTracking,
    onLostConfirmed() {
      if (!tracked && ![PAGE3_STATES.REAL_VIDEO, PAGE3_STATES.COMPLETE].includes(state)) {
        lostNotice.hidden = false
      }
    },
    onDebug: () => {},
  })

  const updateCloud = (entity, cloudConfig, elapsed, opacityScale = 1) => {
    if (!entity.object3D.visible) return
    const layoutConfig = entity === cloudBack
      ? config.layout.cloudBack
      : entity === cloudMiddle
        ? config.layout.cloudMiddle
        : config.layout.cloudFront
    const angle = (elapsed / cloudConfig.periodMs) * Math.PI * 2 + cloudConfig.phase
    entity.object3D.position.x = layoutConfig.position[0] + Math.sin(angle) * cloudConfig.amplitudeX
    entity.object3D.position.y = layoutConfig.position[1] + Math.sin(angle * 0.82) * cloudConfig.amplitudeY
    entity.object3D.position.z = layoutConfig.position[2]
    const opacity = lerp(cloudConfig.opacityMin, cloudConfig.opacityMax, (Math.sin(angle + 0.7) + 1) / 2)
    setOpacity(entity, opacity * opacityScale)
  }

  const updateDrumAnimation = (elapsed) => {
    if (!drumRoot.object3D.visible) return
    if (drumFeedbackElapsed >= 0) {
      drumFeedbackElapsed += elapsed
      const progress = clamp(drumFeedbackElapsed / config.durations.drumFeedbackMs)
      const stops = config.drum.hitStops
      const scales = config.drum.hitScales
      let scale = scales[scales.length - 1]
      for (let index = 1; index < stops.length; index += 1) {
        if (progress <= stops[index]) {
          const local = (progress - stops[index - 1]) / (stops[index] - stops[index - 1])
          scale = lerp(scales[index - 1], scales[index], easeInOutCubic(local))
          break
        }
      }
      drumRoot.object3D.scale.setScalar(scale)
      if (progress >= 1) {
        drumFeedbackElapsed = -1
        drumRoot.object3D.scale.setScalar(1)
      }
    } else if (drumEnabled) {
      const pulse = (Math.sin((performance.now() / config.drum.idlePeriodMs) * Math.PI * 2) + 1) / 2
      drumRoot.object3D.scale.setScalar(lerp(config.drum.idleScaleMin, config.drum.idleScaleMax, pulse))
    } else {
      drumRoot.object3D.scale.setScalar(1)
    }
  }

  const updateStageBuilding = () => {
    const backProgress = easeOutCubic(stateElapsed / 800)
    setOpacity(stageBack, backProgress)
    stageBack.object3D.scale.setScalar(lerp(0.96, 1, backProgress))
    const frameProgress = easeInOutCubic((stateElapsed - 500) / 1500)
    setOpacity(stageFront, frameProgress)
    stageFront.object3D.scale.set(
      lerp(0.94, 1, frameProgress),
      lerp(0.97, 1, frameProgress),
      1,
    )
    stageFront.object3D.position.y = lerp(-0.025, 0, frameProgress)
    const lightsProgress = easeOutCubic((stateElapsed - 2200) / 800)
    setOpacity(stageLights, lightsProgress * 0.58)
    if (stateElapsed >= 2500 && !stateFlags.has('stage-sheen')) {
      stateFlags.add('stage-sheen')
      effects.addRipple({ x: 0, y: -0.02, z: config.z.effects }, 0, true)
    }
  }

  const updatePearl = (delta) => {
    const progress = clamp(stateElapsed / config.durations.pearlGuidingMs)
    const point = pearlCurve.getPoint(easeInOutCubic(progress))
    const bob = Math.sin(stateElapsed * 0.008) * 0.012
    pearlRoot.object3D.position.set(
      basePearlPosition.x + point.x,
      basePearlPosition.y + point.y + bob,
      basePearlPosition.z,
    )
    pearlRoot.object3D.rotation.z += delta * 0.00018
    const entrance = clamp(stateElapsed / 600)
    const overshoot = entrance < 0.7
      ? lerp(0.5, 1.1, easeOutCubic(entrance / 0.7))
      : lerp(1.1, 1, (entrance - 0.7) / 0.3)
    const pulse = 1 + Math.sin(stateElapsed * 0.006) * 0.04
    pearlRoot.object3D.scale.setScalar(overshoot * pulse)
    setOpacity(pearlRoot.querySelector('#page3-pearl-plane'), entrance)
    if (Math.floor(stateElapsed / 180) !== Math.floor((stateElapsed - delta) / 180)) {
      effects.burst(2, {
        x: pearlRoot.object3D.position.x,
        y: pearlRoot.object3D.position.y,
        z: config.z.effects,
      })
    }
  }

  const updateDragonEntrance = () => {
    const progress = easeOutCubic(stateElapsed / 800)
    setOpacity(dragonPlane, progress)
    dragonPlane.object3D.scale.setScalar(lerp(0.92, 1, progress))
    dragonPlane.object3D.position.set(
      lerp(baseDragonPosition.x + config.layout.dragonVideo.entranceOffset.x, baseDragonPosition.x, progress),
      lerp(baseDragonPosition.y + config.layout.dragonVideo.entranceOffset.y, baseDragonPosition.y, progress),
      baseDragonPosition.z,
    )
    setOpacity(stageLights, lerp(0.5, 0.82, easeOutCubic(stateElapsed / 1600)))
    if (stateElapsed >= 220 && !stateFlags.has('dragon-bgm')) {
      stateFlags.add('dragon-bgm')
      safePlay(dragonBgm, config.assets.dragonBgm, { restart: true })
      setAudioTarget(dragonBgm, config.audio.dragonBgmVolume)
    }
  }

  const updateClimax = () => {
    const entrance = easeOutCubic(stateElapsed / 700)
    setOpacity(ironflowerPlane, entrance)
    ironflowerPlane.object3D.scale.setScalar(lerp(0.94, 1, entrance))
    let lightOpacity = 0.86
    if (stateElapsed < 2000) lightOpacity = lerp(0.82, 1, Math.sin((stateElapsed / 2000) * Math.PI))
    else if (stateElapsed > 6000) lightOpacity = lerp(1, 0.48, (stateElapsed - 6000) / 2000)
    setOpacity(stageLights, lightOpacity)
    if (stateElapsed >= 2300 && !stateFlags.has('climax-sheen')) {
      stateFlags.add('climax-sheen')
      effects.addRipple({ x: 0, y: -0.02, z: config.z.effects }, 0, true)
    }
  }

  const updateClosing = () => {
    const gather = easeInOutCubic(stateElapsed / 2000)
    const fade = clamp((stateElapsed - 2000) / 1000)
    dragonPlane.object3D.position.lerpVectors(baseDragonPosition, new THREE.Vector3(-0.04, -0.02, baseDragonPosition.z), gather)
    ironflowerPlane.object3D.position.lerpVectors(baseIronPosition, new THREE.Vector3(0.08, -0.02, baseIronPosition.z), gather)
    dragonPlane.object3D.scale.setScalar(lerp(1, 0.88, gather))
    ironflowerPlane.object3D.scale.setScalar(lerp(1, 0.86, gather))
    pearlRoot.object3D.position.lerpVectors(basePearlPosition, new THREE.Vector3(0.02, -0.02, basePearlPosition.z), gather)
    setOpacity(dragonPlane, 1 - fade)
    setOpacity(ironflowerPlane, 1 - fade)
    setOpacity(pearlRoot.querySelector('#page3-pearl-plane'), 1 - fade)
    setOpacity(stageLights, lerp(0.7, 0.2, clamp(stateElapsed / config.durations.closingMs)))
    if (stateElapsed >= 2600 && !stateFlags.has('closing-ripple')) {
      stateFlags.add('closing-ripple')
      effects.addRipple({ x: 0, y: -0.02, z: config.z.effects }, 0, true)
    }
  }

  const update = (time, delta) => {
    stable.update(time)
    fpsElapsed += delta
    fpsFrames += 1
    if (fpsElapsed >= 1000) {
      fps = Math.round((fpsFrames * 1000) / fpsElapsed)
      fpsElapsed = 0
      fpsFrames = 0
      renderDebug()
    }
    if (destroyed || visibilityPaused) return
    if (!tracked || suspended) return
    if (state === PAGE3_STATES.HIDDEN) {
      if (stable.hasValidFullTransform()) stableElapsed += delta
      else stableElapsed = 0
      if (stableElapsed >= config.durations.trackingStableMs) setPage3State(PAGE3_STATES.LOADING)
      return
    }
    if ([PAGE3_STATES.REAL_VIDEO, PAGE3_STATES.COMPLETE].includes(state)) return
    stateElapsed += delta
    updateAudioFades(delta)
    effects.update(delta)
    const cloudOpacityScale = state === PAGE3_STATES.IRONFLOWER_CLIMAX ? config.clouds.climaxOpacityScale : 1
    updateCloud(cloudBack, config.clouds.back, time, cloudOpacityScale)
    updateCloud(cloudMiddle, config.clouds.middle, time, cloudOpacityScale)
    updateCloud(cloudFront, config.clouds.front, time, cloudOpacityScale)
    updateDrumAnimation(delta)

    if (state === PAGE3_STATES.LOADING) {
      if (updateFoundationGate() && criticalReady) setPage3State(PAGE3_STATES.READY)
      return
    }
    if (state === PAGE3_STATES.READY) {
      if (stateElapsed >= config.durations.initialSecondaryDelayMs) {
        setVisible(stageBack, true)
        setOpacity(stageBack, 0.2)
      }
      updateDrumEnabled()
    } else if (state === PAGE3_STATES.STAGE_BUILDING) {
      updateStageBuilding()
      if (stateElapsed >= config.durations.stageBuildingMs) setPage3State(PAGE3_STATES.WAIT_PEARL)
    } else if (state === PAGE3_STATES.WAIT_PEARL) {
      updateDrumEnabled()
    } else if (state === PAGE3_STATES.PEARL_GUIDING) {
      updatePearl(delta)
      if (stateElapsed >= config.durations.pearlGuidingMs) {
        pearlRoot.object3D.position.set(
          basePearlPosition.x + config.layout.pearlPath.at(-1).x,
          basePearlPosition.y + config.layout.pearlPath.at(-1).y,
          basePearlPosition.z,
        )
        setPage3State(PAGE3_STATES.WAIT_DRAGON)
      }
    } else if (state === PAGE3_STATES.WAIT_DRAGON) {
      pearlRoot.object3D.position.y += Math.sin(time * 0.004) * 0.0005
      updateDrumEnabled()
    } else if (state === PAGE3_STATES.DRAGON_DANCING) {
      updateDragonEntrance()
      pearlRoot.object3D.position.y += Math.sin(time * 0.004) * 0.00045
      if (stateElapsed >= config.durations.dragonDancingMs) setPage3State(PAGE3_STATES.WAIT_CLIMAX)
    } else if (state === PAGE3_STATES.WAIT_CLIMAX) {
      setOpacity(dragonPlane, 1)
      updateDrumEnabled()
    } else if (state === PAGE3_STATES.IRONFLOWER_CLIMAX) {
      updateClimax()
      if (stateElapsed >= config.durations.climaxMs) setPage3State(PAGE3_STATES.CLOSING)
    } else if (state === PAGE3_STATES.CLOSING) {
      updateClosing()
      if (stateElapsed >= config.durations.closingMs) setPage3State(PAGE3_STATES.END_OPTIONS)
    }
  }

  scene.__page3RuntimeTick = update
  registerPage3Runtime()
  scene.setAttribute('page3-runtime', '')

  const applyAllRenderOrders = () => {
    root.querySelectorAll('[data-render-order]').forEach((entity) => {
      applyRenderOrder(entity, Number(entity.dataset.renderOrder))
    })
  }
  scene.addEventListener('renderstart', applyAllRenderOrders, { once: true, signal })
  root.querySelectorAll('[data-render-order]').forEach((entity) => {
    entity.addEventListener('object3dset', applyAllRenderOrders, { signal })
  })

  document.addEventListener('visibilitychange', () => {
    visibilityPaused = document.hidden
    if (document.hidden) pauseForTracking()
    else if (tracked) resumeAfterTracking()
  }, { signal })

  if (debug) {
    const placeDebugAnchor = () => {
      anchor.object3D.position.set(0, -0.72, -3.05)
      anchor.object3D.rotation.set(THREE.MathUtils.degToRad(-45), 0, 0)
      anchor.object3D.scale.setScalar(1.4)
      setVisible(anchor, true)
    }
    const simulate = () => {
      tracked = true
      suspended = false
      if (!placementGuideShown) {
        placementGuideShown = true
        placementGuideActive = true
        placementGuide.hidden = false
      }
      root.querySelector('.page1-ar')?.classList.remove('is-page2-active')
      root.querySelector('.page1-ar')?.classList.add('is-page3-active')
      onActivate?.()
      ui.hidden = false
      preloaderSession.loadCritical().then(() => {
        placeDebugAnchor()
        setPage3State(PAGE3_STATES.LOADING)
      }).catch((error) => showError(error.message))
    }
    const nextDebugState = () => {
      const transitions = {
        [PAGE3_STATES.READY]: PAGE3_STATES.STAGE_BUILDING,
        [PAGE3_STATES.STAGE_BUILDING]: PAGE3_STATES.WAIT_PEARL,
        [PAGE3_STATES.WAIT_PEARL]: PAGE3_STATES.PEARL_GUIDING,
        [PAGE3_STATES.PEARL_GUIDING]: PAGE3_STATES.WAIT_DRAGON,
        [PAGE3_STATES.WAIT_DRAGON]: PAGE3_STATES.DRAGON_DANCING,
        [PAGE3_STATES.DRAGON_DANCING]: PAGE3_STATES.WAIT_CLIMAX,
        [PAGE3_STATES.WAIT_CLIMAX]: PAGE3_STATES.IRONFLOWER_CLIMAX,
        [PAGE3_STATES.IRONFLOWER_CLIMAX]: PAGE3_STATES.CLOSING,
        [PAGE3_STATES.CLOSING]: PAGE3_STATES.END_OPTIONS,
      }
      if (transitions[state]) setPage3State(transitions[state])
    }
    root.querySelector('[data-page3-debug-action="simulate"]').addEventListener('click', simulate, { signal })
    root.querySelector('[data-page3-debug-action="drum"]').addEventListener('click', () => {
      drumEnabled = true
      handleDrumClick()
    }, { signal })
    root.querySelector('[data-page3-debug-action="next"]').addEventListener('click', nextDebugState, { signal })
    root.querySelector('[data-page3-debug-action="reset"]').addEventListener('click', resetPage3, { signal })
    window.page3Debug = {
      config,
      activate: simulate,
      drum: () => {
        drumEnabled = true
        return handleDrumClick()
      },
      next: nextDebugState,
      reset: resetPage3,
      getState: () => ({ state, tracked, drumEnabled, drumHitCount, criticalReady, deferredSettled }),
    }
  }

  resetVisuals()
  setVisible(anchor, false)
  ui.hidden = true
  loading.hidden = true
  realVideoOverlay.hidden = true
  completeScreen.hidden = true
  renderDebug()

  return {
    startAssetLoading() {
      return preloaderSession.loadCritical()
    },
    suspendForOtherTarget() {
      if (state === PAGE3_STATES.HIDDEN && !tracked) return
      suspended = true
      tracked = false
      stable.setTracked(false)
      pauseForTracking()
      root.querySelector('.page1-ar')?.classList.remove('is-page3-active')
      lostNotice.hidden = true
      if (![PAGE3_STATES.REAL_VIDEO, PAGE3_STATES.COMPLETE].includes(state)) setVisible(anchor, false)
    },
    getState: () => ({
      state,
      tracked,
      suspended,
      drumEnabled,
      drumHitCount,
      criticalReady,
      deferredSettled,
      fps,
      foundation: getFoundationDiagnostics(),
      backgroundFloorAngle: config.layout.backboardHinge.rotationEndDegrees[0],
    }),
    destroy() {
      destroyed = true
      abortController.abort()
      lifecycle?.destroy()
      stable.destroy()
      effects.destroy()
      unsubscribePreloader()
      preloaderSession.destroy()
      stopStageMedia()
      stopAndReset(realVideoPlayer)
      if (scene.__page3RuntimeTick === update) scene.__page3RuntimeTick = null
      root.querySelector('.page1-ar')?.classList.remove('is-page3-active')
      if (debug) {
        delete window.page3Debug
        delete window.page3Preloader
      }
    },
  }
}
