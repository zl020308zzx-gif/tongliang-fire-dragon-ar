import {
  PAGE3_CRITICAL_IMAGE_KEYS,
  PAGE3_DEFERRED_IMAGE_KEYS,
  PAGE3_IMAGE_ENTRIES,
} from './page3-config.js'
import {
  appendRetryQuery,
  assetStageProgress,
  isTimeoutError,
  loadImageElement as loadSharedImageElement,
  loadMediaElement as loadSharedMediaElement,
} from '../module-asset-loader.js'

const sessions = new WeakMap()
const imageIdByKey = new Map(PAGE3_IMAGE_ENTRIES.map(([id, key]) => [key, id]))

const mediaEntries = Object.freeze([
  ['page3-dragon-video', 'dragonVideo', 'video'],
  ['page3-ironflower-video', 'ironflowerVideo', 'video'],
  ['page3-dragon-bgm', 'dragonBgm', 'audio'],
  ['page3-climax-bgm', 'climaxBgm', 'audio'],
  ['page3-drum-sfx', 'drumSfx', 'audio'],
  ['page3-ironflower-sfx', 'ironflowerSfx', 'audio'],
])

const loadImageElement = (image, path, onLoaded = null) =>
  loadSharedImageElement(image, path, {
    loadTimeoutMs: 15000,
    decodeTimeoutMs: 6000,
    allowDecodeFallback: true,
    onLoaded,
  }).catch((error) => {
    throw new Error(`[page3] ${error.message}`)
  })

const loadMediaElement = (media, path, type) =>
  loadSharedMediaElement(media, path, type).catch((error) => {
    throw new Error(`[page3] ${error.message}`)
  })

