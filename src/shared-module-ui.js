const MODULE_COPY = Object.freeze({
  0: { number: '01', title: '竹骨成龙', loading: '正在加载《竹骨成龙》' },
  1: { number: '02', title: '龙脉探源', loading: '正在加载《龙脉探源》' },
  2: { number: '03', title: '火舞夜空', loading: '正在加载《火舞夜空》' },
})

const STAGE_COPY = Object.freeze({
  idle: '正在请求基础资源',
  loading: '正在请求基础资源',
  loaded: '正在解码图片',
  decoding: '正在解码图片',
  decoded: '正在上传AR纹理',
  gpu: '正在上传AR纹理',
  gpuReady: '正在建立AR画面',
  scene: '正在建立AR画面',
  complete: '加载完成',
  failed: '部分资源加载失败',
  timedOut: '部分资源加载失败',
})

const hasValidTextureImage = (image) => Boolean(image && (
  (Number(image.naturalWidth) > 0 && Number(image.naturalHeight) > 0)
  || (Number(image.videoWidth) > 0 && Number(image.videoHeight) > 0)
  || (Number(image.width) > 0 && Number(image.height) > 0)
))

const collectMappedMaterials = (entity) => {
  const materials = []
  entity?.object3D?.traverse?.((object) => {
    const entries = Array.isArray(object.material) ? object.material : [object.material]
    entries.filter((material) => material?.map).forEach((material) => materials.push(material))
  })
  return materials
}

const isEffectivelyVisible = (entity) => {
  let object = entity?.object3D
  if (!object) return false
  while (object) {
    if (object.visible === false) return false
    object = object.parent
  }
  return true
}

const hasFiniteWorldScale = (entity) => {
  const THREE = window.AFRAME?.THREE
  if (!THREE || !entity?.object3D?.getWorldScale) return false
  const scale = new THREE.Vector3()
  entity.object3D.updateWorldMatrix?.(true, false)
  entity.object3D.getWorldScale(scale)
  return [scale.x, scale.y, scale.z].every(
    (value) => Number.isFinite(value) && Math.abs(value) > 1e-6,
  )
}

export function inspectFirstVisualFrame({
  sceneEl,
  entities = [],
  isAnchorVisible = () => false,
} = {}) {
  const entityStates = entities.map((input) => {
    const descriptor = input?.entity ? input : { entity: input }
    const {
      entity,
      requireVisible = true,
      requireTexture = true,
      requireOpacity = true,
    } = descriptor
    const mappedMaterials = collectMappedMaterials(entity)
    const validMappedMaterials = mappedMaterials.filter((material) =>
      hasValidTextureImage(material.map?.image))
    const mounted = Boolean(entity?.object3D?.parent && sceneEl?.contains?.(entity))
    const visible = isEffectivelyVisible(entity)
    const opacity = validMappedMaterials.length
      ? Math.max(...validMappedMaterials.map((material) =>
          Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 0))
      : 0
    const textureReady = validMappedMaterials.length > 0
    const scaleReady = hasFiniteWorldScale(entity)
    return {
      id: entity?.id || '',
      mounted,
      visible,
      textureReady,
      opacity,
      scaleReady,
      ready: mounted
        && scaleReady
        && (!requireVisible || visible)
        && (!requireTexture || textureReady)
        && (!requireOpacity || opacity > 0),
    }
  })
  const anchorVisible = Boolean(isAnchorVisible())
  return {
    ready: Boolean(
      sceneEl?.renderer
      && anchorVisible
      && entityStates.length > 0
      && entityStates.every((state) => state.ready)
    ),
    anchorVisible,
    entities: entityStates,
  }
}

