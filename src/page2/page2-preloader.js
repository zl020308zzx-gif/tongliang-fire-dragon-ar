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
  'mainRing',
  'mainScene',
  'mainSparks',
  'mainPerformers',
  'mainDancers',
  'mainDragon',
  'mainPearl',
])

const TARGETS_TASK = '__targets__'
const sessions = new WeakMap()
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
const isMobile = () => matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

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
  const absoluteUrl = new URL(url, document.baseURI).href
  if (img.currentSrc !== absoluteUrl && img.src !== absoluteUrl) img.src = url
  if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        img.removeEventListener('load', onLoad)
        img.removeEventListener('error', onError)
      }
      const onLoad = () => { cleanup(); resolve() }
      const onError = () => { cleanup(); reject(new Error(`[page2] Image load failed: ${url}`)) }
      img.addEventListener('load', onLoad, { once: true })
      img.addEventListener('error', onError, { once: true })
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) onLoad()
    })
  }
  if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    throw new Error(`[page2] Image incomplete: ${url}`)
  }
  onLoaded()
  if (typeof img.decode === 'function') {
    try {
      await img.decode()
    } catch (error) {
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) throw error
    }
  }
  return img
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
  const maxConcurrency = isMobile() ? 3 : 4
  let requestedCount = 0
  let loadedCount = 0
  let decodedCount = 0
  let failedCount = 0
  let targetReady = false
  let targetFailed = false
  let maxTextureUploadMs = 0
  let uiDismissed = false
  let phaseMessage = ''
  let destroyed = false

  const markTiming = (name, detail = null, at = performance.now()) => {
    if (Number.isFinite(timingEvents[name])) return false
    timingEvents[name] = at
    if (detail != null) timingDetails[name] = detail
    if (debug) console.info(`[page2 timing] ${name}`, { at: Math.round(at), sincePageOpened: Math.round(at - pageOpenedAt), detail })
    return true
  }

  markTiming('pageOpened', null, pageOpenedAt)
  markTiming('criticalPreloadStarted')

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
    const settledCount = decodedCount + failedCount
    const criticalImageTotal = PAGE2_CRITICAL_IMAGE_KEYS.length
    const criticalTotalUnits = criticalImageTotal * 3 + 2
    const criticalDoneUnits = loadedCriticalImages.size + decodedCriticalImages.size + criticalTextures.size + (targetReady ? 2 : 0)
    const criticalProgress = Math.min(100, (criticalDoneUnits / criticalTotalUnits) * 100)
    const criticalReady = targetReady
      && decodedCriticalImages.size === criticalImageTotal
      && criticalTextures.size === criticalImageTotal
    return {
      requestedCount,
      loadedCount,
      decodedCount,
      failedCount,
      settledCount,
      totalCount,
      progress: criticalProgress,
      criticalProgress,
      criticalReady,
      criticalImageTotal,
      criticalImagesLoaded: loadedCriticalImages.size,
      criticalImagesDecoded: decodedCriticalImages.size,
      criticalTexturesReady: criticalTextures.size,
      targetReady,
      targetFailed,
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
    if (uiDismissed) return
    const panel = root.querySelector('#page2-loading-status')
    if (!panel) return
    panel.querySelector('.page2-loading-copy strong').textContent = '《龙脉铜梁》'
    panel.querySelector('.page2-loading-copy span').textContent = '——铜梁火龙非遗AR互动体验设计'
    const detail = panel.querySelector('[data-page2-loading-detail]')
    const progress = panel.querySelector('[data-page2-loading-progress]')
    const count = panel.querySelector('[data-page2-loading-count]')
    if (phaseMessage) detail.textContent = phaseMessage
    else if (current.criticalReady) detail.textContent = '核心图景已准备，请对准第二页识别图'
    else if (current.failedCount > 0 || current.targetFailed) detail.textContent = '部分核心资源准备失败，正在使用可用内容'
    else detail.textContent = '正在准备核心图景'
    progress.style.width = `${current.criticalProgress.toFixed(1)}%`
    count.textContent = debug
      ? `loaded ${current.loadedCount}｜decoded ${current.decodedCount}｜textures ${current.criticalTexturesReady}`
      : `${Math.round(current.criticalProgress)}%`
    panel.dataset.status = current.criticalReady ? 'ready' : 'loading'
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
        return ready
      } catch (error) {
        failedCount += 1
        status.set(key, 'failed')
        emit()
        console.error('[page2] Preload failed', { key, url, error })
        throw error
      }
    })()
    imagePromises.set(key, promise)
    return promise
  }

  const preloadTargets = async () => {
    try {
      const response = await fetch(config.targets, { cache: 'force-cache' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength <= 0) throw new Error('targets.mind is empty')
      targetReady = true
      evaluateCriticalMilestones()
      emit()
      return { byteLength: buffer.byteLength }
    } catch (error) {
      targetFailed = true
      emit()
      console.error('[page2] targets.mind preload failed', { url: config.targets, error })
      throw error
    }
  }

  const runQueue = async (queue) => {
    const workers = Array.from({ length: Math.min(maxConcurrency, queue.length) }, async () => {
      while (!destroyed && queue.length > 0) {
        const key = queue.shift()
        await Promise.allSettled([key === TARGETS_TASK ? preloadTargets() : preloadImage(key)])
        await nextFrame()
      }
    })
    await Promise.allSettled(workers)
  }

  const criticalQueue = [
    'background',
    'title',
    TARGETS_TASK,
    ...PAGE2_CRITICAL_IMAGE_KEYS.filter((key) => !['background', 'title'].includes(key)),
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
      maxTextureUploadMs = Math.max(maxTextureUploadMs, Number.isFinite(uploadMs) ? uploadMs : 0)
      evaluateCriticalMilestones()
      emit()
      return true
    },
    setPhaseMessage(message = '') {
      phaseMessage = message
      uiDismissed = false
      emit()
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
    destroy() {
      destroyed = true
      listeners.clear()
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.clear()
    },
  }

  sessions.set(root, session)
  emit()
  session.criticalPromise = runQueue([...criticalQueue])
  // Non-critical modules are intentionally left deferred here. The overview
  // scheduler requests them roughly one second before their own stage, keeping
  // the camera/recognition phase free from avoidable image decoding work.
  session.promise = session.criticalPromise
  return session
}

export const startPage2Preload = startPage2CriticalPreload
