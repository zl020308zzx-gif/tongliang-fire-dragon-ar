export function createCraftInteraction({
  scene,
  plane,
  canvasDimensions,
  holdDurationMs,
  states,
  eyeHotspot,
  signal,
  getState,
  isLocked,
  getBambooProgress,
  onBambooStart,
  onBambooProgress,
  onBambooComplete,
  onPaperProgress,
  onPaintStroke,
  onPointerInfo,
  onActivityChange,
  onEyeClick,
}) {
  const THREE = window.AFRAME.THREE
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let activePointerId = null
  let activeMode = null
  let pointerIsDown = false
  let holdFrameId = null
  let previousHoldTime = null
  let previousPaintPoint = null
  let lastValidPaintPoint = null
  let suspendedOutsideCanvas = false

  const getPoint = (clientX, clientY) => {
    const displayCanvas = scene.canvas
    const mesh = plane.getObject3D('mesh')
    if (!displayCanvas || !mesh || !scene.camera) return { inside: false }
    const bounds = displayCanvas.getBoundingClientRect()
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(pointer, scene.camera)
    const intersection = raycaster.intersectObject(mesh, true)[0]
    if (!intersection?.uv) return { inside: false }
    const uv = { x: intersection.uv.x, y: intersection.uv.y }
    return {
      inside: true,
      uv,
      canvasPoint: {
        x: uv.x * canvasDimensions.width,
        y: (1 - uv.y) * canvasDimensions.height,
      },
      clientPoint: { x: clientX, y: clientY },
    }
  }

  const emitActivity = (mode = activeMode) => {
    onActivityChange({
      isActive: pointerIsDown,
      mode,
      gestureActive: pointerIsDown,
      pointerCaptured:
        activePointerId !== null && Boolean(scene.canvas?.hasPointerCapture?.(activePointerId)),
      insideCanvas: !suspendedOutsideCanvas,
      suspendedOutsideCanvas,
      lastValidPaintPoint,
    })
  }

  const setActivity = (isActive, mode = activeMode) => {
    pointerIsDown = isActive
    emitActivity(mode)
  }

  const stopInteraction = ({ releaseCapture = true } = {}) => {
    if (holdFrameId !== null) cancelAnimationFrame(holdFrameId)
    holdFrameId = null
    previousHoldTime = null
    previousPaintPoint = null
    suspendedOutsideCanvas = false
    const pointerId = activePointerId
    activePointerId = null
    const stoppedMode = activeMode
    activeMode = null
    if (pointerIsDown) setActivity(false, stoppedMode)
    if (
      releaseCapture &&
      pointerId !== null &&
      scene.canvas?.hasPointerCapture?.(pointerId)
    ) {
      scene.canvas.releasePointerCapture(pointerId)
    }
  }

  const holdTick = (time) => {
    holdFrameId = null
    if (!pointerIsDown || activeMode !== 'bamboo' || isLocked()) return
    if (suspendedOutsideCanvas) {
      previousHoldTime = null
      holdFrameId = requestAnimationFrame(holdTick)
      return
    }
    let progress = getBambooProgress()
    if (previousHoldTime !== null) {
      progress = Math.min(1, progress + (time - previousHoldTime) / holdDurationMs)
      onBambooProgress(progress)
    }
    previousHoldTime = time
    if (progress >= 1) {
      stopInteraction()
      onBambooComplete()
      return
    }
    holdFrameId = requestAnimationFrame(holdTick)
  }

  const isEyeHit = (uv) =>
    Math.hypot(uv.x - eyeHotspot.x, uv.y - eyeHotspot.y) <= eyeHotspot.radius

  const start = (event) => {
    if (activePointerId !== null || isLocked()) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const point = getPoint(event.clientX, event.clientY)
    onPointerInfo({ ...point, eventType: 'down' })
    if (!point.inside) return
    const state = getState()

    if (state === states.EYE_READY) {
      const hit = isEyeHit(point.uv)
      onEyeClick({ ...point, hit })
      return
    }

    if (
      ![
        states.LINEART,
        states.BAMBOO_BUILD,
        states.PAPER_COMPARE,
        states.PAPER_READY,
        states.COLOR_PAINT,
      ].includes(state)
    ) {
      return
    }

    event.preventDefault()
    activePointerId = event.pointerId
    scene.canvas.setPointerCapture?.(event.pointerId)

    if (state === states.LINEART || state === states.BAMBOO_BUILD) {
      activeMode = 'bamboo'
      setActivity(true, activeMode)
      onBambooStart()
      previousHoldTime = performance.now()
      if (holdFrameId === null) holdFrameId = requestAnimationFrame(holdTick)
      return
    }

    if (state === states.PAPER_COMPARE || state === states.PAPER_READY) {
      activeMode = 'paper'
      setActivity(true, activeMode)
      if (onPaperProgress(point.uv.x)) stopInteraction()
      return
    }

    activeMode = 'paint'
    setActivity(true, activeMode)
    previousPaintPoint = point.canvasPoint
    lastValidPaintPoint = point.canvasPoint
    onPaintStroke(previousPaintPoint, previousPaintPoint)
  }

  const move = (event) => {
    const point = getPoint(event.clientX, event.clientY)
    onPointerInfo({ ...point, eventType: 'move' })
    if (event.pointerId !== activePointerId || !pointerIsDown) return
    if (!point.inside) {
      suspendedOutsideCanvas = true
      previousPaintPoint = null
      previousHoldTime = null
      emitActivity()
      return
    }

    if (suspendedOutsideCanvas) {
      suspendedOutsideCanvas = false
      previousHoldTime = performance.now()
      previousPaintPoint = null
      emitActivity()
    }

    if (activeMode === 'paper') {
      if (onPaperProgress(point.uv.x)) stopInteraction()
    } else if (activeMode === 'paint') {
      const from = previousPaintPoint ?? point.canvasPoint
      onPaintStroke(from, point.canvasPoint)
      previousPaintPoint = point.canvasPoint
      lastValidPaintPoint = point.canvasPoint
      emitActivity()
    }
  }

  const end = (event) => {
    if (event.pointerId === activePointerId) stopInteraction()
  }

  const canvas = scene.canvas
  canvas.addEventListener('pointerdown', start, { signal })
  canvas.addEventListener('pointermove', move, { signal })
  canvas.addEventListener('pointerup', end, { signal })
  canvas.addEventListener('pointercancel', end, { signal })
  canvas.addEventListener(
    'lostpointercapture',
    (event) => {
      if (event.pointerId === activePointerId) stopInteraction({ releaseCapture: false })
    },
    { signal },
  )
  canvas.addEventListener(
    'contextmenu',
    (event) => {
      if (getPoint(event.clientX, event.clientY).inside) event.preventDefault()
    },
    { signal },
  )
  window.addEventListener('blur', stopInteraction, { signal })
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) stopInteraction()
    },
    { signal },
  )

  const projectUv = (uv) => {
    const mesh = plane.getObject3D('mesh')
    if (!mesh || !scene.camera || !scene.canvas) return null
    mesh.geometry.computeBoundingBox()
    mesh.updateMatrixWorld(true)
    const box = mesh.geometry.boundingBox
    const local = new THREE.Vector3(
      box.min.x + (box.max.x - box.min.x) * uv.x,
      box.min.y + (box.max.y - box.min.y) * uv.y,
      0,
    )
      .applyMatrix4(mesh.matrixWorld)
      .project(scene.camera)
    const bounds = scene.canvas.getBoundingClientRect()
    return {
      x: bounds.left + ((local.x + 1) / 2) * bounds.width,
      y: bounds.top + ((1 - local.y) / 2) * bounds.height,
    }
  }

  return {
    stop: stopInteraction,
    reset() {
      stopInteraction()
      lastValidPaintPoint = null
      emitActivity(null)
    },
    getInteractionState: () => ({
      gestureActive: pointerIsDown,
      pointerCaptured:
        activePointerId !== null && Boolean(scene.canvas?.hasPointerCapture?.(activePointerId)),
      insideCanvas: !suspendedOutsideCanvas,
      suspendedOutsideCanvas,
      lastValidPaintPoint,
      mode: activeMode,
    }),
    projectUv,
    getProjectedBounds() {
      const bottomLeft = projectUv({ x: 0, y: 0 })
      const topRight = projectUv({ x: 1, y: 1 })
      if (!bottomLeft || !topRight) return null
      return {
        left: bottomLeft.x,
        top: topRight.y,
        width: topRight.x - bottomLeft.x,
        height: bottomLeft.y - topRight.y,
      }
    },
  }
}
