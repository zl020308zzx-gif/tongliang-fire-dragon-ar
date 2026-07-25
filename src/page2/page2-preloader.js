import {
  appendRetryQuery,
  assetStageProgress,
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
    onLoaded,
  })
  return ready
}

const timingDifference = (events, from, to) => (
  Number.isFinite(events[from]) && Number.isFinite(events[to])
    ? Math.round(events[to] - events[from])
    : null
)

export function createPage2Preloader({ root, config, debug = false }) {
  const existing = sessions.get(root)
  const currentBackgroundImage = root.querySelector('#page2-background-asset')
  if (existing?.rootImage === currentBackgroundImage) return existing

  const pageOpenedAt = performance.now()
  const imagePromises = new Map()
  const decodedImages = new Map()
  const status = new Map(PAGE2_ASSET_ENTRIES.map(([, key]) => [key, 'deferred']))
  const stageProgress = new Map(PAGE2_ASSET_ENTRIES.map(([, key]) => [key, 0]))
  const retryCounts = new Map()
  const failedStages = new Map()
  const listeners = new Set()
  const loadedCriticalImages = new Set()
  const decodedCriticalImages = new Set()
  const gpuReady = new Set()
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
  let currentLoadingPath = ''
  let currentStage = 'idle'
  let generation = 0
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
    const criticalCompleted = PAGE2_CRITICAL_IMAGE_KEYS.filter((key) => gpuReady.has(key)).length
    const criticalProgress = Math.min(100, PAGE2_CRITICAL_IMAGE_KEYS
      .reduce((total, key) => total + (stageProgress.get(key) || 0), 0) / criticalTotal * 100)
    const criticalReady = decodedCriticalImages.size === criticalImageTotal
      && criticalCompleted === criticalImageTotal
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
      criticalTexturesReady: criticalCompleted,
      gpuReadyCount: gpuReady.size,
      currentLoadingPath,
      currentStage,
      failedStage: PAGE2_CRITICAL_IMAGE_KEYS
        .map((key) => failedStages.get(key))
        .find(Boolean) || '',
      currentModule: entryState.targetFound ? 'page2' : null,
      mobileAssets: Boolean(config.mobileAssets),
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

  const emit = () => {
    const current = snapshot()
    listeners.forEach((listener) => listener(current))
  }

  const evaluateCriticalMilestones = () => {
    if (loadedCriticalImages.size === PAGE2_CRITICAL_IMAGE_KEYS.length) markTiming('criticalImagesLoaded')
    if (decodedCriticalImages.size === PAGE2_CRITICAL_IMAGE_KEYS.length) markTiming('criticalImagesDecoded')
    const current = snapshot()
    if (current.criticalReady) {
      phaseMessage = ''
      markTiming('criticalTexturesReady', { maxTextureUploadMs })
      markTiming('criticalGpuReady', { gpuReadyCount: current.gpuReadyCount })
    }
  }

  const preloadImage = (key) => {
    if (imagePromises.has(key)) return imagePromises.get(key)
    const requestGeneration = generation
    const entry = PAGE2_ASSET_ENTRIES.find(([, assetKey]) => assetKey === key)
    const img = entry ? root.querySelector(`#${entry[0]}`) : null
    const url = config.assets[key]
    const requestUrl = appendRetryQuery(url, retryCounts.get(key) || 0)
    const promise = (async () => {
      const loadStartedAt = performance.now()
      if (!(img instanceof HTMLImageElement)) throw new Error(`[page2] Missing image element: ${url}`)
      requestedCount += 1
      currentLoadingPath = requestUrl
      currentStage = 'loading'
      status.set(key, 'loading')
      stageProgress.set(key, Math.max(stageProgress.get(key) || 0, assetStageProgress('loading')))
      emit()
      try {
        let loadRecorded = false
        const ready = await loadAndDecodeImage(img, requestUrl, () => {
          if (loadRecorded) return
          loadRecorded = true
          if (requestGeneration === generation) {
            loadedCount += 1
            status.set(key, 'loaded')
            currentStage = 'loaded'
            stageProgress.set(key, Math.max(stageProgress.get(key) || 0, assetStageProgress('loaded')))
            if (PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) loadedCriticalImages.add(key)
            evaluateCriticalMilestones()
            emit()
          }
        })
        if (requestGeneration !== generation) return ready
        decodedCount += 1
        decodedImages.set(key, ready)
        status.set(key, 'decoded')
        currentStage = 'decoded'
        stageProgress.set(key, Math.max(stageProgress.get(key) || 0, assetStageProgress('decoded')))
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
        if (requestGeneration !== generation) return null
        if (requestGeneration === generation) {
          failedCount += 1
          failedKeys.add(key)
          failedStages.set(key, currentStage || 'loading')
          status.set(key, isTimeoutError(error) ? 'timedOut' : 'failed')
          emit()
        }
        if (PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) {
          console.error(`PAGE2 ASSET FAILED:
name: ${key}
url: ${url}
error: ${error?.message || String(error)}`, error)
        }
        console.error('[page2] Preload failed', { key, url, error })
        throw error
      } finally {
        if (requestGeneration === generation && currentLoadingPath === requestUrl) currentLoadingPath = ''
        if (requestGeneration === generation) currentStage = ''
        if (requestGeneration === generation) emit()
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
      if (!PAGE2_CRITICAL_IMAGE_KEYS.includes(key) || gpuReady.has(key)) return false
      gpuReady.add(key)
      status.set(key, 'ready')
      stageProgress.set(key, 1)
      currentStage = 'gpuReady'
      failedStages.delete(key)
      maxTextureUploadMs = Math.max(maxTextureUploadMs, Number.isFinite(uploadMs) ? uploadMs : 0)
      evaluateCriticalMilestones()
      emit()
      return true
    },
    markTextureUploading(key) {
      if (!PAGE2_CRITICAL_IMAGE_KEYS.includes(key) || gpuReady.has(key)) return false
      currentLoadingPath = config.assets[key]
      currentStage = 'gpu'
      emit()
      return true
    },
    markTextureReady(key, uploadMs = 0) {
      if (gpuReady.has(key)) return false
      gpuReady.add(key)
      status.set(key, 'ready')
      stageProgress.set(key, 1)
      failedStages.delete(key)
      maxTextureUploadMs = Math.max(maxTextureUploadMs, Number.isFinite(uploadMs) ? uploadMs : 0)
      evaluateCriticalMilestones()
      emit()
      return true
    },
    markCriticalTextureFailure(key, error) {
      if (!PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) return false
      const failureStatus = isTimeoutError(error) ? 'timedOut' : 'failed'
      gpuReady.delete(key)
      status.set(key, failureStatus)
      failedKeys.add(key)
      failedStages.set(key, 'gpu')
      failedCount += 1
      emit()
      console.error(`PAGE2 ASSET FAILED:
name: ${key}
url: ${config.assets[key]}
error: ${error?.message || String(error)}`, error)
      return true
    },
    startCritical() {
      if (session.criticalPromise) return session.criticalPromise
      markTiming('criticalPreloadStarted')
      addImagePreload(config.assets.floor)
      addImagePreload(config.assets.background)
      addImagePreload(config.assets.title)
      const diagnostics = PAGE2_CRITICAL_IMAGE_KEYS
        .map((name) => ({ name, url: config.assets[name] }))
      console.info(`PAGE2 ASSET START:
${diagnostics.map(({ name, url }) => `- asset name: ${name}\n  url: ${url}`).join('\n')}`)
      session.criticalPromise = runQueue([...criticalQueue])
      session.promise = session.criticalPromise
      emit()
      return session.criticalPromise
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
    startDeferred() {
      if (session.deferredPromise) return session.deferredPromise
      const deferredQueue = PAGE2_ASSET_ENTRIES
        .map(([, key]) => key)
        .filter((key) => !PAGE2_CRITICAL_IMAGE_KEYS.includes(key))
      session.deferredPromise = runQueue(deferredQueue).then(() => snapshot())
      return session.deferredPromise
    },
    resetImageForRetry(key) {
      if (PAGE2_CRITICAL_IMAGE_KEYS.includes(key)) return false
      imagePromises.delete(key)
      decodedImages.delete(key)
      failedKeys.delete(key)
      gpuReady.delete(key)
      status.set(key, 'deferred')
      emit()
      return true
    },
    hideLoading() {
      uiDismissed = true
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(snapshot())
      return () => listeners.delete(listener)
    },
    criticalPromise: null,
    promise: null,
    deferredPromise: null,
    concurrency: maxConcurrency,
    retryFailed() {
      const retryQueue = [...failedKeys]
      if (!retryQueue.length) return Promise.resolve(snapshot())
      retryQueue.forEach((key) => {
        retryCounts.set(key, (retryCounts.get(key) || 0) + 1)
        failedKeys.delete(key)
        failedStages.delete(key)
        imagePromises.delete(key)
        decodedImages.delete(key)
        loadedCriticalImages.delete(key)
        decodedCriticalImages.delete(key)
        gpuReady.delete(key)
        status.set(key, 'deferred')
        const entry = PAGE2_ASSET_ENTRIES.find(([, entryKey]) => entryKey === key)
        const image = entry ? root.querySelector(`#${entry[0]}`) : null
        if (image instanceof HTMLImageElement) {
          image.removeAttribute('src')
          image.removeAttribute('srcset')
          delete image.dataset.loaded
          delete image.dataset.sourceUrl
        }
      })
      failedCount = Math.max(0, failedCount - retryQueue.length)
      phaseMessage = '正在重试失败资源'
      uiDismissed = false
      emit()
      session.criticalPromise = runQueue(retryQueue)
      session.promise = session.criticalPromise
      return session.criticalPromise.then(() => snapshot())
    },
    releaseAssets(keys = PAGE2_ASSET_ENTRIES.map(([, key]) => key)) {
      generation += 1
      currentLoadingPath = ''
      keys.forEach((key) => {
        imagePromises.delete(key)
        decodedImages.delete(key)
        failedKeys.delete(key)
        loadedCriticalImages.delete(key)
        decodedCriticalImages.delete(key)
        gpuReady.delete(key)
        status.set(key, 'deferred')
        stageProgress.set(key, 0)
        failedStages.delete(key)
        const entry = PAGE2_ASSET_ENTRIES.find(([, entryKey]) => entryKey === key)
        const image = entry ? root.querySelector(`#${entry[0]}`) : null
        if (image instanceof HTMLImageElement) {
          image.removeAttribute('src')
          image.dataset.loaded = 'false'
        }
      })
      if (keys.some((key) => PAGE2_CRITICAL_IMAGE_KEYS.includes(key))) {
        session.criticalPromise = null
        session.promise = null
      }
      session.deferredPromise = null
      emit()
    },
    destroy() {
      destroyed = true
      listeners.clear()
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    },
  }

  sessions.set(root, session)
  return session
}

export const startPage2CriticalPreload = createPage2Preloader
export const startPage2Preload = createPage2Preloader
