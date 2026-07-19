const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const easeOutQuart = (value) => 1 - Math.pow(1 - clamp(value, 0, 1), 4)
const lerp = (from, to, progress) => from + (to - from) * progress

const setVisible = (entity, visible) => {
  if (!entity?.object3D) return
  entity.object3D.visible = visible
  entity.setAttribute('visible', visible)
}

export function createPage2Model({
  root,
  scene,
  config,
  hotspots,
  debug,
  isInteractive,
  isCardOpen,
  onReady,
  onEntranceComplete,
  onHotspotSelected,
  onBlankSelected,
  onLoadError,
  onDebugChanged,
}) {
  const THREE = window.AFRAME.THREE
  const modelRoot = root.querySelector('#page2-model-root')
  const transform = root.querySelector('#page2-model-transform')
  const modelEntity = root.querySelector('#page2-fire-dragon-model')
  const hotspotRoot = root.querySelector('#page2-hotspot-root')
  const hotspotEntities = new Map(
    hotspots.map((hotspot) => [hotspot.id, root.querySelector(`[data-page2-hotspot="${hotspot.id}"]`)]),
  )
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const activePointers = new Map()
  const originalMaterials = new Map()
  const axes = new THREE.AxesHelper(0.24)
  axes.visible = debug
  transform.object3D.add(axes)
  let loaded = false
  let loading = false
  let entranceRequested = false
  let entranceActive = false
  let entranceElapsed = 0
  let modelObject = null
  let userScale = 1
  let yaw = 0
  let pitch = 0
  let pinchStartDistance = 0
  let pinchStartScale = 1
  let selectedHotspotId = null
  let celebrationElapsed = -1
  let selectedScreenPoint = null
  let hotspotPulseElapsed = 0

  const setModelOpacity = (opacity) => {
    if (!modelObject) return
    modelObject.traverse((object) => {
      if (!object.isMesh || !object.material) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => {
        const originalOpacity = originalMaterials.get(material) ?? 1
        material.transparent = opacity < 1 || originalOpacity < 1
        material.opacity = originalOpacity * opacity
        material.needsUpdate = true
      })
    })
  }

  const applyTransform = (progress = 1) => {
    const from = config.model.entrancePosition
    const to = config.model.position
    const fromRotation = config.model.entranceRotation
    const toRotation = config.model.rotation
    const baseScale = config.model.scale * userScale
    const entranceScale = lerp(config.model.entranceScale, 1, progress)
    transform.object3D.position.set(
      lerp(from.x, to.x, progress),
      lerp(from.y, to.y, progress),
      lerp(from.z, to.z, progress),
    )
    transform.object3D.rotation.set(
      THREE.MathUtils.degToRad(lerp(fromRotation.x, toRotation.x + pitch, progress)),
      THREE.MathUtils.degToRad(lerp(fromRotation.y, toRotation.y + yaw, progress)),
      THREE.MathUtils.degToRad(lerp(fromRotation.z, toRotation.z, progress)),
    )
    transform.object3D.scale.setScalar(baseScale * entranceScale)
  }

  const updateHotspotAppearance = () => {
    hotspotEntities.forEach((entity, id) => {
      const viewed = entity.dataset.viewed === 'true'
      const selected = id === selectedHotspotId
      const color = selected ? '#ff6a1a' : viewed ? '#ad7a31' : '#f4bd50'
      entity.querySelector('[data-hotspot-core]')?.setAttribute('material', 'color', color)
      entity.querySelector('[data-hotspot-ring]')?.setAttribute('material', 'color', color)
      entity.classList.toggle('is-selected', selected)
    })
  }

  const applyHotspotPositions = () => {
    hotspots.forEach((hotspot) => {
      const entity = hotspotEntities.get(hotspot.id)
      entity.object3D.position.set(hotspot.position.x, hotspot.position.y, hotspot.position.z)
    })
  }

  const configureLoadedModel = () => {
    modelObject = modelEntity.getObject3D('mesh')
    if (!modelObject) return
    modelObject.traverse((object) => {
      if (!object.isMesh || !object.material) return
      if (Array.isArray(object.material)) {
        object.material = object.material.map((material) => material.clone())
        object.material.forEach((material) => originalMaterials.set(material, material.opacity))
      } else {
        object.material = object.material.clone()
        originalMaterials.set(object.material, object.material.opacity)
      }
      object.castShadow = false
      object.receiveShadow = false
    })
    loaded = true
    loading = false
    setModelOpacity(0)
    applyTransform(0)
    applyHotspotPositions()
    onReady?.()
    if (entranceRequested) startEntrance()
  }

  const preload = () => {
    if (loaded || loading) return
    loading = true
    modelEntity.setAttribute('gltf-model', '#page2-model-asset')
  }

  const startEntrance = () => {
    entranceRequested = true
    if (!loaded) {
      preload()
      return false
    }
    entranceRequested = false
    entranceElapsed = 0
    entranceActive = true
    selectedHotspotId = null
    setVisible(modelRoot, true)
    setVisible(hotspotRoot, false)
    setModelOpacity(0)
    applyTransform(0)
    return true
  }

  const resetView = () => {
    userScale = 1
    yaw = 0
    pitch = 0
    selectedHotspotId = null
    selectedScreenPoint = null
    setModelOpacity(1)
    applyTransform(1)
    updateHotspotAppearance()
  }

  const projectHotspot = (id) => {
    const entity = hotspotEntities.get(id)
    if (!entity || !scene.camera || !scene.canvas) return null
    const world = new THREE.Vector3()
    entity.object3D.getWorldPosition(world)
    world.project(scene.camera)
    const bounds = scene.canvas.getBoundingClientRect()
    const point = {
      x: bounds.left + ((world.x + 1) / 2) * bounds.width,
      y: bounds.top + ((1 - world.y) / 2) * bounds.height,
    }
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null
  }

  const getRay = (clientX, clientY) => {
    const bounds = scene.canvas.getBoundingClientRect()
    pointerNdc.x = ((clientX - bounds.left) / bounds.width) * 2 - 1
    pointerNdc.y = -((clientY - bounds.top) / bounds.height) * 2 + 1
    raycaster.setFromCamera(pointerNdc, scene.camera)
  }

  const hitHotspot = (clientX, clientY) => {
    if (!scene.camera || !scene.canvas) return null
    getRay(clientX, clientY)
    let closest = null
    hotspotEntities.forEach((entity, id) => {
      const mesh = entity.getObject3D('mesh') || entity.object3D
      const hit = raycaster.intersectObject(mesh, true)[0]
      if (hit && (!closest || hit.distance < closest.distance)) closest = { id, distance: hit.distance }
    })
    if (!closest) return null
    const modelHit = modelObject ? raycaster.intersectObject(modelObject, true)[0] : null
    return !modelHit || closest.distance <= modelHit.distance + 0.025 ? closest.id : null
  }

  const pointerDistance = () => {
    const values = [...activePointers.values()]
    return values.length < 2 ? 0 : Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y)
  }

  const onPointerDown = (event) => {
    if (!isInteractive() || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    })
    scene.canvas.setPointerCapture?.(event.pointerId)
    if (activePointers.size === 2) {
      pinchStartDistance = pointerDistance()
      pinchStartScale = userScale
    }
  }

  const onPointerMove = (event) => {
    const pointer = activePointers.get(event.pointerId)
    if (!pointer) return
    event.preventDefault()
    const dx = event.clientX - pointer.x
    const dy = event.clientY - pointer.y
    pointer.x = event.clientX
    pointer.y = event.clientY
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 4) pointer.moved = true
    if (!isInteractive() || isCardOpen()) return
    if (activePointers.size >= 2) {
      const distance = pointerDistance()
      if (pinchStartDistance > 0) {
        userScale = clamp(
          pinchStartScale * Math.pow(distance / pinchStartDistance, config.model.pinchSensitivity),
          config.model.minScale,
          config.model.maxScale,
        )
      }
    } else {
      yaw += dx * config.model.dragSensitivity
      pitch = clamp(pitch + dy * config.model.dragSensitivity * 0.45, -28, 28)
    }
    applyTransform(1)
  }

  const onPointerEnd = (event) => {
    const pointer = activePointers.get(event.pointerId)
    if (!pointer) return
    activePointers.delete(event.pointerId)
    if (!pointer.moved && isInteractive()) {
      const id = hitHotspot(event.clientX, event.clientY)
      if (id) {
        selectedHotspotId = selectedHotspotId === id ? null : id
        selectedScreenPoint = selectedHotspotId ? projectHotspot(selectedHotspotId) : null
        updateHotspotAppearance()
        if (selectedHotspotId) onHotspotSelected?.(selectedHotspotId, selectedScreenPoint)
        else onBlankSelected?.()
      } else {
        selectedHotspotId = null
        selectedScreenPoint = null
        updateHotspotAppearance()
        onBlankSelected?.()
      }
    }
    if (activePointers.size < 2) pinchStartDistance = 0
  }

  scene.canvas.addEventListener('pointerdown', onPointerDown)
  scene.canvas.addEventListener('pointermove', onPointerMove)
  scene.canvas.addEventListener('pointerup', onPointerEnd)
  scene.canvas.addEventListener('pointercancel', onPointerEnd)

  const handleModelError = (event) => {
    loading = false
    const reason = event.detail?.src || event.detail?.message || '未知模型加载错误'
    console.error(`[page2] 模型加载失败：${config.assets.model}`, reason)
    onLoadError?.(`火龙模型加载失败：${config.assets.model}`)
  }
  modelEntity.addEventListener('model-loaded', configureLoadedModel)
  modelEntity.addEventListener('model-error', handleModelError)

  setVisible(modelRoot, false)
  setVisible(hotspotRoot, false)
  applyHotspotPositions()

  return {
    preload,
    startEntrance,
    update(delta) {
      if (hotspotRoot.object3D.visible) {
        hotspotPulseElapsed += delta
        const pulse = 1.2 + Math.sin(hotspotPulseElapsed * 0.003) * 0.22
        hotspotEntities.forEach((entity) => entity.querySelector('[data-hotspot-ring]')?.object3D.scale.setScalar(pulse))
      }
      if (entranceActive) {
        entranceElapsed += delta
        const raw = clamp(entranceElapsed / config.model.entranceDuration, 0, 1)
        const progress = easeOutQuart(raw)
        applyTransform(progress)
        setModelOpacity(clamp((raw - 0.05) / 0.68, 0, 1))
        if (raw >= 1) {
          entranceActive = false
          setModelOpacity(1)
          setVisible(hotspotRoot, true)
          onEntranceComplete?.()
        }
      } else if (loaded && modelRoot.object3D.visible) {
        applyTransform(1)
      }

      if (selectedHotspotId) {
        selectedScreenPoint = projectHotspot(selectedHotspotId)
        onDebugChanged?.({ selectedHotspotId, selectedScreenPoint })
      }

      if (celebrationElapsed >= 0) {
        celebrationElapsed += delta
        const total = 1800
        const step = Math.floor(celebrationElapsed / 220)
        hotspotEntities.forEach((entity, id) => {
          const active = hotspots.findIndex((item) => item.id === id) === step
          entity.object3D.scale.setScalar(active ? 1.7 : 1)
          entity.querySelector('[data-hotspot-core]')?.setAttribute('material', 'emissiveIntensity', active ? 2.4 : 1)
        })
        const pulse = Math.sin(Math.min(1, celebrationElapsed / total) * Math.PI)
        transform.object3D.scale.multiplyScalar(1 + pulse * 0.025)
        if (celebrationElapsed >= total) {
          celebrationElapsed = -1
          hotspotEntities.forEach((entity) => {
            entity.object3D.scale.setScalar(1)
            entity.querySelector('[data-hotspot-core]')?.setAttribute('material', 'emissiveIntensity', 1)
          })
          applyTransform(1)
        }
      }
    },
    markViewed(id) {
      hotspotEntities.get(id).dataset.viewed = 'true'
      updateHotspotAppearance()
    },
    closeSelection() {
      selectedHotspotId = null
      selectedScreenPoint = null
      updateHotspotAppearance()
    },
    resetView,
    celebrate() {
      celebrationElapsed = 0
    },
    show() {
      setVisible(modelRoot, true)
      if (loaded && !entranceActive) {
        setModelOpacity(1)
        setVisible(hotspotRoot, true)
      }
    },
    hide() {
      activePointers.clear()
      entranceActive = false
      setVisible(modelRoot, false)
      setVisible(hotspotRoot, false)
    },
    setHotspotDebugVisible(visible) {
      axes.visible = visible
      hotspotEntities.forEach((entity) => {
        entity.dataset.debug = String(visible)
        entity.querySelector('[data-hotspot-debug-label]')?.setAttribute('visible', visible)
      })
    },
    updateHotspotPosition(id, axis, value) {
      const hotspot = hotspots.find((item) => item.id === id)
      if (!hotspot || !['x', 'y', 'z'].includes(axis) || !Number.isFinite(value)) return
      hotspot.position[axis] = value
      applyHotspotPositions()
      onDebugChanged?.({ hotspots })
    },
    getDebugState: () => ({
      loaded,
      loading,
      entranceActive,
      userScale,
      yaw,
      pitch,
      selectedHotspotId,
      hotspots: hotspots.map((item) => ({ id: item.id, position: { ...item.position } })),
    }),
    isLoaded: () => loaded,
    isEntering: () => entranceActive,
    destroy() {
      scene.canvas.removeEventListener('pointerdown', onPointerDown)
      scene.canvas.removeEventListener('pointermove', onPointerMove)
      scene.canvas.removeEventListener('pointerup', onPointerEnd)
      scene.canvas.removeEventListener('pointercancel', onPointerEnd)
      modelEntity.removeEventListener('model-loaded', configureLoadedModel)
      modelEntity.removeEventListener('model-error', handleModelError)
      transform.object3D.remove(axes)
      axes.geometry?.dispose()
      if (Array.isArray(axes.material)) axes.material.forEach((material) => material.dispose())
      else axes.material?.dispose()
      originalMaterials.forEach((_, material) => material.dispose())
    },
  }
}
