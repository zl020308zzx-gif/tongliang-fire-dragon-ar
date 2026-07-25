import {
  isTimeoutError,
  loadImageElement,
  withTimeout,
} from '../module-asset-loader.js'

export const PAGE2_ASSET_ENTRIES = Object.freeze([
  ['page2-floor-asset', 'floor'],
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
])

export const PAGE2_CRITICAL_IMAGE_KEYS = Object.freeze([
  'floor',
  'background',
  'title',
  'mainBase',
])

export const PAGE2_LATER_MAIN_KEYS = Object.freeze([
  'mainRing',
  'mainScene',
  'mainSparks',
  'mainPerformers',
  'mainDancers',
  'mainDragon',
  'mainPearl',
])

const sessions = new WeakMap()
const nextFrame = () => withTimeout(
  new Promise((resolve) => requestAnimationFrame(resolve)),
  1500,
  '[page2] 等待资源调度渲染帧超时',
)

const addImagePreload = (url) => {
  const absoluteUrl = new URL(url, document.baseURI).href
  const exists = [...document.querySelectorAll('link[rel="preload"][as="image"]')]
    .some((link) => link.href === absoluteUrl)
  if (exists) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = url
  link.type = 'image/png'
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}

const loadAndDecodeImage = async (img, url, onLoaded) => {
  const ready = await loadImageElement(img, url, {
    loadTimeoutMs: 15000,
    decodeTimeoutMs: 6000,
    allowDecodeFallback: true,
  })
  onLoaded()
  return ready
}

const timingDifference = (events, from, to) => (
  Number.isFinite(events[from]) && Number.isFinite(events[to])
    ? Math.round(events[to] - events[from])
    : null
)

