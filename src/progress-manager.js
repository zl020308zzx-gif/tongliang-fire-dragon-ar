export function createProgressManager(storageKey) {
  const progress = {
    bamboo: 0,
    paper: 0,
    paint: 0,
  }

  const set = (key, value) => {
    progress[key] = Math.min(1, Math.max(progress[key], value))
    return progress[key]
  }

  const setExact = (key, value) => {
    progress[key] = Math.min(1, Math.max(0, value))
    return progress[key]
  }

  const reset = () => {
    progress.bamboo = 0
    progress.paper = 0
    progress.paint = 0
  }

  return {
    get: (key) => progress[key],
    getAll: () => ({ ...progress }),
    set,
    setExact,
    reset,
    clearCompletion() {
      try {
        localStorage.removeItem(storageKey)
      } catch {
        // 隐私模式禁用存储时仍允许完整体验。
      }
    },
    markCompleted() {
      try {
        localStorage.setItem(storageKey, 'true')
      } catch {
        // 存储失败不能阻塞完成状态。
      }
    },
    isCompleted() {
      try {
        return localStorage.getItem(storageKey) === 'true'
      } catch {
        return false
      }
    },
  }
}
