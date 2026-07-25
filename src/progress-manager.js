export function createProgressManager(storageKey) {
  const progress = {
    bamboo: 0,
    paper: 0,
    paint: 0,
  }
  let completed = false

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
      completed = false
    },
    markCompleted() {
      completed = true
    },
    isCompleted: () => completed,
  }
}