const nextAnimationFrame = (signal) => new Promise((resolve) => {
  if (signal?.aborted) {
    resolve(false)
    return
  }
  let frame = 0
  const onAbort = () => {
    if (frame) cancelAnimationFrame(frame)
    resolve(false)
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  frame = requestAnimationFrame(() => {
    signal?.removeEventListener('abort', onAbort)
    resolve(true)
  })
})

export async function waitForFirstVisualFrame({
  sceneEl,
  entities,
  isAnchorVisible,
  isActive = () => true,
  signal,
  requiredFrames = 2,
} = {}) {
  let readyFrames = 0
  while (!signal?.aborted && isActive()) {
    if (!await nextAnimationFrame(signal)) return false
    const current = inspectFirstVisualFrame({ sceneEl, entities, isAnchorVisible })
    readyFrames = current.ready ? readyFrames + 1 : 0
    if (readyFrames >= requiredFrames) {
      return inspectFirstVisualFrame({ sceneEl, entities, isAnchorVisible }).ready
    }
  }
  return false
}

export const sharedModuleUiMarkup = () => `
  <header class="module-header" hidden>
    <span data-module-number>01</span>
    <h1 data-module-title>竹骨成龙</h1>
  </header>
  <p class="module-bottom-hint" hidden>
    扫描成功后，请保持手机与识别卡垂直，以获得更好的体验
  </p>
  <p class="shared-target-lost" role="status" hidden>
    识别已丢失，请重新扫描识别卡
  </p>
  <section class="module-loading-overlay" role="status" hidden>
    <strong class="module-loading-title" data-module-loading-title>正在加载</strong>
    <p data-module-loading-stage>正在请求基础资源</p>
    <p class="module-loading-network-hint">请保持网络畅通</p>
    <small data-module-loading-resource></small>
    <i class="module-loading-track"><b data-module-loading-bar></b></i>
    <span class="module-loading-percentage" data-module-loading-progress>0%</span>
    <code data-module-loading-path hidden></code>
    <button type="button" data-module-loading-retry hidden>重新加载</button>
  </section>
`

export const getModuleEntryVisibility = ({
  targetFound = false,
  pendingEnter = false,
  moduleEntered = false,
} = {}) => ({
  loadingVisible: Boolean(targetFound && pendingEnter && !moduleEntered),
  moduleControlsVisible: Boolean(moduleEntered),
})

export function createSharedModuleUi({ root, signal }) {
  const header = root.querySelector('.module-header')
  const number = root.querySelector('[data-module-number]')
  const title = root.querySelector('[data-module-title]')
  const bottomHint = root.querySelector('.module-bottom-hint')
  const lost = root.querySelector('.shared-target-lost')
  const loading = root.querySelector('.module-loading-overlay')
  const loadingTitle = root.querySelector('[data-module-loading-title]')
  const loadingProgress = root.querySelector('[data-module-loading-progress]')
  const loadingBar = root.querySelector('[data-module-loading-bar]')
  const loadingStage = root.querySelector('[data-module-loading-stage]')
  const loadingResource = root.querySelector('[data-module-loading-resource]')
  const loadingPath = root.querySelector('[data-module-loading-path]')
  const retry = root.querySelector('[data-module-loading-retry]')
  let retryAction = null
  let hideTimer = 0
  let completionRequested = false
  let loaderHiddenAt = 0
  const loaderShowCounts = { 0: 0, 1: 0, 2: 0 }
  const loaderHideCounts = { 0: 0, 1: 0, 2: 0 }
  let loaderState = {
    targetIndex: -1,
    title: '',
    progress: 0,
    stage: 'idle',
    currentPath: '',
    failed: false,
    trackingLost: false,
  }
  const debug = new URLSearchParams(window.location.search).get('debug') === '1'

  retry.addEventListener('click', () => retryAction?.(), { signal })
  signal?.addEventListener('abort', () => window.clearTimeout(hideTimer), { once: true })

  const resourceName = (path = '') => {
    const cleanPath = String(path).split('?')[0]
    const name = cleanPath.split('/').filter(Boolean).pop() || ''
    try {
      return decodeURIComponent(name)
    } catch {
      return name
    }
  }

  const renderLoader = () => {
    const copy = MODULE_COPY[loaderState.targetIndex]
    const value = Math.max(0, Math.min(100, Number(loaderState.progress) || 0))
    loadingTitle.textContent = loaderState.title || copy?.loading || '正在加载AR内容'
    loadingProgress.textContent = `${Math.round(value)}%`
    loadingBar.style.width = `${value}%`
    loadingStage.textContent = loaderState.trackingLost
      ? '识别已丢失，请重新对准'
      : STAGE_COPY[loaderState.failed ? 'failed' : loaderState.stage] || STAGE_COPY.idle
    loadingResource.textContent = resourceName(loaderState.currentPath)
    loadingPath.textContent = loaderState.currentPath
    loadingPath.hidden = !debug || !loaderState.currentPath
    retry.hidden = !loaderState.failed
  }

  const checkDuplicateHeaders = () => {
    if (!import.meta.env.DEV) return
    requestAnimationFrame(() => {
      const visibleHeaders = [...root.querySelectorAll('.module-header')]
        .filter((element) => !element.hidden && getComputedStyle(element).display !== 'none')
      if (visibleHeaders.length > 1) console.warn('[UI] Duplicate module headers detected')
    })
  }

  return {
    activate(targetIndex) {
      const copy = MODULE_COPY[targetIndex]
      if (!copy) return
      number.textContent = copy.number
      title.textContent = copy.title
      header.hidden = false
      bottomHint.hidden = false
      lost.hidden = true
      checkDuplicateHeaders()
    },
    deactivate() {
      header.hidden = true
      bottomHint.hidden = true
      lost.hidden = true
      window.clearTimeout(hideTimer)
      loading.classList.remove('is-complete')
      loading.hidden = true
      completionRequested = false
    },
    showLost() {
      loaderState.trackingLost = true
      if (!loading.hidden) renderLoader()
      else lost.hidden = false
    },
    hideLost() {
      loaderState.trackingLost = false
      lost.hidden = true
      if (!loading.hidden) renderLoader()
    },
    showLoading(targetIndexOrState, progress = 0, failed = false, onRetry = null) {
      const next = typeof targetIndexOrState === 'object'
        ? targetIndexOrState
        : {
            targetIndex: targetIndexOrState,
            progress,
            failed,
            onRetry,
          }
      const nextTargetIndex = next.targetIndex ?? loaderState.targetIndex
      const countsAsShow = loading.hidden || loaderState.targetIndex !== nextTargetIndex
      window.clearTimeout(hideTimer)
      completionRequested = false
      loading.classList.remove('is-complete')
      loaderState = {
        ...loaderState,
        targetIndex: nextTargetIndex,
        title: next.title || '',
        progress: Math.max(loaderState.targetIndex === nextTargetIndex ? loaderState.progress : 0, next.progress || 0),
        stage: next.stage || 'idle',
        currentPath: next.currentPath || '',
        failed: Boolean(next.failed),
      }
      retryAction = next.onRetry || null
      lost.hidden = true
      renderLoader()
      loading.hidden = false
      if (countsAsShow && Object.prototype.hasOwnProperty.call(loaderShowCounts, nextTargetIndex)) {
        loaderShowCounts[nextTargetIndex] += 1
      }
    },
    showError(targetIndex, failure = {}, onRetry = null) {
      this.showLoading({
        targetIndex,
        progress: failure.progress ?? loaderState.progress,
        stage: failure.stage || 'failed',
        currentPath: failure.path || '',
        failed: true,
        onRetry,
      })
    },
    completeLoading() {
      if (loading.hidden || completionRequested) return false
      completionRequested = true
      loaderState = {
        ...loaderState,
        progress: 100,
        stage: 'complete',
        currentPath: '',
        failed: false,
        trackingLost: false,
      }
      retry.hidden = true
      renderLoader()
      requestAnimationFrame(() => {
        if (!completionRequested || loading.hidden) return
        loading.classList.add('is-complete')
      })
      hideTimer = window.setTimeout(() => {
        const completedTarget = loaderState.targetIndex
        loading.hidden = true
        loading.classList.remove('is-complete')
        retryAction = null
        completionRequested = false
        loaderHiddenAt = performance.now()
        if (Object.prototype.hasOwnProperty.call(loaderHideCounts, completedTarget)) {
          loaderHideCounts[completedTarget] += 1
        }
      }, 260)
      return true
    },
    hideLoading() {
      window.clearTimeout(hideTimer)
      loading.hidden = true
      loading.classList.remove('is-complete')
      retry.hidden = true
      retryAction = null
      completionRequested = false
      loaderState = {
        ...loaderState,
        progress: 0,
        stage: 'idle',
        currentPath: '',
        failed: false,
        trackingLost: false,
      }
    },
    setModuleControlsVisible(visible) {
      bottomHint.hidden = !visible
    },
    getState() {
      return {
        moduleHeaderVisible: !header.hidden,
        bottomHintVisible: !bottomHint.hidden,
        lostTrackingUIVisible: !lost.hidden,
        loadingVisible: !loading.hidden,
        loadingUiVisible: !loading.hidden,
        activeLoadingPage: loading.hidden ? null : loaderState.targetIndex,
        loadingProgress: loaderState.progress,
        loaderHiddenAt,
        page2LoaderShowCount: loaderShowCounts[1],
        page2LoaderHideCount: loaderHideCounts[1],
        loaderShowCounts: { ...loaderShowCounts },
        loaderHideCounts: { ...loaderHideCounts },
        loader: { ...loaderState },
      }
    },
  }
}
