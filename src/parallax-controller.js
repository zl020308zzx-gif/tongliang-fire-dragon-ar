export function createParallaxController({
  scene,
  group,
  config,
  signal,
  isEnabled,
  onUpdate,
  onFirstMove,
}) {
  const THREE = window.AFRAME.THREE
  let frameId = null
  let targetX = 0
  let targetY = 0
  let currentX = 0
  let currentY = 0
  let normalized = { x: 0, y: 0 }
  let touchPointerId = null
  let touchStart = null
  let didMove = false

  const markMoved = () => {
    if (didMove) return
    didMove = true
    onFirstMove()
  }

  const setTarget = (x, y) => {
    normalized = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    }
    targetY = normalized.x * config.maxHorizontalDeg
    targetX = -normalized.y * config.maxVerticalDeg
    if (Math.abs(normalized.x) + Math.abs(normalized.y) > 0.08) markMoved()
  }

  const tick = () => {
    if (isEnabled()) {
      currentX += (targetX - currentX) * config.smoothing
      currentY += (targetY - currentY) * config.smoothing
    } else {
      currentX += (0 - currentX) * config.smoothing
      currentY += (0 - currentY) * config.smoothing
      normalized = { x: 0, y: 0 }
    }
    group.object3D.rotation.x = THREE.MathUtils.degToRad(currentX)
    group.object3D.rotation.y = THREE.MathUtils.degToRad(currentY)
    onUpdate({ rotation: { x: currentX, y: currentY }, normalized })
    frameId = requestAnimationFrame(tick)
  }

  const canvas = scene.canvas
  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (!isEnabled()) return
      const rect = canvas.getBoundingClientRect()
      if (event.pointerType === 'mouse') {
        setTarget(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1)
      } else if (event.pointerId === touchPointerId && touchStart) {
        setTarget(
          ((event.clientX - touchStart.x) / rect.width) * 2 * config.touchSensitivity,
          ((event.clientY - touchStart.y) / rect.height) * 2 * config.touchSensitivity,
        )
      }
    },
    { signal },
  )
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (!isEnabled() || event.pointerType === 'mouse') return
      touchPointerId = event.pointerId
      touchStart = { x: event.clientX, y: event.clientY }
    },
    { signal },
  )
  const stopTouch = (event) => {
    if (event.pointerId !== touchPointerId) return
    touchPointerId = null
    touchStart = null
    setTarget(0, 0)
  }
  canvas.addEventListener('pointerup', stopTouch, { signal })
  canvas.addEventListener('pointercancel', stopTouch, { signal })
  window.addEventListener('blur', () => setTarget(0, 0), { signal })
  window.addEventListener(
    'deviceorientation',
    (event) => {
      if (!isEnabled() || event.gamma == null || event.beta == null) return
      setTarget(
        (event.gamma / 30) * config.orientationSensitivity,
        ((event.beta - 45) / 30) * config.orientationSensitivity,
      )
    },
    { signal },
  )

  frameId = requestAnimationFrame(tick)

  return {
    reset() {
      targetX = 0
      targetY = 0
      currentX = 0
      currentY = 0
      normalized = { x: 0, y: 0 }
      didMove = false
      group.object3D.rotation.set(0, 0, 0)
    },
    destroy() {
      if (frameId !== null) cancelAnimationFrame(frameId)
    },
  }
}
