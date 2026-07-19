const clamp01 = (value) => Math.min(1, Math.max(0, value))
const easeOutCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3)
const easeInOutCubic = (value) => {
  const t = clamp01(value)
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
const easeOutBack = (value) => {
  const t = clamp01(value)
  const c1 = 0.55
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

const interval = (elapsed, start, end, easing = easeOutCubic) =>
  easing((elapsed - start) / Math.max(1, end - start))

const forEachMaterial = (entity, callback) => {
  entity?.object3D?.traverse((object) => {
    if (!object.material) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach(callback)
  })
}

const setOpacity = (entity, opacity) => {
  forEachMaterial(entity, (material) => {
    material.transparent = true
    material.opacity = opacity
    material.needsUpdate = true
  })
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
    introLine: root.querySelector('[data-page2-layer="intro-line"]'),
    introText: root.querySelector('[data-page2-layer="intro-text"]'),
    mapMain: root.querySelector('[data-page2-layer="map-main"]'),
    mapText: root.querySelector('[data-page2-layer="map-text"]'),
    mapTongliang: root.querySelector('#page2-map-tongliang'),
    ring: root.querySelector('#page2-main-ring'),
    sparks: root.querySelector('[data-page2-layer="main-sparks"]'),
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

  const setGroupPose = (entity, { x = 0, y = 0, z = 0, scale = 1, opacity = 1 }) => {
    entity.object3D.position.set(x, y, z)
    entity.object3D.scale.setScalar(scale)
    setOpacity(entity, opacity)
  }

  const setTimelineReveal = (progress) => {
    const plane = layers.timelineBase
    if (!plane?.object3D) return
    const width = config.background.width
    const p = Math.max(0.001, progress)
    plane.object3D.scale.x = p
    plane.object3D.position.x = -width * 0.5 + width * p * 0.5
    const mesh = plane.getObject3D('mesh')
    if (mesh?.material?.map) {
      mesh.material.map.repeat.x = p
      mesh.material.map.needsUpdate = true
    }
  }

  const applyFinal = () => {
    Object.values(groups).forEach((entity) => setGroupPose(entity, { opacity: 1 }))
    Object.values(layers).forEach((entity) => setOpacity(entity, 1))
    layers.typesBack.object3D.position.z = 0
    layers.typesBack.object3D.position.y = 0.006
    layers.typesBack.object3D.scale.setScalar(0.985)
    layers.typesMid.object3D.position.z = 0.002
    layers.typesMid.object3D.scale.setScalar(1)
    layers.typesFront.object3D.position.z = 0.004
    layers.typesFront.object3D.position.y = -0.004
    layers.typesFront.object3D.scale.setScalar(1.012)
    setTimelineReveal(1)
  }

  const applyEntry = () => {
    const title = interval(elapsed, 800, 1800, easeOutBack)
    setGroupPose(groups.title, { y: 0.035 * (1 - title), scale: 0.96 + 0.04 * title, opacity: clamp01(title) })

    const intro = interval(elapsed, 1200, 2350)
    setGroupPose(groups.intro, { x: -0.06 * (1 - intro), opacity: intro })
    setOpacity(layers.introLine, intro)
    setOpacity(layers.introText, interval(elapsed, 1400, 2500))

    const map = interval(elapsed, 1250, 2450)
    setGroupPose(groups.map, { x: 0.055 * (1 - map), y: 0.025 * (1 - map), opacity: map })
    setOpacity(layers.mapMain, map)
    setOpacity(layers.mapText, interval(elapsed, 1500, 2550))
    setOpacity(layers.mapTongliang, interval(elapsed, 2050, 2750))

    const main = interval(elapsed, 2000, 3700, easeInOutCubic)
    setGroupPose(groups.main, { y: -0.06 * (1 - main), z: -0.04 * (1 - main), scale: 0.96 + 0.04 * main, opacity: main })

    const types = interval(elapsed, 3000, 4400)
    setGroupPose(groups.types, { x: -0.045 * (1 - types), y: -0.025 * (1 - types), opacity: types })
    setOpacity(layers.typesTitle, interval(elapsed, 3000, 3800))
    setOpacity(layers.typesBack, interval(elapsed, 3200, 3900))
    const mid = interval(elapsed, 3380, 4150, easeOutBack)
    setOpacity(layers.typesMid, clamp01(mid))
    layers.typesMid.object3D.scale.setScalar(0.94 + 0.06 * mid)
    const front = interval(elapsed, 3600, 4400)
    setOpacity(layers.typesFront, front)
    layers.typesFront.object3D.position.y = -0.02 * (1 - front) - 0.004

    const timeline = interval(elapsed, 3600, 5000)
    setGroupPose(groups.timeline, { y: -0.02 * (1 - timeline), opacity: timeline })
    setOpacity(layers.timelineBase, 1)
    setTimelineReveal(interval(elapsed, 3600, 4450, easeInOutCubic))
    setOpacity(layers.timelineNodes, interval(elapsed, 4100, 4700))
    setOpacity(layers.timelineTexts, interval(elapsed, 4500, 5000))
  }

  const applyContinuous = () => {
    const seconds = continuousElapsed / 1000
    layers.ring.object3D.rotation.z = -(seconds / config.mainVisual.ringRotationSeconds) * Math.PI * 2
    const mapPulse = (Math.sin((seconds * Math.PI * 2) / (config.mapTongliang.duration / 1000)) + 1) * 0.5
    layers.mapTongliang.object3D.scale.setScalar(1 + mapPulse * 0.06)
    setOpacity(layers.mapTongliang, 0.72 + mapPulse * 0.28)
    layers.dancers.object3D.position.y = Math.sin((seconds * Math.PI * 2) / 5) * config.mainVisual.dancersAmplitude
    layers.dragon.object3D.position.y = Math.sin((seconds * Math.PI * 2) / 4.4 + 0.8) * config.mainVisual.dragonAmplitude
    const pearlPulse = (Math.sin((seconds * Math.PI * 2) / 3) + 1) * 0.5
    layers.pearl.object3D.position.y = Math.sin((seconds * Math.PI * 2) / 3 + 0.4) * config.mainVisual.pearlAmplitude
    layers.pearl.object3D.scale.setScalar(1 + pearlPulse * 0.05)
    setOpacity(layers.pearl, 0.82 + pearlPulse * 0.18)
    setOpacity(layers.sparks, 0.86 + Math.sin(seconds * 1.1) * 0.06)
  }

  const applyExit = () => {
    const t = easeInOutCubic(elapsed / config.overview.exitDuration)
    const opacity = 1 - t
    setGroupPose(groups.title, { y: 0.05 * t, opacity })
    setGroupPose(groups.intro, { x: -0.07 * t, opacity })
    setGroupPose(groups.map, { x: 0.07 * t, opacity })
    setGroupPose(groups.types, { x: -0.055 * t, y: -0.04 * t, opacity })
    setGroupPose(groups.timeline, { x: 0.055 * t, y: -0.04 * t, opacity })
    setGroupPose(groups.main, { y: -0.075 * t, z: -0.05 * t, scale: 1 - t * 0.03, opacity })
  }

  const applyRestore = () => {
    const t = easeOutCubic(elapsed / config.overview.restoreDuration)
    Object.values(groups).forEach((entity) => setOpacity(entity, t))
    groups.title.object3D.position.y = 0.025 * (1 - t)
    groups.intro.object3D.position.x = -0.03 * (1 - t)
    groups.map.object3D.position.x = 0.03 * (1 - t)
    groups.main.object3D.position.y = -0.035 * (1 - t)
  }

  const resetEntry = () => {
    setVisible(overviewRoot, true)
    Object.values(groups).forEach((entity) => setGroupPose(entity, { opacity: 0 }))
    Object.values(layers).forEach((entity) => setOpacity(entity, 0))
    setTimelineReveal(0.001)
  }

  setVisible(overviewRoot, false)

  return {
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
        if (elapsed >= config.overview.totalDuration) {
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
      if (mode === 'entering' && elapsed > 2000) {
        continuousElapsed += delta
        applyContinuous()
      }
    },
    pause() {},
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
    destroy() {
      mode = 'hidden'
    },
  }
}