export function startPage2CriticalPreload({ root, config, debug = false }) {
  const existing = sessions.get(root)
  const currentBackgroundImage = root.querySelector('#page2-background-asset')
  if (existing?.rootImage === currentBackgroundImage) return existing

  const pageOpenedAt = performance.now()
  addImagePreload(config.assets.floor)
  addImagePreload(config.assets.background)
  addImagePreload(config.assets.title)

  const imagePromises = new Map()
  const decodedImages = new Map()
  const status = new Map(PAGE2_ASSET_ENTRIES.map(([, key]) => [key, 'deferred']))
  const listeners = new Set()
  const loadedCriticalImages = new Set()
  const decodedCriticalImages = new Set()
  const criticalTextures = new Set()
  const timingEvents = Object.create(null)
  const timingDetails = Object.create(null)
  const timers = new Set()
  const failedKeys = new Set()
  const maxConcurrency = 2
  let requestedCount = 0
  let loadedCount = 0
  let decodedCount = 0
  let failedCount = 0
  const targetReady = true
  const targetFailed = false
  const targetTimedOut = false
  let maxTextureUploadMs = 0
  let uiDismissed = false
  let phaseMessage = ''
  let destroyed = false
  const entryState = {
    targetFound: false,
    pendingEnter: false,
    moduleEntered: false,
  }

  const markTiming = (name, detail = null, at = performance.now()) => {
    if (Number.isFinite(timingEvents[name])) return false
    timingEvents[name] = at
    if (detail != null) timingDetails[name] = detail
    if (debug) console.info(`[page2 timing] ${name}`, { at: Math.round(at), sincePageOpened: Math.round(at - pageOpenedAt), detail })
    return true
  }

  markTiming('pageOpened', null, pageOpenedAt)
  markTiming('criticalPreloadStarted')

  const criticalAssetDiagnostics = PAGE2_CRITICAL_IMAGE_KEYS
    .map((name) => ({ name, url: config.assets[name] }))
  console.info(`PAGE2 ASSET START:
${criticalAssetDiagnostics
    .map(({ name, url }) => `- asset name: ${name}\n  url: ${url}`)
    .join('\n')}`)

  const getTimingReport = () => {
    const events = Object.fromEntries(Object.entries(timingEvents).map(([key, value]) => [key, Math.round(value - pageOpenedAt)]))
    const deltas = {
      pageOpenedToCriticalReady: timingDifference(timingEvents, 'pageOpened', 'criticalTexturesReady'),
      cameraStartedToTargetFound: timingDifference(timingEvents, 'cameraStarted', 'targetFound'),
      targetFoundToTrackingStable: timingDifference(timingEvents, 'targetFound', 'trackingStable'),
      trackingStableToFloorVisible: timingDifference(timingEvents, 'trackingStable', 'floorVisible'),
      trackingStableToBackgroundVisible: timingDifference(timingEvents, 'trackingStable', 'backgroundVisible'),
      trackingStableToMainVisible: timingDifference(timingEvents, 'trackingStable', 'mainVisible'),
    }
    let diagnosis = '等待实测数据'
    if (Number.isFinite(timingEvents.cameraStarted) && !Number.isFinite(timingEvents.targetFound)) diagnosis = '尚未 targetFound：当前等待属于识别阶段'
    if (Number.isFinite(deltas.cameraStartedToTargetFound) && Number.isFinite(deltas.trackingStableToMainVisible)) {
      diagnosis = deltas.trackingStableToMainVisible > 1000
        ? 'targetFound 已完成，但主图显示偏慢：资源或 GPU 阶段'
        : '识别与首屏显示链路正常'
    }
    return { events, deltas, details: { ...timingDetails }, diagnosis }
  }

  const snapshot = () => {
    const totalCount = PAGE2_ASSET_ENTRIES.length
    const settledCount = PAGE2_ASSET_ENTRIES
      .filter(([, key]) => ['decoded', 'ready', 'failed', 'timedOut'].includes(status.get(key)))
      .length
    const currentFailedCount = PAGE2_ASSET_ENTRIES
      .filter(([, key]) => ['failed', 'timedOut'].includes(status.get(key)))
      .length
    const criticalImageTotal = PAGE2_CRITICAL_IMAGE_KEYS.length
    const criticalTotal = criticalImageTotal
    const criticalCompleted = criticalTextures.size
    const criticalProgress = Math.min(100, (criticalCompleted / criticalTotal) * 100)
    const criticalReady = decodedCriticalImages.size === criticalImageTotal
      && criticalTextures.size === criticalImageTotal
    const criticalFailed = PAGE2_CRITICAL_IMAGE_KEYS
      .some((key) => ['failed', 'timedOut'].includes(status.get(key)))
    const criticalPendingPaths = PAGE2_CRITICAL_IMAGE_KEYS
      .filter((key) => !['ready', 'failed', 'timedOut'].includes(status.get(key)))
      .map((key) => config.assets[key])
    const criticalFailedPaths = PAGE2_CRITICAL_IMAGE_KEYS
      .filter((key) => status.get(key) === 'failed')
      .map((key) => config.assets[key])
    const criticalTimedOutPaths = PAGE2_CRITICAL_IMAGE_KEYS
      .filter((key) => status.get(key) === 'timedOut')
      .map((key) => config.assets[key])
    return {
      requestedCount,
      loadedCount,
      decodedCount,
      failedCount: currentFailedCount,
      settledCount,
      totalCount,
      progress: criticalProgress,
      criticalProgress,
      criticalReady,
      criticalFailed,
      criticalTotal,
      criticalCompleted,
      criticalPendingPaths,
      criticalFailedPaths,
      criticalTimedOutPaths,
      criticalImageTotal,
      criticalImagesLoaded: loadedCriticalImages.size,
      criticalImagesDecoded: decodedCriticalImages.size,
      criticalTexturesReady: criticalTextures.size,
      targetReady,
      targetFailed,
      targetTimedOut,
      maxTextureUploadMs,
      backgroundReady: decodedImages.has('background'),
      titleReady: decodedImages.has('title'),
      resourcesLoaded: settledCount === totalCount,
      elapsedMs: performance.now() - pageOpenedAt,
      status: new Map(status),
      timing: getTimingReport(),
      concurrency: maxConcurrency,
    }
  }

  const updateLoadingUi = (current) => {
    const panel = root.querySelector('#page2-loading-status')
    if (!panel) return
    const loadingVisible = entryState.targetFound
      && entryState.pendingEnter
      && !entryState.moduleEntered
    if (uiDismissed || !loadingVisible) {
      panel.hidden = true
      return
    }
    panel.querySelector('.page2-loading-copy strong').textContent = '正在加载《龙脉探源》'
    panel.querySelector('.page2-loading-copy span').textContent = '核心资源就绪后将自动进入'
    const detail = panel.querySelector('[data-page2-loading-detail]')
    const progress = panel.querySelector('[data-page2-loading-progress]')
    const count = panel.querySelector('[data-page2-loading-count]')
    if (phaseMessage) detail.textContent = phaseMessage
    else if (
      current.targetReady &&
      current.criticalImagesDecoded === current.criticalImageTotal &&
      current.criticalTexturesReady < current.criticalImageTotal
    ) detail.textContent = '正在建立AR场景……'
    else if (current.criticalReady) detail.textContent = '核心图景已准备，请对准第二页识别图'
    else if (current.failedCount > 0 || current.targetFailed) detail.textContent = '部分核心资源准备失败，正在使用可用内容'
    else detail.textContent = '正在准备核心图景'
    progress.style.width = `${current.criticalProgress.toFixed(1)}%`
    count.textContent = debug
      ? `loaded ${current.loadedCount}｜decoded ${current.decodedCount}｜textures ${current.criticalTexturesReady}`
      : `${Math.round(current.criticalProgress)}%`
    panel.dataset.status = current.criticalReady ? 'ready' : 'loading'
    panel.querySelector('[data-page2-loading-retry]').hidden = !current.criticalFailed
    panel.classList.remove('is-complete')
    panel.hidden = false
    if (debug) panel.title = JSON.stringify(current.timing)
  }

  const emit = () => {
    const current = snapshot()
    updateLoadingUi(current)
    listeners.forEach((listener) => listener(current))
  }

  const evaluateCriticalMilestones = () => {
    if (loadedCriticalImages.size === PAGE2_CRITICAL_IMAGE_KEYS.length) markTiming('criticalImagesLoaded')
    if (decodedCriticalImages.size === PAGE2_CRITICAL_IMAGE_KEYS.length) markTiming('criticalImagesDecoded')
    const current = snapshot()
    if (current.criticalReady) {
      phaseMessage = ''
      markTiming('criticalTexturesReady', { maxTextureUploadMs })
    }
  }

  const preloadImage = (key) => {
    if (imagePromises.has(key)) return imagePromises.get(key)
    const entry = PAGE2_ASSET_ENTRIES.find(([, assetKey]) => assetKey === key)
    const img = entry ? root.querySelector(`#${entry[0]}`) : null
    const url = config.assets[key]
    const promise = (async () => {
      const loadStartedAt = performance.now()
      if (!(img instanceof HTMLImageElement)) throw new Error(`[page2] Missing image element: ${url}`)
      requestedCount += 1
      status.set(key, 'loading')
      emit()
      try {
        let loadRecorded = false
        const ready = await loadAndDecodeImage(img, url, () => {
          if (loadRecorded) return
          loadRecorded = true
          loadedCount += 1
          status.set(key, 'decoding')
          if (PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) loadedCriticalImages.add(key)
          evaluateCriticalMilestones()
          emit()
        })
        decodedCount += 1
        decodedImages.set(key, ready)
        status.set(key, 'decoded')
        if (PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) decodedCriticalImages.add(key)
        evaluateCriticalMilestones()
        emit()
        if (PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) {
          console.info(`PAGE2 ASSET SUCCESS:
name: ${key}
load time: ${Math.round(performance.now() - loadStartedAt)} ms
width: ${ready.naturalWidth}
height: ${ready.naturalHeight}`)
        }
        return ready
      } catch (error) {
        failedCount += 1
        failedKeys.add(key)
        status.set(key, isTimeoutError(error) ? 'timedOut' : 'failed')
        emit()
        if (PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) {
          console.error(`PAGE2 ASSET FAILED:
name: ${key}
url: ${url}
error: ${error?.message || String(error)}`, error)
        }
        console.error('[page2] Preload failed', { key, url, error })
        throw error
      }
    })()
    imagePromises.set(key, promise)
    return promise
  }

  const runQueue = async (queue) => {
    const settledAssets = []
    const workers = Array.from({ length: Math.min(maxConcurrency, queue.length) }, async () => {
      while (!destroyed && queue.length > 0) {
        const key = queue.shift()
        const [result] = await Promise.allSettled([preloadImage(key)])
        settledAssets.push({ key, result })
        await nextFrame()
      }
    })
    await Promise.allSettled(workers)
    const fulfilledAssets = settledAssets.filter(({ result }) => result.status === 'fulfilled')
    const rejectedAssets = settledAssets.filter(({ result }) => result.status === 'rejected')
    const rejectedDetails = rejectedAssets.map(({ key, result }) => ({
        name: key,
        url: config.assets[key],
        error: result.reason?.message || String(result.reason),
      }))
    console.info(`PAGE2 ALLSETTLED RESULT:
fulfilled数量: ${fulfilledAssets.length}
rejected数量: ${rejectedAssets.length}
失败资源数组: ${JSON.stringify(rejectedDetails)}`)
  }

  const criticalQueue = [
    'background',
    'floor',
    'title',
    'mainBase',
  ]
  const session = {
    rootImage: currentBackgroundImage,
    imagePromises,
    decodedImages,
    preloadImage,
    getSnapshot: snapshot,
    getTimingReport,
    markTiming(name, detail, at) {
      const added = markTiming(name, detail, at)
      if (added) emit()
      return added
    },
    markCriticalTextureReady(key, uploadMs = 0) {
      if (!PAGE2_CRITICAL_IMAGE_KEYS.includes(key) || criticalTextures.has(key)) return false
      criticalTextures.add(key)
      status.set(key, 'ready')
      maxTextureUploadMs = Math.max(maxTextureUploadMs, Number.isFinite(uploadMs) ? uploadMs : 0)
      evaluateCriticalMilestones()
      emit()
      return true
    },
    markCriticalTextureFailure(key, error) {
      if (!PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) return false
      const failureStatus = isTimeoutError(error) ? 'timedOut' : 'failed'
      criticalTextures.delete(key)
      status.set(key, failureStatus)
      failedKeys.add(key)
      failedCount += 1
      emit()
      console.error(`PAGE2 ASSET FAILED:
name: ${key}
url: ${config.assets[key]}
error: ${error?.message || String(error)}`, error)
      return true
    },
    setPhaseMessage(message = '') {
      phaseMessage = message
      uiDismissed = false
      emit()
    },
    setEntryState(nextState = {}) {
      Object.assign(entryState, nextState)
      if (entryState.pendingEnter) uiDismissed = false
      emit()
    },
    resetImageForRetry(key) {
      if (PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) return false
      imagePromises.delete(key)
      decodedImages.delete(key)
      failedKeys.delete(key)
      status.set(key, 'deferred')
      emit()
      return true
    },
    hideLoading() {
      const panel = root.querySelector('#page2-loading-status')
      uiDismissed = true
      if (!panel) return
      panel.classList.add('is-complete')
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        if (uiDismissed) panel.hidden = true
      }, 320)
      timers.add(timer)
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(snapshot())
      return () => listeners.delete(listener)
    },
    criticalPromise: null,
    promise: null,
    concurrency: maxConcurrency,
    retryFailed() {
      const retryQueue = [...failedKeys]
      if (!retryQueue.length) return Promise.resolve(snapshot())
      retryQueue.forEach((key) => {
        failedKeys.delete(key)
        imagePromises.delete(key)
        decodedImages.delete(key)
        loadedCriticalImages.delete(key)
        decodedCriticalImages.delete(key)
        criticalTextures.delete(key)
        status.set(key, 'deferred')
      })
      failedCount = Math.max(0, failedCount - retryQueue.length)
      phaseMessage = '正在重试失败资源'
      uiDismissed = false
      emit()
      session.criticalPromise = runQueue(retryQueue)
      session.promise = session.criticalPromise
      return session.criticalPromise.then(() => snapshot())
    },
    destroy() {
      destroyed = true
      listeners.clear()
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    },
  }

  sessions.set(root, session)
  const retryButton = root.querySelector('[data-page2-loading-retry]')
  if (retryButton) retryButton.onclick = () => session.retryFailed()
  emit()
  session.criticalPromise = runQueue([...criticalQueue])
  // Non-critical modules are intentionally left deferred here. The overview
  // scheduler requests them roughly one second before their own stage, keeping
  // the camera/recognition phase free from avoidable image decoding work.
  session.promise = session.criticalPromise
  return session
}

export const startPage2Preload = startPage2CriticalPreload
