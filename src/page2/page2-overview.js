const clamp01 = (value) => Math.min(1, Math.max(0, value))
const easeOutCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3)
const easeInOutCubic = (value) => {
  const t = clamp01(value)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
const easeOutBack = (value) => {
  const t = clamp01(value)
  const c1 = 0.48
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
const interval = (elapsed, start, duration, easing = easeOutCubic) => easing((elapsed - start) / duration)

const forEachMaterial = (entity, callback) => {
  entity?.object3D?.traverse((object) => {
    if (!object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach(callback)
  })
}

const setOpacity = (entity, opacity) => {
  let materialFound = false
  forEachMaterial(entity, (material) => {
    materialFound = true
    material.transparent = true
    material.opacity = clamp01(opacity)
    material.needsUpdate = true
  })
  if (!materialFound) entity?.setAttribute('material', 'opacity', clamp01(opacity))
}

const setVisible = (entity, visible) => {
  if (!entity?.object3D) return
  entity.object3D.visible = visible
  entity.setAttribute('visible', visible)
}

export function createPage2Overview({ root, config, onEntryComplete, onExitComplete, onRestoreComplete }) {
  const overviewRoot = root.querySelector('#page2-overview-root')
  const groups = {
    title: root.querySelector('#page2-title-root'),
    intro: root.querySelector('#page2-intro-root'),
    map: root.querySelector('#page2-map-root'),
    main: root.querySelector('#page2-main-visual-root'),
    types: root.querySelector('#page2-types-root'),
    timeline: root.querySelector('#page2-timeline-root'),
  }
  const layers = {
    title: root.querySelector('[data-page2-layer="title"]'),
    introLine: root.querySelector('[data-page2-layer="intro-line"]'),
    introText: root.querySelector('[data-page2-layer="intro-text"]'),
    mapMain: root.querySelector('[data-page2-layer="map-main"]'),
    mapText: root.querySelector('[data-page2-layer="map-text"]'),
    mapTongliang: root.querySelector('#page2-map-tongliang'),
    mapPulse: root.querySelector('#page2-map-tongliang-pulse'),
    base: root.querySelector('[data-page2-layer="main-base"]'),
    ring: root.querySelector('#page2-main-ring'),
    scene: root.querySelector('[data-page2-layer="main-scene"]'),
    sparks: root.querySelector('[data-page2-layer="main-sparks"]'),
    performers: root.querySelector('[data-page2-layer="main-performers"]'),
    dancers: root.querySelector('[data-page2-layer="main-dancers"]'),
    dragon: root.querySelector('[data-page2-layer="main-dragon"]'),
    pearl: root.querySelector('#page2-main-pearl'),
    typesTitle: root.querySelector('[data-page2-layer="types-title"]'),
    typesBack: root.querySelector('[data-page2-layer="types-back"]'),
    typesMid: root.querySelector('[data-page2-layer="types-mid"]'),
    typesFront: root.querySelector('[data-page2-layer="types-front"]'),
    timelineBase: root.querySelector('[data-page2-layer="timeline-base"]'),
    timelineNodes: root.querySelector('[data-page2-layer="timeline-nodes"]'),
    timelineTexts: root.querySelector('[data-page2-layer="timeline-texts"]'),
  }
  let mode = 'hidden'
  let elapsed = 0
  let continuousElapsed = 0
  let depthDirection = 1

  const depth = (value) => value * depthDirection
  const resetGroupTransform = (entity) => {
    entity.object3D.position.set(0, 0, 0)
    entity.object3D.scale.setScalar(1)
  }
  const setLayerPose = (entity, { x = 0, y = 0, z = entity.object3D.position.z, scale = 1, opacity = 1 }) => {
    entity.object3D.position.set(x, y, z)
    entity.object3D.scale.setScalar(scale)
    setOpacity(entity, opacity)
  }
  const setGroupPose = (entity, { x = 0, y = 0, z = 0, scale = 1, opacity = 1 }) => {
    entity.object3D.position.set(x, y, z)
    entity.object3D.scale.setScalar(scale)
    setOpacity(entity, opacity)
  }

  const applyDepths = () => {
    layers.title.object3D.position.z = depth(config.title.depth)
    layers.introLine.object3D.position.z = depth(config.intro.depthDragonLine)
    layers.introText.object3D.position.z = depth(config.intro.depthText)
    layers.mapMain.object3D.position.z = depth(config.map.depthMain)
    layers.mapText.object3D.position.z = depth(config.map.depthText)
    layers.mapTongliang.object3D.position.z = depth(config.map.depthTongliang)
    layers.mapPulse.object3D.position.z = depth(config.map.depthTongliang + 0.001)
    Object.entries(config.mainVisual.depths).forEach(([key, value]) => {
      layers[key].object3D.position.z = depth(value)
    })
    layers.typesTitle.object3D.position.z = depth(config.types.depthTitle)
    layers.typesBack.object3D.position.z = depth(config.types.row1.depth)
    layers.typesMid.object3D.position.z = depth(config.types.row2.depth)
    layers.typesFront.object3D.position.z = depth(config.types.row3.depth)
    layers.timelineBase.object3D.position.z = depth(config.timeline.depthBase)
    layers.timelineNodes.object3D.position.z = depth(config.timeline.depthKeyNodes)
    layers.timelineTexts.object3D.position.z = depth(config.timeline.depthTexts)
  }

  const setTimelineReveal = (progress) => {
    const p = Math.max(0.001, clamp01(progress))
    const plane = layers.timelineBase
    plane.object3D.scale.x = p
    plane.object3D.position.x = -config.background.width * 0.5 + config.background.width * p * 0.5
    const mesh = plane.getObject3D('mesh')
    if (mesh?.material?.map) {
      mesh.material.map.repeat.x = p
      mesh.material.map.needsUpdate = true
    }
  }

  const applyFinal = () => {
    Object.values(groups).forEach(resetGroupTransform)
    applyDepths()
    Object.values(layers).forEach((entity) => setOpacity(entity, 1))
    layers.typesBack.object3D.position.y = config.types.row1.offsetY
    layers.typesBack.object3D.scale.setScalar(config.types.row1.scale)
    layers.typesMid.object3D.position.y = config.types.row2.offsetY
    layers.typesMid.object3D.scale.setScalar(config.types.row2.scale)
    layers.typesFront.object3D.position.y = config.types.row3.offsetY
    layers.typesFront.object3D.scale.setScalar(config.types.row3.scale)
    layers.mapTongliang.object3D.scale.setScalar(1)
    layers.mapPulse.object3D.scale.setScalar(1)
    setTimelineReveal(1)
  }

  const resetEntry = () => {
    setVisible(overviewRoot, true)
    Object.values(groups).forEach(resetGroupTransform)
    applyDepths()
    Object.values(layers).forEach((entity) => setOpacity(entity, 0))
    layers.mapPulse.object3D.scale.setScalar(0.7)
    setTimelineReveal(0.001)
  }

  const applyEntry = () => {
    const title = interval(elapsed, 0, 700, easeOutBack)
    setGroupPose(groups.title, { y: 0.028 * (1 - title), scale: 0.95 + title * 0.05, opacity: title })

    const introLine = interval(elapsed, 180, 750)
    setLayerPose(layers.introLine, { x: -0.055 * (1 - introLine), z: depth(config.intro.depthDragonLine), opacity: introLine })
    const introText = interval(elapsed, 300, 700)
    setLayerPose(layers.introText, { x: -0.042 * (1 - introText), z: depth(config.intro.depthText), opacity: introText })

    const mapMain = interval(elapsed, 260, 820)
    setLayerPose(layers.mapMain, { x: 0.052 * (1 - mapMain), z: depth(config.map.depthMain), opacity: mapMain })
    const mapText = interval(elapsed, 450, 650)
    setLayerPose(layers.mapText, { y: -0.022 * (1 - mapText), z: depth(config.map.depthText), opacity: mapText })
    const tongliang = interval(elapsed, 750, 520)
    setOpacity(layers.mapTongliang, tongliang)
    setOpacity(layers.mapPulse, tongliang * 0.7)

    const main = interval(elapsed, 550, 1050, easeInOutCubic)
    setGroupPose(groups.main, {
      y: -0.055 * (1 - main),
      z: depth(-0.032 * (1 - main)),
      scale: 0.94 + 0.06 * main,
      opacity: main,
    })

    const typesTitle = interval(elapsed, 950, 650)
    setLayerPose(layers.typesTitle, {
      x: 0.035 * (1 - typesTitle),
      y: -0.025 * (1 - typesTitle),
      z: depth(config.types.depthTitle),
      opacity: typesTitle,
    })
    const back = interval(elapsed, 1050, 700)
    setLayerPose(layers.typesBack, {
      y: config.types.row1.offsetY,
      z: depth(config.types.row1.depth - 0.025 * (1 - back)),
      scale: config.types.row1.scale * (0.96 + back * 0.04),
      opacity: back,
    })
    const mid = interval(elapsed, 1200, 700, easeOutBack)
    setLayerPose(layers.typesMid, {
      y: config.types.row2.offsetY,
      z: depth(config.types.row2.depth),
      scale: 0.92 + (config.types.row2.scale - 0.92) * mid,
      opacity: mid,
    })
    const front = interval(elapsed, 1370, 700)
    setLayerPose(layers.typesFront, {
      y: config.types.row3.offsetY - 0.025 * (1 - front),
      z: depth(config.types.row3.depth),
      scale: 0.95 + (config.types.row3.scale - 0.95) * front,
      opacity: front,
    })

    setOpacity(layers.timelineBase, 1)
    setTimelineReveal(interval(elapsed, 1450, 800, easeInOutCubic))
    const nodes = interval(elapsed, 1750, 640, easeOutBack)
    setLayerPose(layers.timelineNodes, {
      z: depth(config.timeline.depthKeyNodes),
      scale: 0.86 + nodes * 0.14,
      opacity: nodes,
    })
    const texts = interval(elapsed, 2050, 600)
    setLayerPose(layers.timelineTexts, { z: depth(config.timeline.depthTexts), opacity: texts })
  }

  const applyContinuous = () => {
    const seconds = continuousElapsed / 1000
    layers.ring.object3D.rotation.z = -(seconds / config.mainVisual.ringRotationSeconds) * Math.PI * 2
    const mapPulse = (Math.sin((seconds * Math.PI * 2) / (config.map.tongliangPulseDuration / 1000)) + 1) * 0.5
    layers.mapTongliang.object3D.scale.setScalar(1)
    setOpacity(layers.mapTongliang, 0.76 + mapPulse * 0.24)
    layers.mapPulse.object3D.scale.setScalar(1 + mapPulse * (config.map.tongliangPulseScale - 1))
    setOpacity(layers.mapPulse, (1 - mapPulse) * 0.46)
    layers.dancers.object3D.position.y = Math.sin((seconds * Math.PI * 2) / 5.2) * config.mainVisual.dancersAmplitude
    layers.dragon.object3D.position.y = Math.sin((seconds * Math.PI * 2) / 4.7 + 0.82) * config.mainVisual.dragonAmplitude
    const pearlPulse = (Math.sin((seconds * Math.PI * 2) / 3.1) + 1) * 0.5
    layers.pearl.object3D.position.y = Math.sin((seconds * Math.PI * 2) / 3.1 + 0.35) * config.mainVisual.pearlAmplitude
    layers.pearl.object3D.scale.setScalar(1 + pearlPulse * 0.045)
    setOpacity(layers.pearl, 0.84 + pearlPulse * 0.16)
    setOpacity(layers.sparks, 0.9 + Math.sin(seconds * 1.05) * 0.04)
  }

  const applyExit = () => {
    const t = easeInOutCubic(elapsed / config.overview.exitDuration)
    const opacity = 1 - t
    setGroupPose(groups.title, { y: 0.05 * t, opacity })
    setGroupPose(groups.intro, { x: -0.07 * t, opacity })
    setGroupPose(groups.map, { x: 0.07 * t, opacity })
    setGroupPose(groups.types, { x: -0.055 * t, y: -0.04 * t, opacity })
    setGroupPose(groups.timeline, { x: 0.055 * t, y: -0.04 * t, opacity })
    setGroupPose(groups.main, { y: -0.075 * t, z: depth(-0.05 * t), scale: 1 - t * 0.03, opacity })
  }

  const applyRestore = () => {
    const t = easeOutCubic(elapsed / config.overview.restoreDuration)
    applyFinal()
    Object.values(groups).forEach((entity) => setOpacity(entity, t))
    groups.title.object3D.position.y = 0.025 * (1 - t)
    groups.intro.object3D.position.x = -0.03 * (1 - t)
    groups.map.object3D.position.x = 0.03 * (1 - t)
    groups.main.object3D.position.y = -0.035 * (1 - t)
  }

  setVisible(overviewRoot, false)

  return {
    setDepthDirection(sign) {
      depthDirection = sign < 0 ? -1 : 1
      applyDepths()
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
      Object.values(groups).forEach((entity) => setOpacity(entity, 0))
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
      } else if (mode === 'overview') {
        continuousElapsed += delta
        applyContinuous()
      } else if (mode === 'exiting') {
        applyExit()
        if (elapsed >= config.overview.exitDuration) {
          mode = 'hidden'
          setVisible(overviewRoot, false)
          onExitComplete?.()
        }
      } else if (mode === 'restoring') {
        applyRestore()
        if (elapsed >= config.overview.restoreDuration) {
          mode = 'overview'
          applyFinal()
          onRestoreComplete?.()
        }
      }
    },
    hide() {
      mode = 'hidden'
      setVisible(overviewRoot, false)
    },
    showFinal() {
      mode = 'overview'
      setVisible(overviewRoot, true)
      applyFinal()
    },
    getMode: () => mode,
    getProgress: () => mode === 'entering' ? clamp01(elapsed / config.overviewEntranceDuration) : mode === 'overview' ? 1 : 0,
    getDebugState: () => ({
      mode,
      progress: mode === 'entering' ? clamp01(elapsed / config.overviewEntranceDuration) : mode === 'overview' ? 1 : 0,
      depthDirection,
      title: config.title,
      intro: config.intro,
      map: config.map,
      mainVisualDepths: config.mainVisual.depths,
      types: config.types,
      timeline: config.timeline,
    }),
    destroy() {
      mode = 'hidden'
    },
  }
}
