export function createVideoController({
  video,
  videoPlane,
  craftPlane,
  path,
  signal,
  errorOutput,
  onEnded,
  onFailed,
  onStatusChange,
}) {
  let status = 'idle'
  let playAttempt = 0
  let pausedByTracking = false

  const setStatus = (nextStatus) => {
    status = nextStatus
    onStatusChange(status)
  }

  const showCraft = () => {
    craftPlane.setAttribute('visible', true)
    videoPlane.setAttribute('visible', false)
    craftPlane.object3D.visible = true
    videoPlane.object3D.visible = false
  }

  const showVideo = () => {
    craftPlane.setAttribute('visible', false)
    videoPlane.setAttribute('visible', true)
    craftPlane.object3D.visible = false
    videoPlane.object3D.visible = true
  }

  const fail = () => {
    if (status === 'failed') return
    video.pause()
    showCraft()
    setStatus('failed')
    errorOutput.textContent = `视频播放失败：${path}`
    errorOutput.hidden = false
    onFailed()
  }

  const play = () => {
    const attempt = ++playAttempt
    video.pause()
    video.currentTime = 0
    pausedByTracking = false
    errorOutput.hidden = true
    showCraft()
    setStatus('playing')

    try {
      const promise = video.play()
      promise?.catch(() => {
        if (attempt === playAttempt) fail()
      })
    } catch {
      fail()
    }
  }

  video.addEventListener(
    'playing',
    () => {
      if (status === 'playing') showVideo()
    },
    { signal },
  )
  video.addEventListener(
    'ended',
    () => {
      if (status !== 'playing') return
      showCraft()
      setStatus('ended')
      onEnded()
    },
    { signal },
  )
  video.addEventListener(
    'error',
    () => {
      errorOutput.textContent = `视频加载失败：${path}`
      errorOutput.hidden = false
      if (status === 'playing' || status === 'paused') fail()
    },
    { signal },
  )
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden && status === 'playing') {
        video.pause()
        setStatus('paused')
      } else if (!document.hidden && status === 'paused') {
        setStatus('playing')
        try {
          video.play()?.catch(fail)
        } catch {
          fail()
        }
      }
    },
    { signal },
  )

  return {
    play,
    retry: play,
    skip() {
      pausedByTracking = false
      video.pause()
      showCraft()
      setStatus('skipped')
      onEnded()
    },
    stop() {
      playAttempt += 1
      pausedByTracking = false
      video.pause()
      video.currentTime = 0
      showCraft()
      setStatus('idle')
    },
    pauseForTracking() {
      if (status !== 'playing' || video.ended) return false
      video.pause()
      pausedByTracking = true
      setStatus('tracking-paused')
      return true
    },
    resumeAfterTracking() {
      if (!pausedByTracking || video.ended) return false
      pausedByTracking = false
      setStatus('playing')
      showVideo()
      try {
        video.play()?.catch(fail)
      } catch {
        fail()
      }
      return true
    },
    getCurrentTime: () => video.currentTime,
    wasPausedByTracking: () => pausedByTracking,
    getStatus: () => status,
  }
}
