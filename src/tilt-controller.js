const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3)

export function createTiltController({
  scene,
  target,
  panelHinge,
  config,
  signal,
  isTracked,
  onUpdate,
  onTimeout,
  onRiseStart,
  onComplete,
}) {
  const THREE = window.AFRAME.THREE
  const normal = new THREE.Vector3()
  const targetPosition = new THREE.Vector3()
  const cameraPosition = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  let active = false
  let paused = false
  let pausedAt = null
  let initialAngle = null
  let stableStartedAt = null
  let startedAt = null
  let timedOut = false
  let rising = false
  let riseElapsed = 0
  let previousTime = performance.now()
  let frameId = null

  const setRotation = (rotation) => {
    panelHinge.object3D.rotation.set(
      THREE.MathUtils.degToRad(rotation[0]),
      THREE.MathUtils.degToRad(rotation[1]),
      THREE.MathUtils.degToRad(rotation[2]),
    )
  }

  const getObservationAngle = () => {
    if (!scene.camera) return null
    target.object3D.getWorldQuaternion(quaternion)
    normal.set(0, 0, 1).applyQuaternion(quaternion).normalize()
    target.object3D.getWorldPosition(targetPosition)
    scene.camera.getWorldPosition(cameraPosition)
    direction.copy(cameraPosition).sub(targetPosition).normalize()
    return THREE.MathUtils.radToDeg(normal.angleTo(direction))
  }

  const beginRise = () => {
    if (rising) return
    active = false
    rising = true
    riseElapsed = 0
    onRiseStart()
  }

  const pauseController = () => {
    if (paused) return
    paused = true
    pausedAt = performance.now()
    stableStartedAt = null
  }

  const resumeController = () => {
    if (!paused) return
    const now = performance.now()
    if (pausedAt !== null && startedAt !== null) startedAt += now - pausedAt
    pausedAt = null
    paused = false
    previousTime = now
  }

  const tick = (time) => {
    const delta = time - previousTime
    previousTime = time
    if (!paused && rising) {
      riseElapsed += delta
      const linear = Math.min(1, riseElapsed / config.animationDurationMs)
      const eased = easeOutCubic(linear)
      const rotation = config.panelStartRotation.map(
        (value, index) => value + (config.panelEndRotation[index] - value) * eased,
      )
      setRotation(rotation)
      onUpdate({ initialAngle, currentAngle: null, deltaAngle: null, stableMs: 0, rotation, satisfied: true })
      if (linear >= 1) {
        rising = false
        onComplete()
      }
    } else if (!paused && active && isTracked()) {
      const currentAngle = getObservationAngle()
      if (currentAngle !== null) {
        if (initialAngle === null) initialAngle = currentAngle
        const deltaAngle = Math.abs(currentAngle - initialAngle)
        const inAbsoluteRange =
          currentAngle >= config.minAbsoluteAngle && currentAngle <= config.maxAbsoluteAngle
        const satisfied = inAbsoluteRange && deltaAngle >= config.minDeltaAngle
        if (satisfied) stableStartedAt ??= time
        else stableStartedAt = null
        const stableMs = stableStartedAt === null ? 0 : time - stableStartedAt
        onUpdate({
          initialAngle,
          currentAngle,
          deltaAngle,
          stableMs,
          rotation: config.panelStartRotation,
          satisfied,
        })
        if (stableMs >= config.stableDurationMs) beginRise()
      }
      if (!timedOut && startedAt !== null && time - startedAt >= config.timeoutMs) {
        timedOut = true
        onTimeout()
      }
    }
    frameId = requestAnimationFrame(tick)
  }

  setRotation(config.panelStartRotation)
  frameId = requestAnimationFrame(tick)
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        pauseController()
      } else if (isTracked()) {
        resumeController()
      }
    },
    { signal },
  )

  return {
    start() {
      active = true
      paused = false
      initialAngle = null
      stableStartedAt = null
      startedAt = performance.now()
      timedOut = false
      setRotation(config.panelStartRotation)
    },
    completeManually: beginRise,
    pause: pauseController,
    resume: resumeController,
    destroy() {
      if (frameId !== null) cancelAnimationFrame(frameId)
    },
  }
}
