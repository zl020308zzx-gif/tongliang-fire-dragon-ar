import {
  PAGE3_CRITICAL_IMAGE_KEYS,
  PAGE3_IMAGE_ENTRIES,
} from './page3-config.js'

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

const loadImageElement = async (image, path) => {
  if (!(image instanceof HTMLImageElement)) throw new Error(`[page3] 缺少图片元素：${path}`)
  if (image.dataset.loaded === 'true' && image.naturalWidth > 0) return image
  await new Promise((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener('load', onLoad)
      image.removeEventListener('error', onError)
    }
    const onLoad = () => {
      cleanup()
      image.dataset.loaded = 'true'
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error(`[page3] 图片加载失败：${path}`))
    }
    image.addEventListener('load', onLoad, { once: true })
    image.addEventListener('error', onError, { once: true })
    if (!image.src) image.src = path
    if (image.complete) {
      if (image.naturalWidth > 0) onLoad()
      else onError()
    }
  })
  if (typeof image.decode === 'function') {
    try {
      await image.decode()
    } catch (error) {
      if (image.naturalWidth <= 0) throw error
    }
  }
  return image
}

const loadMediaElement = (media, path, type) => {
  if (!(media instanceof HTMLMediaElement)) {
    return Promise.reject(new Error(`[page3] 缺少${type === 'video' ? '视频' : '音频'}元素：${path}`))
  }
  if (media.dataset.loaded === 'true' && media.readyState >= 2) return Promise.resolve(media)
  return new Promise((resolve, reject) => {
    const readyEvents = type === 'video'
      ? ['loadeddata', 'canplay', 'canplaythrough']
      : ['canplay', 'canplaythrough']
    const cleanup = () => {
      readyEvents.forEach((eventName) => media.removeEventListener(eventName, onReady))
      media.removeEventListener('error', onError)
    }
    const onReady = () => {
      if (media.readyState < 2) return
      cleanup()
      media.dataset.loaded = 'true'
      resolve(media)
    }
    const onError = () => {
      cleanup()
      const mediaError = media.error?.message || media.error?.code || '未知媒体错误'
      reject(new Error(`[page3] 媒体加载失败：${path}（${mediaError}）`))
    }
    readyEvents.forEach((eventName) => media.addEventListener(eventName, onReady))
    media.addEventListener('error', onError, { once: true })
    if (!media.src) {
      media.src = path
      media.preload = 'auto'
      media.load()
    }
    if (media.readyState >= 2) onReady()
  })
}

export function createPage3Preloader({ root, config, debug = false }) {
  const existing = sessions.get(root)
  if (existing?.rootImage === root.querySelector('#page3-background-asset')) return existing

  const promises = new Map()
  const status = new Map()
  const errors = new Map()
  const listeners = new Set()
  let criticalPromise = null
  let deferredPromise = null
  let realVideoPromise = null
  let destroyed = false

  const snapshot = () => {
    const criticalReady = PAGE3_CRITICAL_IMAGE_KEYS.every((key) => status.get(key) === 'ready')
    const deferredKeys = [...deferredImageKeys, ...mediaEntries.map(([, key]) => key)]
    const deferredSettled = deferredKeys.every((key) => ['ready', 'failed'].includes(status.get(key)))
    return {
      criticalReady,
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
          status.set(key, 'failed')
          errors.set(key, { path, message: error.message })
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

  const loadDeferred = () => {
    if (!deferredPromise) {
      deferredPromise = Promise.allSettled([
        ...deferredImageKeys.map(loadImage),
        ...mediaEntries.map(([, key]) => loadMedia(key)),
      ]).then(() => snapshot())
    }
    return deferredPromise
  }

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
      deferredPromise = null
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
