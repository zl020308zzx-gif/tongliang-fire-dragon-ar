const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3)

export function createExplodedViewController({
  scene,
  group,
  craftPlane,
  outline,
  config,
  signal,
  isInteractive,
  onLayerClick,
  onAnimationProgress,
  onChanged,
}) {
  const THREE = window.AFRAME.THREE
  const layerConfigs = config.layers
  const planes = new Map(
    layerConfigs.map((layer) => [layer.id, group.querySelector(`[data-explode-layer="${layer.id}"]`)]),
  )
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let animationFrameId = null
  let selectedLayer = null
  let pointerStart = null

  const setPosition = (plane, position) => {
    plane.object3D.position.set(position[0], position[1], position[2])
  }

  const setOpacity = (plane, opacity) => {
    plane.setAttribute('material', 'opacity', opacity)
  }

  const notify = () => onChanged({ selectedLayer, layers: getLayerState() })

  const getLayerState = () =>
    layerConfigs.map((layer) => {
      const plane = planes.get(layer.id)
      return {
        id: layer.id,
        position: {
          x: plane.object3D.position.x,
          y: plane.object3D.position.y,
          z: plane.object3D.position.z,
        },
        rotation: {
          x: plane.object3D.rotation.x,
          y: plane.object3D.rotation.y,
          z: plane.object3D.rotation.z,
        },
        opacity: Number(plane.getAttribute('material')?.opacity ?? 1),
      }
    })

  const resetLayers = () => {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
    animationFrameId = null
    selectedLayer = null
    layerConfigs.forEach((layer) => {
      const plane = planes.get(layer.id)
      setPosition(plane, [0, 0, 0])
      setOpacity(plane, 1)
    })
    outline.setAttribute('visible', false)
    onAnimationProgress(0)
    notify()
  }

  const show = () => {
    craftPlane.setAttribute('visible', false)
    group.setAttribute('visible', true)
    craftPlane.object3D.visible = false
    group.object3D.visible = true
  }

  const hide = () => {
    group.setAttribute('visible', false)
    craftPlane.setAttribute('visible', true)
    group.object3D.visible = false
    craftPlane.object3D.visible = true
    resetLayers()
  }

  const expand = (onComplete) => {
    resetLayers()
    show()
    const start = performance.now()
    const animate = (time) => {
      const linear = Math.min(1, (time - start) / config.animationDurationMs)
      const eased = easeOutCubic(linear)
      layerConfigs.forEach((layer) => {
        setPosition(
          planes.get(layer.id),
          layer.targetPosition.map((value) => value * eased),
        )
      })
      onAnimationProgress(linear)
      notify()
      if (linear < 1) animationFrameId = requestAnimationFrame(animate)
      else {
        animationFrameId = null
        onComplete()
      }
    }
    animationFrameId = requestAnimationFrame(animate)
  }

  const restoreOverview = () => {
    selectedLayer = null
    layerConfigs.forEach((layer) => {
      setPosition(planes.get(layer.id), layer.targetPosition)
      setOpacity(planes.get(layer.id), 1)
    })
    outline.setAttribute('visible', false)
    notify()
  }

  const focus = (layerId) => {
    const selectedConfig = layerConfigs.find((layer) => layer.id === layerId)
    if (!selectedConfig) return
    selectedLayer = layerId
    layerConfigs.forEach((layer) => {
      const plane = planes.get(layer.id)
      const position = [...layer.targetPosition]
      if (layer.id === layerId) position[2] += config.focusDepth
      setPosition(plane, position)
      setOpacity(plane, layer.id === layerId ? 1 : config.unfocusedOpacity)
    })
    const selectedPosition = [...selectedConfig.targetPosition]
    selectedPosition[2] += config.focusDepth - 0.01
    outline.object3D.position.set(...selectedPosition)
    outline.setAttribute('visible', true)
    notify()
  }

  const projectLayerUv = (layerId, uv) => {
    const plane = planes.get(layerId)
    const mesh = plane?.getObject3D('mesh')
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

  const hitLayer = (clientX, clientY) => {
    const bounds = scene.canvas.getBoundingClientRect()
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(pointer, scene.camera)
    const objects = layerConfigs.map((layer) => planes.get(layer.id).getObject3D('mesh')).filter(Boolean)
    const hit = raycaster.intersectObjects(objects, false)[0]
    if (!hit) return null
    return layerConfigs.find((layer) => planes.get(layer.id).getObject3D('mesh') === hit.object)?.id ?? null
  }

  scene.canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (!isInteractive() || (event.pointerType === 'mouse' && event.button !== 0)) return
      pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
    },
    { signal },
  )
  scene.canvas.addEventListener(
    'pointerup',
    (event) => {
      if (!pointerStart || pointerStart.id !== event.pointerId || !isInteractive()) return
      const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
      pointerStart = null
      if (distance > 8) return
      const layerId = hitLayer(event.clientX, event.clientY)
      if (layerId) onLayerClick(layerId)
    },
    { signal },
  )
  scene.canvas.addEventListener('pointercancel', () => (pointerStart = null), { signal })
  window.addEventListener('blur', () => (pointerStart = null), { signal })

  return {
    show,
    hide,
    expand,
    focus,
    restoreOverview,
    reset: hide,
    getSelectedLayer: () => selectedLayer,
    getLayerState,
    projectLayerUv,
    destroy() {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
    },
  }
}
