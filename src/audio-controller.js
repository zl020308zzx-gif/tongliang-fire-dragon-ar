export function createAudioController({ paths, errorOutput }) {
  const audioByName = new Map(
    Object.entries(paths).map(([name, path]) => {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.addEventListener('error', () => {
        errorOutput.textContent = `音频加载失败：${path}`
        errorOutput.hidden = false
      })
      return [name, { audio, path }]
    }),
  )
  const playedOnce = new Set()

  const stopAll = () => {
    audioByName.forEach(({ audio }) => {
      audio.pause()
      audio.currentTime = 0
    })
  }

  const play = (name, { once = false } = {}) => {
    const entry = audioByName.get(name)
    if (!entry || (once && playedOnce.has(name))) return
    if (once) playedOnce.add(name)

    stopAll()
    entry.audio.currentTime = 0
    try {
      entry.audio.play()?.catch(() => {
        errorOutput.textContent = `音频播放失败：${entry.path}`
        errorOutput.hidden = false
      })
    } catch {
      errorOutput.textContent = `音频播放失败：${entry.path}`
      errorOutput.hidden = false
    }
  }

  return {
    play,
    stopAll,
    reset() {
      stopAll()
      playedOnce.clear()
    },
  }
}
