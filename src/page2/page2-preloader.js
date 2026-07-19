export const PAGE2_ASSET_ENTRIES = Object.freeze([
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

const sessions = new WeakMap()

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

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

const isMobile = () => matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

const progressMessage = (snapshot) => {
  if (snapshot.failedCount > 0 && snapshot.settledCount === snapshot.totalCount) {
    return '部分内容加载较慢，已显示可用图景'
  }
  if (snapshot.settledCount === snapshot.totalCount) return '龙脉图景准备完成'
  if (snapshot.backgroundReady && snapshot.titleReady) return '核心图景已准备，可开始扫描'
  if (snapshot.decodedCount > 2) return '正在加载文化图鉴'
  if (snapshot.loadedCount > snapshot.decodedCount) return '正在解析视觉素材'
  return '正在加载空间背景'
}

const updateLoadingUi = (root, snapshot, debug) => {
  const panel = root.querySelector('#page2-loading-status')
  if (!panel) return
  const detail = panel.querySelector('[data-page2-loading-detail]')
  const progress = panel.querySelector('[data-page2-loading-progress]')
  const count = panel.querySelector('[data-page2-loading-count]')
  detail.textContent = progressMessage(snapshot)
  progress.style.width = `${snapshot.progress.toFixed(1)}%`
  count.textContent = `已准备 ${snapshot.decodedCount} / ${snapshot.totalCount}`
  panel.dataset.status = snapshot.settledCount === snapshot.totalCount ? 'settled' : 'loading'
  panel.hidden = false
  if (debug) panel.title = `requested ${snapshot.requestedCount}｜loaded ${snapshot.loadedCount}｜decoded ${snapshot.decodedCount}｜failed ${snapshot.failedCount}`
  if (snapshot.settledCount === snapshot.totalCount) {
    window.clearTimeout(panel.__page2HideTimer)
    panel.__page2HideTimer = window.setTimeout(() => {
      panel.classList.add('is-complete')
      window.setTimeout(() => { panel.hidden = true }, 320)
    }, snapshot.failedCount ? 2200 : 900)
  }
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

export function startPage2Preload({ root, config, debug = false }) {
  const existing = sessions.get(root)
  const currentBackgroundImage = root.querySelector('#page2-background-asset')
  if (existing?.rootImage === currentBackgroundImage) return existing

  addImagePreload(config.assets.background)
  addImagePreload(config.assets.title)

  const imagePromises = new Map()
  const decodedImages = new Map()
  const status = new Map(PAGE2_ASSET_ENTRIES.map(([, key]) => [key, 'deferred']))
  const listeners = new Set()
  let requestedCount = 0
  let loadedCount = 0
  let decodedCount = 0
  let failedCount = 0
  let startedAt = performance.now()

  const snapshot = () => {
    const totalCount = PAGE2_ASSET_ENTRIES.length
    const settledCount = decodedCount + failedCount
    return {
      requestedCount,
      loadedCount,
      decodedCount,
      failedCount,
      settledCount,
      totalCount,
      progress: ((loadedCount + decodedCount + failedCount * 2) / (totalCount * 2)) * 100,
      backgroundReady: decodedImages.has('background'),
      titleReady: decodedImages.has('title'),
      resourcesLoaded: settledCount === totalCount,
      startedAt,
      elapsedMs: performance.now() - startedAt,
      status: new Map(status),
    }
  }

  const emit = () => {
    const current = snapshot()
    updateLoadingUi(root, current, debug)
    listeners.forEach((listener) => listener(current))
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
          emit()
        })
        decodedCount += 1
        decodedImages.set(key, ready)
        status.set(key, 'decoded')
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

  const runPool = async () => {
    const queue = PAGE2_ASSET_ENTRIES.map(([, key]) => key)
    const concurrency = isMobile() ? 3 : 4
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length > 0) {
        const key = queue.shift()
        await Promise.allSettled([preloadImage(key)])
        await nextFrame()
      }
    })
    await Promise.allSettled(workers)
    emit()
    return snapshot()
  }

  const session = {
    rootImage: currentBackgroundImage,
    imagePromises,
    decodedImages,
    preloadImage,
    getSnapshot: snapshot,
    subscribe(listener) {
      listeners.add(listener)
      listener(snapshot())
      return () => listeners.delete(listener)
    },
    promise: null,
    concurrency: isMobile() ? 3 : 4,
  }
  sessions.set(root, session)
  startedAt = performance.now()
  emit()
  session.promise = runPool()
  window.setTimeout(() => {
    if (!root.isConnected || decodedImages.has('background')) return
    const detail = root.querySelector('[data-page2-loading-detail]')
    if (detail) detail.textContent = '网络较慢，正在优先加载背景'
  }, 5000)
  window.setTimeout(() => {
    if (!root.isConnected || snapshot().settledCount === PAGE2_ASSET_ENTRIES.length) return
    const detail = root.querySelector('[data-page2-loading-detail]')
    if (detail) detail.textContent = '素材加载较慢，请保持网络连接'
  }, 10000)
  return session
}