export function createPage3Preloader({ root, config, debug = false }) {
  const existing = sessions.get(root)
  if (existing?.rootImage === root.querySelector('#page3-background-asset')) return existing

  const promises = new Map()
  const status = new Map()
  const errors = new Map()
  const stageProgress = new Map(PAGE3_IMAGE_ENTRIES.map(([, key]) => [key, 0]))
  const retryCounts = new Map()
  const failedStages = new Map()
  const listeners = new Set()
  const gpuReady = new Set()
  const gpuWaiters = new Map()
  const loadedImages = new Set()
  const decodedImages = new Set()
  const timingEvents = Object.create(null)
  const timingDetails = Object.create(null)
  const pageOpenedAt = performance.now()
  let criticalPromise = null
  let stagePromise = null
  let drumAudioPromise = null
  let dragonPromise = null
  let climaxPromise = null
  let realVideoPromise = null
  let currentLoadingPath = ''
  let currentStage = 'idle'
  let requestCount = 0
  let generation = 0
  let destroyed = false

  const markTiming = (name, detail = null, at = performance.now()) => {
    if (Number.isFinite(timingEvents[name])) return false
    timingEvents[name] = at
    if (detail != null) timingDetails[name] = detail
    if (debug) {
      console.info(`[page3 timing] ${name}`, {
        at: Math.round(at),
        sincePageOpened: Math.round(at - pageOpenedAt),
        detail,
      })
    }
    return true
  }

  markTiming('pageOpened', null, pageOpenedAt)

  const getTimingReport = () => ({
    events: Object.fromEntries(
      Object.entries(timingEvents).map(([key, value]) => [key, Math.round(value - pageOpenedAt)]),
    ),
    details: { ...timingDetails },
  })

  const snapshot = () => {
    const criticalImagesReady = PAGE3_CRITICAL_IMAGE_KEYS.filter((key) => decodedImages.has(key))
    const criticalGpuReady = PAGE3_CRITICAL_IMAGE_KEYS.filter((key) => gpuReady.has(key))
    const criticalReady = PAGE3_CRITICAL_IMAGE_KEYS.every(
      (key) => decodedImages.has(key) && gpuReady.has(key),
    )
    const deferredKeys = [
      ...PAGE3_DEFERRED_IMAGE_KEYS,
      ...mediaEntries.map(([, key]) => key),
    ]
    const deferredSettled = deferredKeys.every(
      (key) => ['ready', 'gpuReady', 'failed', 'timedOut'].includes(status.get(key)),
    )
    const pathsFor = (statuses) => PAGE3_CRITICAL_IMAGE_KEYS
      .filter((key) => statuses.includes(status.get(key)))
      .map((key) => config.assets[key])
    const criticalProgress = PAGE3_CRITICAL_IMAGE_KEYS.reduce(
      (total, key) => total + (stageProgress.get(key) || 0),
      0,
    ) / PAGE3_CRITICAL_IMAGE_KEYS.length * 100

    return {
      criticalReady,
      criticalProgress,
      criticalTotal: PAGE3_CRITICAL_IMAGE_KEYS.length,
      criticalCompleted: criticalGpuReady.length,
      criticalImagesLoaded: PAGE3_CRITICAL_IMAGE_KEYS.filter((key) => loadedImages.has(key)).length,
      criticalImagesDecoded: PAGE3_CRITICAL_IMAGE_KEYS.filter((key) => decodedImages.has(key)).length,
      criticalGpuReady: criticalGpuReady.length,
      criticalPendingPaths: pathsFor(['loading', 'loaded', 'decoded', 'idle']).concat(
        PAGE3_CRITICAL_IMAGE_KEYS
          .filter((key) => !status.has(key))
          .map((key) => config.assets[key]),
      ),
      criticalFailedPaths: pathsFor(['failed']),
      criticalTimedOutPaths: pathsFor(['timedOut']),
      criticalFailed: PAGE3_CRITICAL_IMAGE_KEYS.some(
        (key) => ['failed', 'timedOut'].includes(status.get(key)),
      ),
      deferredSettled,
      failedCount: errors.size,
      requestCount,
      gpuReadyCount: gpuReady.size,
      currentLoadingPath,
      currentStage,
      failedStage: PAGE3_CRITICAL_IMAGE_KEYS
        .map((key) => failedStages.get(key))
        .find(Boolean) || '',
      currentModule: currentLoadingPath ? 'page3' : null,
      mobileAssets: Boolean(config.mobileAssets),
      status: new Map(status),
      errors: new Map(errors),
      gpuReady: new Set(gpuReady),
      timing: getTimingReport(),
    }
  }

  const emit = () => {
    const current = snapshot()
    listeners.forEach((listener) => listener(current))
    if (current.criticalImagesLoaded === PAGE3_CRITICAL_IMAGE_KEYS.length) {
      markTiming('criticalImagesLoaded')
    }
    if (current.criticalImagesDecoded === PAGE3_CRITICAL_IMAGE_KEYS.length) {
      markTiming('criticalImagesDecoded')
    }
    if (current.criticalGpuReady === PAGE3_CRITICAL_IMAGE_KEYS.length) {
      markTiming('criticalGpuReady', { gpuReadyCount: current.gpuReadyCount })
    }
  }

  const settleGpuWaiters = (key, error = null) => {
    const waiters = gpuWaiters.get(key)
    if (!waiters) return
    gpuWaiters.delete(key)
    waiters.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(true)))
  }

  const waitForGpuReady = (key) => {
    if (gpuReady.has(key)) return Promise.resolve(true)
    if (errors.has(key)) return Promise.reject(new Error(errors.get(key).message))
    return new Promise((resolve, reject) => {
      const waiters = gpuWaiters.get(key) || new Set()
      waiters.add({ resolve, reject })
      gpuWaiters.set(key, waiters)
    })
  }

  const record = (key, promise, path, { image = false, requestGeneration = generation } = {}) => {
    const tracked = promise.then(
      (value) => {
        if (!destroyed && requestGeneration === generation) {
          status.set(key, image ? 'decoded' : 'ready')
          if (image) {
            decodedImages.add(key)
            stageProgress.set(key, Math.max(stageProgress.get(key) || 0, assetStageProgress('decoded')))
          }
          emit()
        }
        return value
      },
      (error) => {
        console.error(error.message || `[page3] 资源加载失败：${path}`, error)
        if (!destroyed && requestGeneration === generation) {
          const failureStatus = isTimeoutError(error) ? 'timedOut' : 'failed'
          status.set(key, failureStatus)
          failedStages.set(key, currentStage || 'loading')
          errors.set(key, { path, message: error.message, status: failureStatus })
          settleGpuWaiters(key, error)
          emit()
        }
        throw error
      },
    ).finally(() => {
      if (requestGeneration === generation && currentLoadingPath === path) currentLoadingPath = ''
      if (!destroyed && requestGeneration === generation) emit()
    })
    promises.set(key, tracked)
    return tracked
  }

  const loadImage = (key) => {
    if (promises.has(key)) return promises.get(key)
    const path = config.assets[key]
    const requestPath = appendRetryQuery(path, retryCounts.get(key) || 0)
    const image = root.querySelector(`#${imageIdByKey.get(key)}`)
    status.set(key, 'loading')
    stageProgress.set(key, Math.max(stageProgress.get(key) || 0, assetStageProgress('loading')))
    currentLoadingPath = requestPath
    currentStage = 'loading'
    requestCount += 1
    emit()
    const requestGeneration = generation
    return record(key, loadImageElement(image, requestPath, () => {
      if (requestGeneration !== generation) return
      loadedImages.add(key)
      status.set(key, 'loaded')
      currentStage = 'loaded'
      stageProgress.set(key, Math.max(stageProgress.get(key) || 0, assetStageProgress('loaded')))
      emit()
    }), requestPath, {
      image: true,
      requestGeneration,
    })
  }

  const loadMedia = (key) => {
    if (promises.has(key)) return promises.get(key)
    const entry = mediaEntries.find(([, entryKey]) => entryKey === key)
    const path = config.assets[key]
    const media = entry ? root.querySelector(`#${entry[0]}`) : null
    status.set(key, 'loading')
    currentLoadingPath = path
    requestCount += 1
    emit()
    return record(key, loadMediaElement(media, path, entry?.[2] || 'media'), path, {
      requestGeneration: generation,
    })
  }

  const startCritical = () => {
    if (!criticalPromise) {
      markTiming('criticalPreloadStarted')
      if (debug) {
        console.info('[page3] critical assets', PAGE3_CRITICAL_IMAGE_KEYS.map((key) => ({
          name: key,
          url: config.assets[key],
        })))
      }
      criticalPromise = Promise.allSettled(PAGE3_CRITICAL_IMAGE_KEYS.map(loadImage)).then((results) => {
        const failures = results.filter((result) => result.status === 'rejected')
        if (failures.length) throw new Error(`[page3] ${failures.length} 个首屏资源加载失败`)
        return snapshot()
      })
    }
    return criticalPromise
  }

  const loadStageAssets = () => {
    if (!stagePromise) {
      stagePromise = (async () => {
        const stageGeneration = generation
        for (const key of PAGE3_DEFERRED_IMAGE_KEYS) {
          if (stageGeneration !== generation) break
          try {
            await loadImage(key)
            if (stageGeneration !== generation) break
            await waitForGpuReady(key)
          } catch (error) {
            console.error(`[page3] 后续舞台资源加载失败：${key}`, {
              path: config.assets[key],
              error,
            })
          }
        }
        return snapshot()
      })()
    }
    return stagePromise
  }

  const loadDrumAudio = () => {
    if (!drumAudioPromise) drumAudioPromise = loadMedia('drumSfx')
    return drumAudioPromise
  }

  const loadDragonAssets = () => {
    if (!dragonPromise) {
      dragonPromise = Promise.allSettled([
        loadMedia('dragonVideo'),
        loadMedia('dragonBgm'),
      ]).then(() => snapshot())
    }
    return dragonPromise
  }

  const loadClimaxAssets = () => {
    if (!climaxPromise) {
      climaxPromise = Promise.allSettled([
        loadMedia('ironflowerVideo'),
        loadMedia('climaxBgm'),
        loadMedia('ironflowerSfx'),
      ]).then(() => snapshot())
    }
    return climaxPromise
  }

  const loadDeferred = () => loadStageAssets()

  const loadRealVideo = () => {
    if (realVideoPromise) return realVideoPromise
    const video = root.querySelector('#page3-real-video')
    const path = config.assets.realVideo
    if (!(video instanceof HTMLVideoElement)) {
      realVideoPromise = Promise.reject(new Error(`[page3] 缺少实拍视频元素：${path}`))
      return realVideoPromise
    }
    status.set('realVideo', 'loading')
    video.poster = config.assets.realPoster
    emit()
    requestCount += 1
    realVideoPromise = record('realVideo', loadMediaElement(video, path, 'video'), path)
    return realVideoPromise
  }

  const releaseAssets = (keys = PAGE3_IMAGE_ENTRIES.map(([, key]) => key)) => {
    generation += 1
    currentLoadingPath = ''
    const releasedKeys = new Set(keys)
    releasedKeys.forEach((key) => {
      promises.delete(key)
      status.delete(key)
      errors.delete(key)
      stageProgress.set(key, 0)
      failedStages.delete(key)
      gpuReady.delete(key)
      loadedImages.delete(key)
      decodedImages.delete(key)
      settleGpuWaiters(key, new Error(`[page3] 资源已释放：${key}`))
      const id = imageIdByKey.get(key)
      const image = id ? root.querySelector(`#${id}`) : null
      if (image instanceof HTMLImageElement) {
        image.removeAttribute('src')
        image.removeAttribute('srcset')
        delete image.dataset.loaded
        delete image.dataset.sourceUrl
      }
    })
    if (PAGE3_CRITICAL_IMAGE_KEYS.some((key) => releasedKeys.has(key))) criticalPromise = null
    if (PAGE3_DEFERRED_IMAGE_KEYS.some((key) => releasedKeys.has(key))) stagePromise = null
    emit()
  }

  const session = {
    rootImage: root.querySelector('#page3-background-asset'),
    startCritical,
    loadCritical: startCritical,
    loadStageAssets,
    loadDrumAudio,
    loadDragonAssets,
    loadClimaxAssets,
    loadDeferred,
    startDeferred: loadDeferred,
    loadRealVideo,
    waitForGpuReady,
    markGpuUploading(key) {
      if (!imageIdByKey.has(key) || gpuReady.has(key)) return false
      currentLoadingPath = config.assets[key]
      currentStage = 'gpu'
      emit()
      return true
    },
    markGpuReady(key, detail = null) {
      if (!imageIdByKey.has(key)) return false
      gpuReady.add(key)
      status.set(key, 'gpuReady')
      stageProgress.set(key, 1)
      failedStages.delete(key)
      errors.delete(key)
      settleGpuWaiters(key)
      if (detail != null && debug) console.info(`[page3] GPU ready: ${key}`, detail)
      emit()
      return true
    },
    markGpuFailure(key, error) {
      const failure = error instanceof Error ? error : new Error(String(error))
      gpuReady.delete(key)
      status.set(key, 'failed')
      failedStages.set(key, 'gpu')
      errors.set(key, {
        path: config.assets[key],
        message: failure.message,
        status: 'failed',
      })
      settleGpuWaiters(key, failure)
      emit()
    },
    markTiming(name, detail = null, at = performance.now()) {
      const added = markTiming(name, detail, at)
      if (added) emit()
      return added
    },
    getTimingReport,
    releaseAssets,
    retryFailed() {
      const failedKeys = [...errors.keys()]
      failedKeys.forEach((key) => {
        retryCounts.set(key, (retryCounts.get(key) || 0) + 1)
        promises.delete(key)
        errors.delete(key)
        status.delete(key)
        gpuReady.delete(key)
        failedStages.delete(key)
        const id = imageIdByKey.get(key)
        const image = id ? root.querySelector(`#${id}`) : null
        if (image instanceof HTMLImageElement) {
          image.removeAttribute('src')
          image.removeAttribute('srcset')
          delete image.dataset.loaded
          delete image.dataset.sourceUrl
        }
      })
      if (failedKeys.includes('realVideo')) realVideoPromise = null
      criticalPromise = null
      stagePromise = null
      drumAudioPromise = null
      dragonPromise = null
      climaxPromise = null
      return Promise.allSettled(failedKeys.map((key) => {
        if (key === 'realVideo') return loadRealVideo()
        return imageIdByKey.has(key) ? loadImage(key) : loadMedia(key)
      }))
    },
    getSnapshot: snapshot,
    subscribe(listener) {
      listeners.add(listener)
      listener(snapshot())
      return () => listeners.delete(listener)
    },
    destroy() {
      destroyed = true
      gpuWaiters.forEach((waiters) => {
        waiters.forEach(({ reject }) => reject(new Error('[page3] preloader destroyed')))
      })
      gpuWaiters.clear()
      listeners.clear()
    },
  }

  sessions.set(root, session)
  return session
}
