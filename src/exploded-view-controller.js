const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3)

export function createExplodedViewController({
  scene,
  group,
  panelContent,
  panel,
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
  const sign = config.frontDirectionSign === -1 ? -1 : 1
  const layerConfigs = config.layers
  const planes = new Map(
    layerConfigs.map((layer) => [layer.id, group.querySelector(`[data-explode-layer="${layer.id}"]`)]),
  )
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const panelWorldPosition = new THREE.Vector3()
  const panelWorldQuaternion = new THREE.Quaternion()
  const panelWorldNormal = new THREE.Vector3()
  const layerWorldPosition = new THREE.Vector3()
  let animationFrameId = null
  let selectedLayer = null
  let pointerStart = null

  const setPosition = (plane, position) => {
    plane.object3D.position.set(position[0], position[1], position[2])
  }

  const getFrontZ = (distance) =>
    config.panelSurfaceZ - group.object3D.position.z + sign * Math.max(config.minimumFrontGap, distance)

  const getTargetPosition = (layer) => [layer.x, layer.y, getFrontZ(layer.z)]

  const getCollapsedPosition = (layer, index) => [
    0,
    0,
    getFrontZ(config.minimumFrontGap + index * config.minimumFrontGap * 0.35),
  ]

  const applyMeshSettings = (entity, renderOrder, { depthWrite, alphaTest = 0.01 } = {}) => {
    const meshRoot = entity?.getObject3D('mesh')
    if (!meshRoot) return false
    meshRoot.traverse((object) => {
      if (!object.isMesh) return
      object.renderOrder = renderOrder
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach((material) => {
        material.transparent = true
        material.alphaTest = alphaTest
        material.depthWrite = depthWrite
        material.depthTest = true
        material.side = THREE.DoubleSide
        material.needsUpdate = true
      })
    })
    return true
  }

  const configureRenderLayers = () => {
    applyMeshSettings(panel, 0, { depthWrite: true })
    layerConfigs.forEach((layer) => applyMeshSettings(planes.get(layer.id), layer.renderOrder, { depthWrite: false }))
    applyMeshSettings(outline, 21, { depthWrite: false, alphaTest: 0 })
  }

  ;[panel, outline, ...planes.values()].forEach((entity) =>
    entity?.addEventListener('object3dset', configureRenderLayers, { signal }),
  )

  const setOpacity = (plane, opacity) => {
    plane.setAttribute('material', 'opacity', opacity)
    const meshRoot = plane.getObject3D('mesh')
    meshRoot?.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach((material) => {
        material.opacity = opacity
      })
    })
  }

  const getMaterialState = (plane) => {
    let mesh = null
    plane.getObject3D('mesh')?.traverse((object) => {
      if (!mesh && object.isMesh) mesh = object
    })
    const material = Array.isArray(mesh?.material) ? mesh.material[0] : mesh?.material
    return {
      renderOrder: mesh?.renderOrder ?? null,
      depthWrite: material?.depthWrite ?? null,
      depthTest: material?.depthTest ?? null,
      alphaTest: material?.alphaTest ?? null,
    }
  }

  const getLayerState = () => {
    panel.object3D.getWorldPosition(panelWorldPosition)
    panel.object3D.getWorldQuaternion(panelWorldQuaternion)
    panelWorldNormal.set(0, 0, sign).applyQuaternion(panelWorldQuaternion).normalize()
    return layerConfigs.map((layer) => {
      const plane = planes.get(layer.id)
      plane.object3D.getWorldPosition(layerWorldPosition)
      const localSignedDistance =
        (plane.object3D.position.z + group.object3D.position.z - config.panelSurfaceZ) * sign
      const worldSignedDistance = layerWorldPosition.clone().sub(panelWorldPosition).dot(panelWorldNormal)
      return {
        id: layer.id,
        position: {
          x: plane.object3D.position.x,
          y: plane.object3D.position.y,
          z: plane.object3D.position.z,
        },
        worldPosition: {
          x: layerWorldPosition.x,
          y: layerWorldPosition.y,
          z: layerWorldPosition.z,
        },
        rotation: {
          x: plane.object3D.rotation.x,
          y: plane.object3D.rotation.y,
          z: plane.object3D.rotation.z,
        },
        opacity: Number(plane.getAttribute('material')?.opacity ?? 1),
        localSignedDistance,
        worldSignedDistance,
        isInFront: localSignedDistance >= config.minimumFrontGap - 1e-6 && worldSignedDistance > 0,
        ...getMaterialState(plane),
      }
    })
  }

  const notify = () => onChanged({ selectedLayer, layers: getLayerState() })

  const resetLayers = () => {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
    animationFrameId = null
    selectedLayer = null
    layerConfigs.forEach((layer, index) => {
      const plane = planes.get(layer.id)
      setPosition(plane, getCollapsedPosition(layer, index))
      setOpacity(plane, 1)
    })
    outline.setAttribute('visible', false)
    configureRenderLayers()
    onAnimationProgress(0)
    notify()
  }

  const show = () => {
    craftPlane.setAttribute('visible', false)
    group.setAttribute('visible', true)
    craftPlane.object3D.visible = false
    group.object3D.visible = true
    configureRenderLayers()
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
      layerConfigs.forEach((layer, index) => {
        const from = getCollapsedPosition(layer, index)
        const to = getTargetPosition(layer)
        setPosition(planes.get(layer.id), from.map((value, axis) => value + (to[axis] - value) * eased))
      })
      configureRenderLayers()
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
      setPosition(planes.get(layer.id), getTargetPosition(layer))
      setOpacity(planes.get(layer.id), 1)
    })
    outline.setAttribute('visible', false)
    configureRenderLayers()
    notify()
  }

  const focus = (layerId) => {
    const selectedConfig = layerConfigs.find((layer) => layer.id === layerId)
    if (!selectedConfig) return
    selectedLayer = layerId
    layerConfigs.forEach((layer) => {
      const plane = planes.get(layer.id)
      const position = getTargetPosition(layer)
      if (layer.id === layerId) position[2] += sign * config.focusDepth
      setPosition(plane, position)
      setOpacity(plane, layer.id === layerId ? 1 : config.unfocusedOpacity)
    })
    const selectedPosition = getTargetPosition(selectedConfig)
    selectedPosition[2] += sign * (config.focusDepth + config.minimumFrontGap)
    outline.object3D.position.set(...selectedPosition)
    outline.setAttribute('visible', true)
    configureRenderLayers()
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
    const result = {
      x: bounds.left + ((local.x + 1) / 2) * bounds.width,
      y: bounds.top + ((1 - local.y) / 2) * bounds.height,
    }
    return Number.isFinite(result.x) && Number.isFinite(result.y) ? result : null
  }

  const hitLayer = (clientX, clientY) => {
    const bounds = scene.canvas.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return null
    pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(pointer, scene.camera)
    const objects = layerConfigs.map((layer) => planes.get(layer.id).getObject3D('mesh')).filter(Boolean)
    const hit = raycaster.intersectObjects(objects, false)[0]
    if (!hit) return null
    return layerConfigs.find((layer) => planes.get(layer.id).getObject3D('mesh') === hit.object)?.id ?? null
  }

  scene.canvas.addEventListener('pointerdown', (event) => {
    if (!isInteractive() || (event.pointerType === 'mouse' && event.button !== 0)) return
    pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }, { signal })
  scene.canvas.addEventListener('pointerup', (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId || !isInteractive()) return
    const distance = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
    pointerStart = null
    if (distance > 8) return
    const layerId = hitLayer(event.clientX, event.clientY)
    if (layerId) onLayerClick(layerId)
  }, { signal })
  scene.canvas.addEventListener('pointercancel', () => (pointerStart = null), { signal })
  window.addEventListener('blur', () => (pointerStart = null), { signal })

  configureRenderLayers()
  resetLayers()

  return {
    show,
    hide,
    expand,
    focus,
    restoreOverview,
    reset: hide,
    getSelectedLayer: () => selectedLayer,
    getLayerState,
    getPanelState: () => ({
      panelSurfaceZ: config.panelSurfaceZ,
      frontDirectionSign: sign,
      minimumFrontGap: config.minimumFrontGap,
      panelContentId: panelContent?.id ?? null,
    }),
    projectLayerUv,
    destroy() {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
    },
  }
}
