const clamp01 = (value) => Math.min(1, Math.max(0, value))
const easeOutCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3)
const easeInOutCubic = (value) => {
  const t = clamp01(value)
  return t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2
}
const lerp = (from, to, progress) => from + (to - from) * progress
const invalidNumericLabels = new Set()

const finiteOr = (value, fallback, label) => {
  if (Number.isFinite(value)) return value
  if (!invalidNumericLabels.has(label)) {
    invalidNumericLabels.add(label)
    console.error(`[page2] Invalid numeric value: ${label}`, value)
  }
  return fallback
}

const forEachMaterial = (entity, callback) => {
  entity?.object3D?.traverse((object) => {
    if (!object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => callback(material, object))
  })
}

const setOpacity = (entity, opacity) => {
  let materialFound = false
  forEachMaterial(entity, (material) => {
    materialFound = true
    material.transparent = true
    material.opacity = clamp01(opacity)
  })
  if (!materialFound) entity?.setAttribute('material', 'opacity', clamp01(opacity))
}

const setVisible = (entity, visible) => {
  if (!entity?.object3D) return
  entity.object3D.visible = visible
  entity.setAttribute('visible', visible)
}

export function createPage2Overview({ root, config, onEntryComplete, onExitComplete, onRestoreComplete }) {
  const THREE = window.AFRAME.THREE
  const overviewRoot = root.querySelector('#page2-overview-root')
  const groups = {
    title: root.querySelector('#page2-title-root'),
    intro: root.querySelector('#page2-intro-root'),
    map: root.querySelector('#page2-map-root'),
    main: root.querySelector('#page2-main-visual-root'),
    types: root.querySelector('#page2-types-root'),
    timeline: root.querySelector('#page2-timeline-root'),
  }
  const entities = new Map(config.layers.map((layer) => [layer.key, root.querySelector(`[data-page2-layer="${layer.key}"]`)]))
  const layerElements = [...entities.values()].filter(Boolean)
  const layersByAsset = new Map()
  entities.forEach((entity, key) => {
    const assetKey = entity?.dataset.page2AssetKey
    if (!assetKey) return
    if (!layersByAsset.has(assetKey)) layersByAsset.set(assetKey, [])
    layersByAsset.get(assetKey).push(key)
  })
  const mapPulse = root.querySelector('#page2-map-tongliang-pulse')
  const fireHit = root.querySelector('#page2-fire-entry-hit')
  const ripple = root.querySelector('#page2-entry-ripple')
  const debugRing = root.querySelector('#page2-debug-ring-center')
  const debugFire = root.querySelector('#page2-debug-fire-hotspot')
  const debugTongliang = root.querySelector('#page2-debug-tongliang-center')
  const readyAssets = new Set()
  const readyAtElapsed = new Map()
  const lateReveals = new Map()
  const finalPoses = new Map()
  const entryStartPoses = new Map()
  const angle = THREE.MathUtils.degToRad(finiteOr(config.background.openAngle, 78, 'background.openAngle'))
  const cosAngle = Math.cos(angle)
  const sinAngle = Math.sin(angle)
  const rearEdgeY = finiteOr(config.markerAspect, 210 / 148, 'markerAspect') / 2
  const verticalCenterZ = (finiteOr(config.background.height, 1.53, 'background.height') / 2) * sinAngle
  const initialDepthUnit = (
    finiteOr(config.overview.initialDepthMm, 6, 'overview.initialDepthMm')
    / finiteOr(config.spatial.markerWidthMm, 148, 'spatial.markerWidthMm')
  ) * finiteOr(config.spatial.depthScale, 1, 'spatial.depthScale')
  let mode = 'hidden'
  let elapsed = 0
  let continuousElapsed = 0

  const layerConfig = (key) => config.layers.find((layer) => layer.key === key)
  const rotatedPoint = (depthUnit, localX = 0, localY = 0, label = 'layer') => new THREE.Vector3(
    finiteOr(localX, 0, `${label}.x`),
    rearEdgeY - finiteOr(depthUnit, initialDepthUnit, `${label}.depthUnit`) + finiteOr(localY, 0, `${label}.localY`) * cosAngle,
    verticalCenterZ + finiteOr(localY, 0, `${label}.localY`) * sinAngle,
  )

  const localPointForLayer = (key) => {
    if (key === 'main-ring') return {
      x: (config.mainVisual.ringCenterX - 0.5) * config.background.width,
      y: (0.5 - config.mainVisual.ringCenterY) * config.background.height,
    }
    if (key === 'main-pearl') return {
      x: (config.mainVisual.pearlCenterX - 0.5) * config.background.width,
      y: (0.5 - config.mainVisual.pearlCenterY) * config.background.height,
    }
    if (key === 'map-tongliang') return {
      x: (config.map.tongliangX + config.map.tongliangOffsetX - 0.5) * config.background.width,
      y: (0.5 - config.map.tongliangY - config.map.tongliangOffsetY) * config.background.height,
    }
    return { x: 0, y: 0 }
  }

  const typePose = (key) => {
    if (key === 'types-back') return config.types.row1
    if (key === 'types-mid') return config.types.row2
    if (key === 'types-front') return config.types.row3
    return { scale: 1, offsetY: 0 }
  }

  const rebuildSpatialLayout = () => {
    config.layers.forEach((layer) => {
      const entity = entities.get(layer.key)
      if (!entity) return
      const local = localPointForLayer(layer.key)
      const type = typePose(layer.key)
      const final = rotatedPoint(layer.depthUnit, local.x, local.y + type.offsetY, layer.key)
      const start = rotatedPoint(initialDepthUnit, local.x, local.y + type.offsetY, `${layer.key}.start`)
      const scale = finiteOr(type.scale, 1, `${layer.key}.scale`)
      finalPoses.set(layer.key, { position: final, scale })
      entryStartPoses.set(layer.key, { position: start, scale })
      entity.object3D.rotation.set(angle, 0, 0)
      entity.object3D.position.copy(final)
      entity.object3D.scale.setScalar(type.scale)
      entity.object3D.traverse((object) => { object.renderOrder = layer.renderOrder })
      forEachMaterial(entity, (_, object) => { object.renderOrder = layer.renderOrder })
      const debugLabel = root.querySelector(`[data-page2-debug-layer="${layer.key}"]`)
      if (debugLabel) {
        debugLabel.object3D.position.copy(rotatedPoint(layer.depthUnit, -0.49, 0.73))
        debugLabel.object3D.rotation.set(angle, 0, 0)
      }
    })

    const tongliangPose = finalPoses.get('map-tongliang')
    if (tongliangPose) {
      mapPulse.object3D.position.copy(tongliangPose.position)
      mapPulse.object3D.rotation.set(angle, 0, 0)
      debugTongliang.object3D.position.copy(tongliangPose.position)
      debugTongliang.object3D.rotation.set(angle, 0, 0)
    }
    const ringPose = finalPoses.get('main-ring')
    if (ringPose) {
      debugRing.object3D.position.copy(ringPose.position)
      debugRing.object3D.rotation.set(angle, 0, 0)
    }
    const dragonLayer = layerConfig('main-dragon')
    const hitLocal = {
      x: (config.fireEntryHotspot.x - 0.5) * config.background.width,
      y: (0.5 - config.fireEntryHotspot.y) * config.background.height,
    }
    const hitPosition = rotatedPoint(dragonLayer.depthUnit, hitLocal.x, hitLocal.y)
    ;[fireHit, ripple, debugFire].forEach((entity) => {
      entity.object3D.position.copy(hitPosition)
      entity.object3D.rotation.set(angle, 0, 0)
      entity.object3D.traverse((object) => { object.renderOrder = dragonLayer.renderOrder + 1 })
    })
  }

  const setLayerPose = (key, progress, { x = 0, up = 0, scaleFrom = null } = {}) => {
    const entity = entities.get(key)
    const start = entryStartPoses.get(key)
    const final = finalPoses.get(key)
    if (!entity || !start || !final) return
    const safeProgress = clamp01(finiteOr(progress, 0, `${key}.progress`))
    const safeX = finiteOr(x, 0, `${key}.entryX`)
    const safeUp = finiteOr(up, 0, `${key}.entryUp`)
    entity.object3D.position.lerpVectors(start.position, final.position, safeProgress)
    entity.object3D.position.x += safeX * (1 - safeProgress)
    entity.object3D.position.y += safeUp * cosAngle * (1 - safeProgress)
    entity.object3D.position.z += safeUp * sinAngle * (1 - safeProgress)
    entity.object3D.scale.setScalar(finiteOr(lerp(scaleFrom ?? final.scale, final.scale, safeProgress), final.scale, `${key}.animatedScale`))
    setOpacity(entity, safeProgress)
  }

  const layerProgress = (layer) => {
    const entity = entities.get(layer.key)
    if (!entity || !readyAssets.has(entity.dataset.page2AssetKey)) return 0
    const scheduledStart = layer.layerIndex * config.overview.layerStagger
    const readyStart = readyAtElapsed.get(layer.key) ?? 0
    return easeOutCubic((elapsed - Math.max(scheduledStart, readyStart)) / config.overview.layerDuration)
  }

  const applyEntry = () => {
    config.layers.forEach((layer) => {
      const p = layerProgress(layer)
      const options = {}
      if (['intro-line', 'intro-text'].includes(layer.key)) options.x = -0.045
      if (['map-main', 'map-text', 'map-tongliang'].includes(layer.key)) options.x = 0.045
      if (layer.key === 'title') { options.up = 0.035; options.scaleFrom = 0.95 }
      if (layer.key.startsWith('main-')) options.up = -0.045
      if (layer.key.startsWith('types-')) options.scaleFrom = Math.max(0.9, finalPoses.get(layer.key)?.scale - 0.07)
      if (layer.key.startsWith('timeline-')) options.up = -0.035
      setLayerPose(layer.key, p, options)
    })
    const tongliang = layerProgress(layerConfig('map-tongliang'))
    setOpacity(mapPulse, tongliang * 0.55)
  }

  const applyFinal = () => {
    Object.values(groups).forEach((group) => {
      group.object3D.position.set(0, 0, 0)
      group.object3D.scale.setScalar(1)
    })
    config.layers.forEach((layer) => {
      const entity = entities.get(layer.key)
      const pose = finalPoses.get(layer.key)
      if (!entity || !pose) return
      entity.object3D.position.copy(pose.position)
      entity.object3D.rotation.x = angle
      entity.object3D.scale.setScalar(pose.scale)
      setOpacity(entity, readyAssets.has(entity.dataset.page2AssetKey) ? 1 : 0)
    })
  }

  const applyContinuous = (delta) => {
    continuousElapsed += delta
    const seconds = continuousElapsed / 1000
    const ring = entities.get('main-ring')
    ring.object3D.rotation.z = -(seconds / config.mainVisual.ringRotationSeconds) * Math.PI * 2
    const mapPoint = entities.get('map-tongliang')
    const mapPulseValue = (Math.sin((seconds * Math.PI * 2) / (config.map.tongliangPulseDuration / 1000)) + 1) * 0.5
    mapPoint.object3D.scale.setScalar(1)
    setOpacity(mapPoint, 0.76 + mapPulseValue * 0.24)
    mapPulse.object3D.scale.setScalar(1 + mapPulseValue * (config.map.tongliangPulseScale - 1))
    setOpacity(mapPulse, (1 - mapPulseValue) * 0.46)
    const dancers = entities.get('main-dancers')
    const dragon = entities.get('main-dragon')
    const pearl = entities.get('main-pearl')
    const dancersPose = finalPoses.get('main-dancers')
    const dragonPose = finalPoses.get('main-dragon')
    const pearlPose = finalPoses.get('main-pearl')
    dancers.object3D.position.copy(dancersPose.position)
    dancers.object3D.position.z += Math.sin((seconds * Math.PI * 2) / 5.2) * config.mainVisual.dancersAmplitude
    dragon.object3D.position.copy(dragonPose.position)
    dragon.object3D.position.x += Math.sin((seconds * Math.PI * 2) / 4.7 + 0.82) * config.mainVisual.dragonAmplitude
    const pearlPulse = (Math.sin((seconds * Math.PI * 2) / 3.1) + 1) * 0.5
    pearl.object3D.position.copy(pearlPose.position)
    pearl.object3D.position.z += Math.sin((seconds * Math.PI * 2) / 3.1 + 0.35) * config.mainVisual.pearlAmplitude
    pearl.object3D.scale.setScalar(1 + pearlPulse * 0.045)
    setOpacity(pearl, 0.84 + pearlPulse * 0.16)
    setOpacity(entities.get('main-sparks'), 0.9 + Math.sin(seconds * 1.05) * 0.04)

    lateReveals.forEach((value, key) => {
      value.elapsed += delta
      const p = easeOutCubic(value.elapsed / 700)
      setLayerPose(key, p)
      if (p >= 1) lateReveals.delete(key)
    })
  }

  const applyExit = () => {
    const t = easeInOutCubic(elapsed / config.overview.exitDuration)
    const opacity = 1 - t
    const groupMoves = {
      title: { x: 0, z: 0.05 }, intro: { x: -0.07, z: 0 }, map: { x: 0.07, z: 0 },
      types: { x: -0.055, z: -0.04 }, timeline: { x: 0.055, z: -0.04 }, main: { x: 0, z: -0.075 },
    }
    Object.entries(groups).forEach(([key, group]) => {
      const move = groupMoves[key]
      group.object3D.position.set(move.x * t, 0, move.z * t)
      setOpacity(group, opacity)
    })
  }

  rebuildSpatialLayout()
  setVisible(overviewRoot, false)

  const resetEntry = () => {
    setVisible(overviewRoot, true)
    Object.values(groups).forEach((group) => group.object3D.position.set(0, 0, 0))
    config.layers.forEach((layer) => setLayerPose(layer.key, 0))
    setOpacity(mapPulse, 0)
  }

  return {
    setDepthDirection() {
      rebuildSpatialLayout()
    },
    markAssetReady(assetKey) {
      if (readyAssets.has(assetKey)) return false
      readyAssets.add(assetKey)
      const keys = layersByAsset.get(assetKey) || []
      keys.forEach((key) => {
        const layer = config.layers.find((item) => item.key === key)
        const entity = entities.get(key)
        setVisible(entity, true)
        entity?.object3D.traverse((object) => {
          if (object.material && layer) object.renderOrder = layer.renderOrder
        })
        readyAtElapsed.set(key, mode === 'entering' ? elapsed : 0)
        if (mode === 'overview') lateReveals.set(key, { elapsed: 0 })
      })
      return true
    },
    resetEntry,
    startEntry() {
      elapsed = 0
      continuousElapsed = 0
      mode = 'entering'
      resetEntry()
    },
    startExit() {
      if (mode === 'exiting') return
      elapsed = 0
      mode = 'exiting'
      applyFinal()
    },
    restore() {
      elapsed = 0
      mode = 'restoring'
      setVisible(overviewRoot, true)
      applyFinal()
      Object.values(groups).forEach((group) => setOpacity(group, 0))
    },
    update(delta) {
      if (mode === 'hidden') return
      elapsed += delta
      if (mode === 'entering') {
        applyEntry()
        if (elapsed >= config.overviewEntranceDuration) {
          mode = 'overview'
          applyFinal()
          onEntryComplete?.()
        }
      } else if (mode === 'overview') applyContinuous(delta)
      else if (mode === 'exiting') {
        applyExit()
        if (elapsed >= config.overview.exitDuration) {
          mode = 'hidden'
          setVisible(overviewRoot, false)
          onExitComplete?.()
        }
      } else if (mode === 'restoring') {
        const t = easeOutCubic(elapsed / config.overview.restoreDuration)
        applyFinal()
        Object.values(groups).forEach((group) => setOpacity(group, t))
        if (t >= 1) {
          mode = 'overview'
          onRestoreComplete?.()
        }
      }
    },
    hide() { mode = 'hidden'; setVisible(overviewRoot, false) },
    showFinal() { mode = 'overview'; setVisible(overviewRoot, true); applyFinal() },
    getMode: () => mode,
    getLayerElements: () => layerElements,
    getLayerById: () => entities,
    getReadyAssets: () => new Set(readyAssets),
    ensureReadyLayersVisible() {
      setVisible(overviewRoot, true)
      readyAssets.forEach((assetKey) => {
        ;(layersByAsset.get(assetKey) || []).forEach((key) => setVisible(entities.get(key), true))
      })
      applyFinal()
    },
    validateVisibility() {
      const strongLayers = []
      const visibleLayers = layerElements.filter((element) => {
        if (!element.object3D || element.object3D.visible === false) return false
        let visibleMesh = false
        element.object3D.traverse((child) => {
          if (visibleMesh || !child.isMesh || child.visible === false) return
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          visibleMesh = materials.some((material) => {
            const image = material?.map?.image
            const visible = material?.visible !== false
              && Number.isFinite(material?.opacity)
              && material.opacity > 0.05
              && image?.complete === true
              && image.naturalWidth > 0
              && image.naturalHeight > 0
            if (visible && material.opacity >= 0.9) strongLayers.push(element)
            return visible
          })
        })
        return visibleMesh
      })
      return {
        visibleLayers,
        visibleLayerIds: visibleLayers.map((element) => element.dataset.page2Layer),
        visibleLayerCount: visibleLayers.length,
        visibleMainCount: visibleLayers.filter((element) => element.dataset.page2Layer?.startsWith('main-')).length,
        strongLayerCount: new Set(strongLayers).size,
      }
    },
    getProgress: () => mode === 'entering' ? clamp01(elapsed / config.overviewEntranceDuration) : mode === 'overview' ? 1 : 0,
    getDebugState: () => ({
      mode,
      progress: mode === 'entering' ? clamp01(elapsed / config.overviewEntranceDuration) : mode === 'overview' ? 1 : 0,
      rearEdgeOrigin: [0, rearEdgeY, 0],
      cardFrontEdge: [0, rearEdgeY - config.spatial.cardDepthUnit, 0],
      readyAssets: [...readyAssets],
      layers: config.layers.map((layer) => ({
        ...layer,
        position: entities.get(layer.key)?.object3D.position.toArray() || null,
      })),
    }),
    destroy() { mode = 'hidden'; lateReveals.clear() },
  }
}
