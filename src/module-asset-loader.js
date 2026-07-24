const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

export async function loadImageElement(image, path) {
  if (!(image instanceof HTMLImageElement)) throw new Error(`缺少图片元素：${path}`)
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        image.removeEventListener('load', onLoad)
        image.removeEventListener('error', onError)
      }
      const onLoad = () => { cleanup(); resolve() }
      const onError = () => { cleanup(); reject(new Error(`图片加载失败：${path}`)) }
      image.addEventListener('load', onLoad, { once: true })
      image.addEventListener('error', onError, { once: true })
      if (!image.src) image.src = path
      if (image.complete) {
        if (image.naturalWidth > 0 && image.naturalHeight > 0) onLoad()
        else onError()
      }
    })
  }
  if (typeof image.decode === 'function') {
    try {
      await image.decode()
    } catch (error) {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) throw error
    }
  }
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) throw new Error(`图片尺寸无效：${path}`)
  image.dataset.loaded = 'true'
  return image
}

export function loadMediaElement(media, path, type = 'video', readyState = 2) {
  if (!(media instanceof HTMLMediaElement)) return Promise.reject(new Error(`缺少媒体元素：${path}`))
  if (media.readyState >= readyState) return Promise.resolve(media)
  return new Promise((resolve, reject) => {
    const events = type === 'audio' ? ['canplay', 'canplaythrough'] : ['loadeddata', 'canplay']
    const cleanup = () => {
      events.forEach((name) => media.removeEventListener(name, onReady))
      media.removeEventListener('error', onError)
    }
    const onReady = () => {
      if (media.readyState < readyState) return
      cleanup()
      media.dataset.loaded = 'true'
      resolve(media)
    }
    const onError = () => {
      cleanup()
      reject(new Error(`媒体加载失败：${path}（${media.error?.code || 'unknown'}）`))
    }
    events.forEach((name) => media.addEventListener(name, onReady))
    media.addEventListener('error', onError, { once: true })
    if (!media.src) media.src = path
    media.preload = 'auto'
    media.load()
    if (media.readyState >= readyState) onReady()
  })
}

export async function waitForMountedFrames(validate, frameCount = 2) {
  for (let index = 0; index < frameCount; index += 1) {
    await nextFrame()
    if (!validate()) throw new Error(`实体渲染校验失败（第 ${index + 1} 帧）`)
  }
  return true
}

export function createModuleAssetLoader({ modules = {}, onChange = null }) {
  const state = new Map()
  Object.entries(modules).forEach(([moduleId, phases]) => {
    const tasks = new Map()
    Object.entries(phases).forEach(([phase, entries]) => {
      ;(entries || []).forEach((entry) => tasks.set(entry.key, { ...entry, phase, status: 'idle', promise: null, error: null }))
    })
    state.set(moduleId, { tasks })
  })

  const snapshot = (moduleId) => {
    const module = state.get(moduleId)
    const tasks = [...(module?.tasks.values() || [])]
    const critical = tasks.filter((task) => task.phase === 'criticalAssets')
    const ready = critical.filter((task) => task.status === 'ready').length
    const failed = critical.filter((task) => task.status === 'failed').length
    return {
      criticalProgress: critical.length ? (ready / critical.length) * 100 : 100,
      criticalReady: critical.length > 0 && ready === critical.length,
      criticalFailed: failed > 0,
      status: new Map(tasks.map((task) => [task.key, task.status])),
      errors: new Map(tasks.filter((task) => task.error).map((task) => [task.key, task.error])),
    }
  }

  const emit = (moduleId) => onChange?.(moduleId, snapshot(moduleId))

  const runTask = (moduleId, task) => {
    if (task.status === 'ready') return Promise.resolve(true)
    if (task.promise) return task.promise
    task.status = 'loading'
    task.error = null
    emit(moduleId)
    task.promise = Promise.resolve().then(task.load).then(
      async () => {
        if (task.validate) await waitForMountedFrames(task.validate, task.frames ?? 2)
        task.status = 'ready'
        task.promise = null
        emit(moduleId)
        return true
      },
      (error) => {
        task.status = 'failed'
        task.error = { path: task.path, message: error?.message || String(error) }
        task.promise = null
        console.error(`[${moduleId}] 资源加载失败`, task.error)
        emit(moduleId)
        throw error
      },
    )
    return task.promise
  }

  const runPhase = (moduleId, phase, stepId = null) => {
    const module = state.get(moduleId)
    const tasks = [...(module?.tasks.values() || [])].filter((task) =>
      task.phase === phase && (stepId == null || task.stepId == null || task.stepId === stepId))
    return Promise.allSettled(tasks.map((task) => runTask(moduleId, task))).then(() => snapshot(moduleId))
  }

  return {
    loadCriticalAssets: (moduleId) => runPhase(moduleId, 'criticalAssets'),
    preloadNextStep: (moduleId, stepId = null) => runPhase(moduleId, 'nextStepAssets', stepId),
    preloadIdleAssets: (moduleId) => runPhase(moduleId, 'laterAssets'),
    retryFailedAssets(moduleId) {
      const module = state.get(moduleId)
      const failed = [...(module?.tasks.values() || [])].filter((task) => task.status === 'failed')
      return Promise.allSettled(failed.map((task) => runTask(moduleId, task))).then(() => snapshot(moduleId))
    },
    getProgress: snapshot,
    isCriticalReady: (moduleId) => snapshot(moduleId).criticalReady,
    waitForMountedFrames: (moduleId, frameCount = 2) => waitForMountedFrames(
      () => [...(state.get(moduleId)?.tasks.values() || [])]
        .filter((task) => task.phase === 'criticalAssets' && task.status === 'ready')
        .every((task) => !task.validate || task.validate()),
      frameCount,
    ),
  }
}
