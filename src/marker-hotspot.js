export function createMarkerHotspot({
  scene,
  plane,
  visual,
  label,
  config,
  signal,
  debug,
  onActivate,
  onDebug,
}) {
  const THREE = window.AFRAME.THREE
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let enabled = false
  let tracked = false
  let pointerStart = null
  let aspect = config.markerAspectFallback
  let frameId = null

  const applyGeometry = () => {
    const hotspot = config.bambooHotspot
    const width = hotspot.xMax - hotspot.xMin
    const height = (hotspot.yMax - hotspot.yMin) * aspect
    const x = (hotspot.xMin + hotspot.xMax) / 2 - 0.5
    const y = (0.5 - (hotspot.yMin + hotspot.yMax) / 2) * aspect
    plane.setAttribute('width', config.markerWidth)
    plane.setAttribute('height', aspect)
    visual.setAttribute('width', width)
    visual.setAttribute('height', height)
    visual.object3D.position.set(x, y, 0.006)
  }

  const setVisibility = () => {
    const visible = enabled && tracked
    visual.object3D.visible = visible
    visual.setAttribute('visible', visible)
    label.hidden = !visible
  }

  const getIntersection = (clientX, clientY) => {
    const mesh = plane.getObject3D('mesh')
    if (!mesh || !scene.camera || !scene.canvas) return null
    const bounds = scene.canvas.getBoundingClientRect()
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(pointer, scene.camera)
    const intersection = raycaster.intersectObject(mesh, true)[0]
    if (!intersection?.uv) return null
    const uv = { x: intersection.uv.x, y: intersection.uv.y }
    const image = { x: uv.x, y: 1 - uv.y }
    const hotspot = config.bambooHotspot
    return {
      uv,
      image,
      hit:
        image.x >= hotspot.xMin &&
        image.x <= hotspot.xMax &&
        image.y >= hotspot.yMin &&
        image.y <= hotspot.yMax,
    }
  }

  const projectLabel = () => {
    if (!label.hidden && scene.camera && scene.canvas) {
      const world = new THREE.Vector3()
      visual.object3D.getWorldPosition(world)
      world.project(scene.camera)
      const bounds = scene.canvas.getBoundingClientRect()
      label.style.left = `${bounds.left + ((world.x + 1) / 2) * bounds.width}px`
      label.style.top = `${bounds.top + ((1 - world.y) / 2) * bounds.height}px`
    }
    frameId = requestAnimationFrame(projectLabel)
  }

  scene.canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (!enabled || !tracked || (event.pointerType === 'mouse' && event.button !== 0)) return
      pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
    },
    { signal },
  )
  scene.canvas.addEventListener(
    'pointerup',
    (event) => {
      if (!pointerStart || pointerStart.id !== event.pointerId || !enabled || !tracked) return
      const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
      pointerStart = null
      if (distance > 10) return
      const result = getIntersection(event.clientX, event.clientY)
      onDebug({ ...result, aspect })
      if (result?.hit) onActivate(result)
    },
    { signal },
  )
  scene.canvas.addEventListener('pointercancel', () => (pointerStart = null), { signal })
  window.addEventListener('blur', () => (pointerStart = null), { signal })

  if (debug) {
    plane.setAttribute('material', 'color: #4de3ff; opacity: 0.12; wireframe: true; transparent: true; side: double')
  }
  applyGeometry()
  setVisibility()
  frameId = requestAnimationFrame(projectLabel)

  return {
    setEnabled(value) {
      enabled = value
      setVisibility()
    },
    setTracked(value) {
      tracked = value
      setVisibility()
    },
    updateAspect(value) {
      aspect = value || config.markerAspectFallback
      applyGeometry()
      onDebug({ aspect })
    },
    destroy() {
      if (frameId !== null) cancelAnimationFrame(frameId)
    },
  }
}
