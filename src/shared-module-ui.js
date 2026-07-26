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

const isInsideCameraView = (sceneEl, entity) => {
  const THREE = window.AFRAME?.THREE
  const camera = sceneEl?.camera
  if (!THREE || !camera || !entity?.object3D) return false
  entity.object3D.updateWorldMatrix?.(true, true)
  camera.updateWorldMatrix?.(true, false)
  camera.updateProjectionMatrix?.()
  const bounds = new THREE.Box3().setFromObject(entity.object3D)
  if (bounds.isEmpty()) return false
  const projected = []
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        projected.push(new THREE.Vector3(x, y, z).project(camera))
      }
    }
  }
  const values = (axis) => projected.map((point) => point[axis]).filter(Number.isFinite)
  const xValues = values('x')
  const yValues = values('y')
  const zValues = values('z')
  if (!xValues.length || !yValues.length || !zValues.length) return false
  return Math.max(...xValues) >= -1
    && Math.min(...xValues) <= 1
    && Math.max(...yValues) >= -1
    && Math.min(...yValues) <= 1
    && Math.max(...zValues) >= -1
    && Math.min(...zValues) <= 1
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
      requireInView = true,
      minOpacity = Number.EPSILON,
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
    const inView = isInsideCameraView(sceneEl, entity)
    return {
      id: entity?.id || '',
      mounted,
      visible,
      textureReady,
      opacity,
      scaleReady,
      inView,
      ready: mounted
        && scaleReady
        && (!requireVisible || visible)
        && (!requireTexture || textureReady)
        && (!requireOpacity || opacity >= minOpacity)
        && (!requireInView || inView),
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
  isVisualReady = () => true,
  isActive = () => true,
  signal,
  requiredFrames = 2,
} = {}) {
  let readyFrames = 0
  let lastRendererFrame = Number(sceneEl?.renderer?.info?.render?.frame)
  while (!signal?.aborted && isActive()) {
    if (!await nextAnimationFrame(signal)) return false
    const current = inspectFirstVisualFrame({ sceneEl, entities, isAnchorVisible })
    const rendererFrame = Number(sceneEl?.renderer?.info?.render?.frame)
    const rendererAdvanced = !Number.isFinite(rendererFrame)
      || !Number.isFinite(lastRendererFrame)
      || rendererFrame !== lastRendererFrame
    readyFrames = current.ready && isVisualReady() && rendererAdvanced
      ? readyFrames + 1
      : 0
    lastRendererFrame = rendererFrame
    if (readyFrames >= requiredFrames) {
      return inspectFirstVisualFrame({ sceneEl, entities, isAnchorVisible }).ready
        && isVisualReady()
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
    <div class="module-loading-network-hint">
      <p>请保持网络畅通</p>
      <p>如果页面长时间无变化，请刷新网页</p>
    </div>
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
  let activeTargetIndex = -1
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

  const resetLoaderState = (targetIndex = -1) => {
    window.clearTimeout(hideTimer)
    loading.classList.remove('is-complete')
    loading.hidden = true
    retry.hidden = true
    retryAction = null
    completionRequested = false
    loaderState = {
      targetIndex,
      title: '',
      progress: 0,
      stage: 'idle',
      currentPath: '',
      failed: false,
      trackingLost: false,
    }
  }

  return {
    activate(targetIndex) {
      const copy = MODULE_COPY[targetIndex]
      if (!copy) return
      if (activeTargetIndex !== targetIndex) resetLoaderState(targetIndex)
      activeTargetIndex = targetIndex
      number.textContent = copy.number
      title.textContent = copy.title
      header.hidden = false
      bottomHint.hidden = false
      lost.hidden = true
      checkDuplicateHeaders()
    },
    deactivate() {
      activeTargetIndex = -1
      header.hidden = true
      bottomHint.hidden = true
      lost.hidden = true
      resetLoaderState()
    },
    showLost(targetIndex = activeTargetIndex) {
      if (targetIndex !== activeTargetIndex) return false
      loaderState.trackingLost = true
      if (!loading.hidden) renderLoader()
      else lost.hidden = false
      return true
    },
    hideLost(targetIndex = activeTargetIndex) {
      if (targetIndex !== activeTargetIndex) return false
      loaderState.trackingLost = false
      lost.hidden = true
      if (!loading.hidden) renderLoader()
      return true
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
      if (activeTargetIndex >= 0 && nextTargetIndex !== activeTargetIndex) return false
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
      return true
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
    completeLoading(targetIndex = loaderState.targetIndex) {
      if (
        targetIndex !== activeTargetIndex
        || loaderState.targetIndex !== targetIndex
        || loading.hidden
        || completionRequested
      ) return false
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
        if (targetIndex !== activeTargetIndex || loaderState.targetIndex !== targetIndex) return
        const completedTarget = targetIndex
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
      resetLoaderState(activeTargetIndex)
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
        activeTargetIndex,
        page2LoaderShowCount: loaderShowCounts[1],
        page2LoaderHideCount: loaderHideCounts[1],
        loaderShowCounts: { ...loaderShowCounts },
        loaderHideCounts: { ...loaderHideCounts },
        loader: { ...loaderState },
      }
    },
  }
}
