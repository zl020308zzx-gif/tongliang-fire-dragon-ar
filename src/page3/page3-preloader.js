import {
  PAGE3_CRITICAL_IMAGE_KEYS,
  PAGE3_IMAGE_ENTRIES,
} from './page3-config.js'
import {
  isTimeoutError,
  loadImageElement as loadSharedImageElement,
  loadMediaElement as loadSharedMediaElement,
} from '../module-asset-loader.js'

const sessions = new WeakMap()
const imageIdByKey = new Map(PAGE3_IMAGE_ENTRIES.map(([id, key]) => [key, id]))
const deferredImageKeys = PAGE3_IMAGE_ENTRIES
  .map(([, key]) => key)
  .filter((key) => !PAGE3_CRITICAL_IMAGE_KEYS.includes(key))

const mediaEntries = Object.freeze([
  ['page3-dragon-video', 'dragonVideo', 'video'],
  ['page3-ironflower-video', 'ironflowerVideo', 'video'],
  ['page3-dragon-bgm', 'dragonBgm', 'audio'],
  ['page3-climax-bgm', 'climaxBgm', 'audio'],
  ['page3-drum-sfx', 'drumSfx', 'audio'],
  ['page3-ironflower-sfx', 'ironflowerSfx', 'audio'],
])

const loadImageElement = (image, path) =>
  loadSharedImageElement(image, path, {
    loadTimeoutMs: 15000,
    decodeTimeoutMs: 6000,
    allowDecodeFallback: true,
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
  const listeners = new Set()
  let criticalPromise = null
  let stagePromise = null
  let dragonPromise = null
  let climaxPromise = null
  let realVideoPromise = null
  let destroyed = false

  const snapshot = () => {
    const criticalReady = PAGE3_CRITICAL_IMAGE_KEYS.every((key) => status.get(key) === 'ready')
    const deferredKeys = [...deferredImageKeys, ...mediaEntries.map(([, key]) => key)]
    const deferredSettled = deferredKeys.every((key) => ['ready', 'failed', 'timedOut'].includes(status.get(key)))
    const criticalCompleted = PAGE3_CRITICAL_IMAGE_KEYS.filter((key) => status.get(key) === 'ready').length
    const pathsFor = (statuses) => PAGE3_CRITICAL_IMAGE_KEYS
      .filter((key) => statuses.includes(status.get(key)))
      .map((key) => config.assets[key])
    return {
      criticalReady,
      criticalProgress: PAGE3_CRITICAL_IMAGE_KEYS.length
        ? (criticalCompleted / PAGE3_CRITICAL_IMAGE_KEYS.length) * 100
        : 100,
      criticalTotal: PAGE3_CRITICAL_IMAGE_KEYS.length,
      criticalCompleted,
      criticalPendingPaths: pathsFor(['loading', 'idle']).concat(
        PAGE3_CRITICAL_IMAGE_KEYS
          .filter((key) => !status.has(key))
          .map((key) => config.assets[key]),
      ),
      criticalFailedPaths: pathsFor(['failed']),
      criticalTimedOutPaths: pathsFor(['timedOut']),
      criticalFailed: PAGE3_CRITICAL_IMAGE_KEYS.some((key) =>
        ['failed', 'timedOut'].includes(status.get(key))),
      deferredSettled,
      failedCount: errors.size,
      status: new Map(status),
      errors: new Map(errors),
    }
  }

  const emit = () => {
    const current = snapshot()
    listeners.forEach((listener) => listener(current))
  }

  const record = (key, promise, path) => {
    const tracked = promise.then(
      (value) => {
        if (!destroyed) {
          status.set(key, 'ready')
          emit()
        }
        return value
      },
      (error) => {
        console.error(error.message || `[page3] 资源加载失败：${path}`, error)
        if (!destroyed) {
          const failureStatus = isTimeoutError(error) ? 'timedOut' : 'failed'
          status.set(key, failureStatus)
          errors.set(key, { path, message: error.message, status: failureStatus })
          emit()
        }
        throw error
      },
    )
    promises.set(key, tracked)
    return tracked
  }

  const loadImage = (key) => {
    if (promises.has(key)) return promises.get(key)
    const path = config.assets[key]
    const image = root.querySelector(`#${imageIdByKey.get(key)}`)
    status.set(key, 'loading')
    emit()
    return record(key, loadImageElement(image, path), path)
  }

  const loadMedia = (key) => {
    if (promises.has(key)) return promises.get(key)
    const entry = mediaEntries.find(([, entryKey]) => entryKey === key)
    const path = config.assets[key]
    const media = entry ? root.querySelector(`#${entry[0]}`) : null
    status.set(key, 'loading')
    emit()
    return record(key, loadMediaElement(media, path, entry?.[2] || 'media'), path)
  }

  const loadCritical = () => {
    if (!criticalPromise) {
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
      stagePromise = Promise.allSettled([
        ...['stageFront', 'stageLights', 'pearl'].map(loadImage),
        loadMedia('drumSfx'),
      ]).then(() => snapshot())
    }
    return stagePromise
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

  const loadDeferred = () =>
    Promise.allSettled([loadStageAssets(), loadDragonAssets(), loadClimaxAssets()]).then(() => snapshot())

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
    realVideoPromise = record('realVideo', loadMediaElement(video, path, 'video'), path)
    return realVideoPromise
  }

  const session = {
    rootImage: root.querySelector('#page3-background-asset'),
    loadCritical,
    loadStageAssets,
    loadDragonAssets,
    loadClimaxAssets,
    loadDeferred,
    loadRealVideo,
    retryFailed() {
      const failedKeys = [...errors.keys()]
      failedKeys.forEach((key) => {
        promises.delete(key)
        errors.delete(key)
        status.delete(key)
      })
      if (failedKeys.includes('realVideo')) realVideoPromise = null
      criticalPromise = null
      stagePromise = null
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
      listeners.clear()
    },
  }

  sessions.set(root, session)
  if (debug) window.page3Preloader = session
  return session
}
