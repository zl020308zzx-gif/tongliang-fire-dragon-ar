import { createAudioController } from './audio-controller.js'
import { createCraftInteraction } from './craft-interaction.js'
import { createCraftRenderer } from './craft-renderer.js'
import { createExplodedViewController } from './exploded-view-controller.js'
import { createInteractionHints } from './interaction-hints.js'
import { createParallaxController } from './parallax-controller.js'
import { createProgressManager } from './progress-manager.js'
import { createUiController } from './ui-controller.js'
import { createVideoController } from './video-controller.js'

export const PAGE1_STATES = Object.freeze({
  LINEART: 'LINEART',
  BAMBOO_BUILD: 'BAMBOO_BUILD',
  BAMBOO_COMPLETE: 'BAMBOO_COMPLETE',
  PAPER_COMPARE: 'PAPER_COMPARE',
  PAPER_READY: 'PAPER_READY',
  PAPER_COMPLETE: 'PAPER_COMPLETE',
  COLOR_PAINT: 'COLOR_PAINT',
  COLOR_COMPLETE: 'COLOR_COMPLETE',
  EYE_READY: 'EYE_READY',
  VIDEO_PLAYING: 'VIDEO_PLAYING',
  AWAKEN_REVIEW: 'AWAKEN_REVIEW',
  EXPLODE_TRANSITION: 'EXPLODE_TRANSITION',
  EXPLODE_VIEW: 'EXPLODE_VIEW',
  LAYER_FOCUS: 'LAYER_FOCUS',
  COMPLETED: 'COMPLETED',
})

export function initializePage1Controller({
  root,
  config,
  debugLayers,
  debugMode,
  shouldReset,
  arBridge = null,
  startPaused = false,
  canShowBambooHint = null,
  onHintVisibilityChange = null,
  onStateChange = null,
}) {
  const abortController = new AbortController()
  const { signal } = abortController
  const scene = root.querySelector('a-scene')
  const panelContent = root.querySelector('#panelContent') ?? scene
  const craftPanel = root.querySelector('#craft-panel-surface')
  const canvas = root.querySelector(`#${config.canvas.id}`)
  const craftPlane = root.querySelector('#craft-plane')
  const video = root.querySelector('#dragon-video')
  const videoPlane = root.querySelector('#dragon-video-plane')
  const badge = root.querySelector('#bamboo-badge')
  const explodedGroup = root.querySelector('#explodedCraftGroup')
  const explodeOutline = root.querySelector('#explode-focus-outline')
  const errorOutput = root.querySelector('.layer-error')
  const progress = createProgressManager(config.storageKey)
  const pendingTimeouts = new Set()
  const pendingFrames = new Set()
  let canvasHintAllowed = !arBridge
  const hints = createInteractionHints({
    root,
    config,
    canShowBambooHint,
    onHintVisibilityChange(snapshot) {
      canvasHintAllowed = snapshot.hintVisible
      onHintVisibilityChange?.(snapshot)
    },
    renderInCanvas: Boolean(arBridge),
  })
  let state = PAGE1_STATES.LINEART
  let previousState = null
  let interaction = null
  let exploded = null
  let parallax = null
  let videoController = null
  let resizeObserver = null
  let interactionLocked = false
  let pointerActivity = { isActive: false, mode: null }
  let hasSeenFullPaper = false
  let paperDemoPlayed = false
  let paperDemoActive = false
  let selectedLayer = null
  let explodeProgress = 0
  let parallaxState = { rotation: { x: 0, y: 0 }, normalized: { x: 0, y: 0 } }
  let videoStatus = 'idle'
  let paintStatisticsTimer = null
  let lastPaintStatisticsTime = 0
  let experienceGeneration = 0
  let trackingPaused = startPaused

  if (shouldReset) progress.clearCompletion()

  const renderer = createCraftRenderer({
    canvas,
    plane: craftPlane,
    layers: config.assets.craftLayers,
    bambooMask: config.bambooInteraction.mask,
    paperConfig: config.paperCompare,
    paintConfig: config.paintInteraction,
    paintBrush: config.paintBrush,
    colorMaskPath: config.assets.colorMask,
    errorOutput,
    paintDebug:
      debugMode === 'paint'
        ? { validCanvas: root.querySelector('.debug-valid-mask'), paintedCanvas: root.querySelector('.debug-painted-mask') }
        : null,
    canvasHints: Boolean(arBridge),
    hintConfig: { ...config.interactionHints, paintRadius: config.paintBrush.radius },
    eyeHotspot: config.eyeHotspot,
  })
  const audio = createAudioController({
    paths: {
      bamboo: config.assets.bambooBuildAudio,
      paper: config.assets.paperCoverAudio,
      paint: config.assets.paintBrushAudio,
      complete: config.assets.completeAudio,
    },
    errorOutput,
  })

  root.querySelectorAll('a-assets img').forEach((image) => {
    image.addEventListener(
      'error',
      () => {
        errorOutput.textContent = `图片加载失败：${image.getAttribute('src')}`
        errorOutput.hidden = false
      },
      { signal },
    )
  })

  const armScheduled = (record) => {
    record.startedAt = performance.now()
    record.id = window.setTimeout(() => {
      record.id = null
      pendingTimeouts.delete(record)
      if (!signal.aborted) record.callback()
    }, record.remaining)
  }

  const schedule = (callback, delay) => {
    const record = { callback, remaining: delay, startedAt: 0, id: null }
    pendingTimeouts.add(record)
    if (!trackingPaused) armScheduled(record)
    return record
  }

  const animate = (duration, update, complete) => {
    let elapsed = 0
    let previousTime = performance.now()
    let id = null
    const frame = (time) => {
      pendingFrames.delete(id)
      if (signal.aborted) return
      if (!trackingPaused) elapsed += time - previousTime
      previousTime = time
      const value = Math.min(1, elapsed / duration)
      update(value)
      if (value < 1) {
        id = requestAnimationFrame(frame)
        pendingFrames.add(id)
      } else complete?.()
    }
    id = requestAnimationFrame(frame)
    pendingFrames.add(id)
  }

  const clearScheduledWork = () => {
    pendingTimeouts.forEach((record) => {
      if (record.id !== null) clearTimeout(record.id)
    })
    pendingTimeouts.clear()
    pendingFrames.forEach(cancelAnimationFrame)
    pendingFrames.clear()
    if (paintStatisticsTimer !== null) clearTimeout(paintStatisticsTimer)
    paintStatisticsTimer = null
    paperDemoActive = false
  }

  const pauseScheduledWork = () => {
    const now = performance.now()
    pendingTimeouts.forEach((record) => {
      if (record.id === null) return
      clearTimeout(record.id)
      record.id = null
      record.remaining = Math.max(0, record.remaining - (now - record.startedAt))
    })
  }

  const resumeScheduledWork = () => {
    pendingTimeouts.forEach((record) => {
      if (record.id === null) armScheduled(record)
    })
  }

  const actions = {
    retry: () => state === PAGE1_STATES.VIDEO_PLAYING && videoController?.retry(),
    skip: () => state === PAGE1_STATES.VIDEO_PLAYING && videoController?.skip(),
    review: () => startExplodedView(),
    overview: () => restoreExplodedOverview(),
    restart: () => resetExperience(),
    end: () => {
      transition(PAGE1_STATES.COMPLETED)
      ui.showEndMessage()
    },
  }
  const ui = createUiController({
    root,
    states: PAGE1_STATES,
    signal,
    actions,
    copy: config.copy,
    stampDurationMs: config.craftStamps.lightDurationMs,
    feedbackDurationMs: config.craftStamps.feedbackDurationMs,
  })

  const meta = (extra = {}) => ({ hasSeenFullPaper, selectedLayer, ...extra })

  const syncCanvasHints = (extra = {}) => {
    renderer.updateCanvasHints({
      state,
      states: PAGE1_STATES,
      paperRatio: progress.get('paper'),
      bambooProgress: progress.get('bamboo'),
      hintAllowed: !trackingPaused && canvasHintAllowed,
      ...extra,
    })
  }

  const updateDebug = () => {
    const values = progress.getAll()
    if (debugMode === 'bamboo') {
      root.querySelector('[data-debug-state]').textContent = state
      root.querySelector('[data-debug-progress]').textContent = `${Math.round(values.bamboo * 100)}%`
      root.querySelector('[data-debug-pointer]').textContent = pointerActivity.isActive ? '是' : '否'
      root.querySelector('[data-debug-radius]').textContent = `${Math.round(config.bambooInteraction.mask.maxRadius * values.bamboo)} px`
    }
    if (debugMode === 'paper') {
      root.querySelector('[data-debug-paper-progress]').textContent = `${Math.round(values.paper * 100)}%`
      root.querySelector('[data-debug-paper-seen]').textContent = String(hasSeenFullPaper)
      root.querySelector('[data-debug-paper-boundary]').textContent = `${Math.round(config.canvas.width * values.paper)} px`
      root.querySelector('[data-debug-paper-dragging]').textContent = pointerActivity.isActive && pointerActivity.mode === 'paper' ? '是' : '否'
    }
    if (debugMode === 'paint') {
      root.querySelector('[data-debug-paint-active]').textContent = pointerActivity.isActive && pointerActivity.mode === 'paint' ? '是' : '否'
      root.querySelector('[data-debug-paint-captured]').textContent = pointerActivity.pointerCaptured ? '是' : '否'
      root.querySelector('[data-debug-paint-suspended]').textContent = pointerActivity.suspendedOutsideCanvas ? '是' : '否'
      const lastPoint = pointerActivity.lastValidPaintPoint
      root.querySelector('[data-debug-paint-last]').textContent = lastPoint ? `${Math.round(lastPoint.x)}, ${Math.round(lastPoint.y)}` : '—'
      root.querySelector('[data-debug-paint-progress]').textContent = `${Math.round(values.paint * 100)}%`
    }
    if (debugMode === 'video') {
      root.querySelector('[data-debug-video-mode]').textContent = videoStatus
      root.querySelector('[data-debug-video-craft]').textContent = craftPlane.getAttribute('visible') === false ? '隐藏' : '显示'
      root.querySelector('[data-debug-video-plane]').textContent = videoPlane.getAttribute('visible') === true ? '显示' : '隐藏'
    }
    if (debugMode === 'explode' && exploded) {
      root.querySelector('[data-debug-explode-state]').textContent = state
      root.querySelector('[data-debug-explode-selected]').textContent = selectedLayer ?? '—'
      root.querySelector('[data-debug-explode-progress]').textContent = `${Math.round(explodeProgress * 100)}%`
      root.querySelector('[data-debug-parallax]').textContent = `${parallaxState.rotation.x.toFixed(2)}, ${parallaxState.rotation.y.toFixed(2)}`
      root.querySelector('[data-debug-parallax-input]').textContent = `${parallaxState.normalized.x.toFixed(2)}, ${parallaxState.normalized.y.toFixed(2)}`
      const layerStates = exploded.getLayerState()
      root.querySelector('[data-debug-explode-panel]').textContent = `${config.explodedView.panelSurfaceZ.toFixed(3)}`
      root.querySelector('[data-debug-explode-sign]').textContent = String(config.explodedView.frontDirectionSign)
      root.querySelector('[data-debug-explode-layers]').textContent = layerStates
        .map(
          (layer) =>
            `${layer.id}: local(${layer.position.x.toFixed(3)},${layer.position.y.toFixed(3)},${layer.position.z.toFixed(3)})\n` +
            `  world(${layer.worldPosition.x.toFixed(3)},${layer.worldPosition.y.toFixed(3)},${layer.worldPosition.z.toFixed(3)}) ` +
            `signed=${layer.localSignedDistance.toFixed(3)} worldSigned=${layer.worldSignedDistance.toFixed(3)} front=${layer.isInFront}\n` +
            `  order=${layer.renderOrder} depthWrite=${layer.depthWrite} depthTest=${layer.depthTest} alphaTest=${layer.alphaTest}`,
        )
        .join('\n')
      const behind = layerStates.filter((layer) => !layer.isInFront).map((layer) => layer.id)
      const warning = root.querySelector('[data-debug-explode-warning]')
      warning.textContent = behind.length ? `警告：${behind.join(', ')} 位于背景板后方` : '全部图层位于背景板正面'
      warning.classList.toggle('debug-warning', behind.length > 0)
      root.querySelector('[data-debug-explode-click-bounds]').textContent = config.explodedView.layers
        .map((layer) => {
          const corners = [
            exploded.projectLayerUv(layer.id, { x: 0, y: 0 }),
            exploded.projectLayerUv(layer.id, { x: 1, y: 1 }),
          ]
          if (corners.some((point) => !point)) return `${layer.id}: 等待场景投影`
          const [bottomLeft, topRight] = corners
          return `${layer.id}: x ${Math.round(bottomLeft.x)}–${Math.round(topRight.x)}, y ${Math.round(topRight.y)}–${Math.round(bottomLeft.y)}`
        })
        .join('\n')
    }
    if (debugMode === 'state') {
      root.querySelector('[data-debug-current-state]').textContent = state
      root.querySelector('[data-debug-previous-state]').textContent = previousState ?? '—'
      root.querySelector('[data-debug-state-bamboo]').textContent = `${Math.round(values.bamboo * 100)}%`
      root.querySelector('[data-debug-state-paper]').textContent = `${Math.round(values.paper * 100)}%`
      root.querySelector('[data-debug-state-paint]').textContent = `${Math.round(values.paint * 100)}%`
      root.querySelector('[data-debug-video]').textContent = videoStatus
      root.querySelector('[data-debug-completed]').textContent = String(progress.isCompleted())
    }
  }

  const showExplodeUi = (visible) => {
    root.querySelector('.explode-stage-tabs').hidden = !visible
    root.querySelector('.page1-preview').classList.toggle('is-explode-view', visible)
  }

  const updateAnnotations = () => {
    const container = root.querySelector('.craft-annotations')
    const visible = state === PAGE1_STATES.LAYER_FOCUS && Boolean(selectedLayer)
    container.hidden = !visible
    if (!visible || !exploded) return
    Object.entries(config.explodedView.annotations).forEach(([layerId, annotations]) => {
      annotations.forEach((annotation) => {
        const label = root.querySelector(`[data-annotation="${annotation.id}"]`)
        if (label) label.hidden = layerId !== selectedLayer
      })
    })
    const annotations = config.explodedView.annotations[selectedLayer] ?? []
    annotations.forEach((annotation) => {
      const point = exploded.projectLayerUv(selectedLayer, annotation.uv)
      const label = root.querySelector(`[data-annotation="${annotation.id}"]`)
      if (point && label) {
        label.hidden = false
        const x = Math.min(window.innerWidth - 166, Math.max(12, point.x + (annotation.offset?.x ?? 0)))
        const y = Math.min(window.innerHeight - 96, Math.max(92, point.y + (annotation.offset?.y ?? 0)))
        label.style.left = `${x}px`
        label.style.top = `${y}px`
      }
    })
  }

  const updateProjectedUi = () => {
    if (!interaction) return
    const bounds = interaction.getProjectedBounds()
    hints.updateGeometry(bounds, (uv) => interaction.projectUv(uv))
    hints.updatePaperSlider(progress.get('paper'))
    syncCanvasHints()
    if (['bamboo', 'paper', 'paint', 'hints'].includes(debugMode)) {
      const debugBounds = root.querySelector('.hit-area-debug')
      if (debugBounds && bounds) {
        debugBounds.hidden = false
        Object.assign(debugBounds.style, {
          left: `${bounds.left}px`,
          top: `${bounds.top}px`,
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
        })
      }
    }
    if (debugMode === 'eye') {
      const center = interaction.projectUv(config.eyeHotspot)
      const edge = interaction.projectUv({ x: config.eyeHotspot.x + config.eyeHotspot.radius, y: config.eyeHotspot.y })
      if (center && edge) {
        const radius = Math.abs(edge.x - center.x)
        const target = root.querySelector('.eye-hotspot-debug')
        target.hidden = false
        Object.assign(target.style, {
          left: `${center.x - radius}px`, top: `${center.y - radius}px`, width: `${radius * 2}px`, height: `${radius * 2}px`,
        })
      }
    }
    updateAnnotations()
  }

  const transition = (nextState, extra = {}) => {
    if (state !== nextState) {
      previousState = state
      state = nextState
    }
    onStateChange?.(state, previousState)
    ui.setState(state, progress.getAll(), meta(extra))
    hints.showForState(state, PAGE1_STATES, { showAll: debugMode === 'hints' })
    syncCanvasHints()
    const inExplode = [
      PAGE1_STATES.EXPLODE_TRANSITION,
      PAGE1_STATES.EXPLODE_VIEW,
      PAGE1_STATES.LAYER_FOCUS,
      PAGE1_STATES.COMPLETED,
    ].includes(state)
    showExplodeUi(inExplode && state !== PAGE1_STATES.EXPLODE_TRANSITION)
    updateDebug()
    updateProjectedUi()
  }

  const setCraftPlaneOpacity = (opacity) => {
    craftPlane.setAttribute('material', 'opacity', opacity)
    craftPlane.object3D.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach((material) => {
        material.transparent = true
        material.opacity = opacity
        material.needsUpdate = true
      })
    })
  }

  const beginLineartStage = ({ announce = true } = {}) => {
    interactionLocked = true
    progress.set('bamboo', 0)
    renderer.renderBamboo(0, 1)
    setCraftPlaneOpacity(0)
    transition(PAGE1_STATES.LINEART)
    if (announce) ui.showFeedback(config.copy.feedback.lineart)
    animate(
      config.transitions.lineartRevealDurationMs,
      setCraftPlaneOpacity,
      () => {
        setCraftPlaneOpacity(1)
        schedule(() => {
          interactionLocked = false
          transition(PAGE1_STATES.BAMBOO_BUILD)
        }, config.transitions.lineartCompleteHoldMs)
      },
    )
  }

  const showBadge = () => {
    badge.setAttribute('visible', true)
    badge.setAttribute('scale', '0.6 0.6 0.6')
    badge.object3D.visible = true
    const mesh = badge.getObject3D('mesh')
    if (mesh?.material) mesh.material.opacity = 0
    animate(
      config.badge.animationDurationMs,
      (value) => {
        const scale = 0.6 + value * 0.4
        badge.object3D.scale.set(scale, scale, scale)
        badge.setAttribute('material', 'opacity', value)
        if (mesh?.material) {
          mesh.material.transparent = true
          mesh.material.opacity = value
          mesh.material.needsUpdate = true
        }
      },
      () => badge.setAttribute('material', 'opacity', 1),
    )
  }
  const hideBadge = () => {
    badge.setAttribute('visible', false)
    badge.setAttribute('scale', '0.6 0.6 0.6')
    badge.setAttribute('material', 'opacity', 0)
    badge.object3D.visible = false
  }

  const runPaperDemo = () => {
    if (paperDemoPlayed) return
    paperDemoPlayed = true
    paperDemoActive = true
    animate(
      config.paperCompare.demonstration.durationMs,
      (value) => {
        if (!paperDemoActive) return
        const ratio = config.paperCompare.demonstration.peakProgress * Math.sin(Math.PI * value)
        progress.setExact('paper', ratio)
        syncCanvasHints()
        renderer.renderPaper(ratio)
        hints.updatePaperSlider(ratio)
        updateDebug()
      },
      () => {
        if (!paperDemoActive) return
        paperDemoActive = false
        progress.setExact('paper', 0)
        syncCanvasHints()
        renderer.renderPaper(0)
        hints.updatePaperSlider(0)
      },
    )
  }

  const startPaperCompare = ({ demonstrate = true } = {}) => {
    interactionLocked = false
    progress.setExact('paper', 0)
    syncCanvasHints()
    renderer.renderPaper(0)
    transition(PAGE1_STATES.PAPER_COMPARE)
    if (demonstrate) runPaperDemo()
  }

  const startPaint = async () => {
    const generation = experienceGeneration
    interactionLocked = false
    await renderer.preparePaint()
    if (generation !== experienceGeneration || signal.aborted) return
    renderer.renderPaint()
    transition(PAGE1_STATES.COLOR_PAINT)
  }

  const completeBamboo = () => {
    if (state !== PAGE1_STATES.BAMBOO_BUILD || interactionLocked) return
    interactionLocked = true
    progress.set('bamboo', 1)
    transition(PAGE1_STATES.BAMBOO_COMPLETE)
    audio.play('bamboo')
    hints.burst('bamboo', config.effects.bambooParticleCount, config.effects.particleDurationMs)
    animate(config.bambooInteraction.lineartFadeDurationMs, (value) => renderer.renderBamboo(1, 1 - value))
    schedule(() => startPaperCompare(), config.transitions.bambooCompleteHoldMs)
  }

  const confirmPaper = () => {
    if (state !== PAGE1_STATES.PAPER_READY || interactionLocked || !hasSeenFullPaper) return
    interactionLocked = true
    interaction?.stop()
    paperDemoActive = false
    const start = progress.get('paper')
    animate(
      config.paperCompare.confirmDurationMs,
      (value) => {
        const next = start + (1 - start) * value
        progress.setExact('paper', next)
        syncCanvasHints()
        renderer.renderPaper(next)
        hints.updatePaperSlider(next)
        updateDebug()
      },
      () => {
        progress.setExact('paper', 1)
        renderer.drawLayer('paper')
        transition(PAGE1_STATES.PAPER_COMPLETE)
        audio.play('paper')
        hints.burst('paper', 5, config.effects.particleDurationMs)
        schedule(startPaint, config.transitions.paperCompleteHoldMs)
      },
    )
  }

  const completePaint = (startProgress) => {
    if (interactionLocked) return
    interactionLocked = true
    interaction?.stop()
    animate(
      config.paintInteraction.autoCompleteDurationMs,
      (value) => {
        const next = startProgress + (1 - startProgress) * value
        progress.set('paint', next)
        renderer.renderPaintAuto(value)
        ui.updateProgress('paint', next)
        updateDebug()
      },
      () => {
        progress.set('paint', 1)
        renderer.drawLayer('color')
        transition(PAGE1_STATES.COLOR_COMPLETE)
        audio.play('paint')
        hints.burst('paint', config.effects.paintParticleCount, config.effects.particleDurationMs)
        schedule(() => {
          interactionLocked = false
          transition(PAGE1_STATES.EYE_READY)
        }, config.transitions.colorCompleteHoldMs)
      },
    )
  }

  const calculatePaintCoverage = () => {
    paintStatisticsTimer = null
    lastPaintStatisticsTime = performance.now()
    if (state !== PAGE1_STATES.COLOR_PAINT || interactionLocked || trackingPaused) return
    const coverage = progress.set('paint', renderer.getPaintCoverage())
    ui.updateProgress('paint', coverage)
    updateDebug()
    if (coverage >= config.paintInteraction.completionThreshold) completePaint(coverage)
  }
  const requestPaintCoverage = () => {
    if (paintStatisticsTimer !== null || interactionLocked) return
    const elapsed = performance.now() - lastPaintStatisticsTime
    paintStatisticsTimer = window.setTimeout(
      calculatePaintCoverage,
      Math.max(0, config.paintInteraction.statistics.intervalMs - elapsed),
    )
  }

  const enterAwakenReview = () => {
    interactionLocked = true
    renderer.drawLayer('color')
    root.querySelector('.review-ember-glow').hidden = false
    hints.burst('ember', config.effects.emberParticleCount, config.effects.reviewGlowDurationMs)
    transition(PAGE1_STATES.AWAKEN_REVIEW)
  }

  const completeExplodeTransition = () => {
    interactionLocked = false
    explodeProgress = 1
    transition(PAGE1_STATES.EXPLODE_VIEW)
    showBadge()
    audio.play('complete', { once: true })
    progress.markCompleted()
    updateDebug()
  }

  const startExplodedView = () => {
    if (state !== PAGE1_STATES.AWAKEN_REVIEW) return
    interactionLocked = true
    root.querySelector('.review-ember-glow').hidden = true
    hideBadge()
    explodeProgress = 0
    transition(PAGE1_STATES.EXPLODE_TRANSITION)
    exploded.expand(completeExplodeTransition)
  }

  const focusLayer = (layerId) => {
    if (![PAGE1_STATES.EXPLODE_VIEW, PAGE1_STATES.LAYER_FOCUS].includes(state) || interactionLocked) return
    if (state === PAGE1_STATES.LAYER_FOCUS && selectedLayer === layerId) {
      restoreExplodedOverview()
      return
    }
    selectedLayer = layerId
    exploded.focus(layerId)
    transition(PAGE1_STATES.LAYER_FOCUS)
    root.querySelectorAll('[data-explode-tag]').forEach((button) => button.classList.toggle('is-active', button.dataset.explodeTag === layerId))
    updateAnnotations()
  }

  const restoreExplodedOverview = () => {
    if (![PAGE1_STATES.EXPLODE_VIEW, PAGE1_STATES.LAYER_FOCUS, PAGE1_STATES.COMPLETED].includes(state)) return
    selectedLayer = null
    exploded.restoreOverview()
    transition(PAGE1_STATES.EXPLODE_VIEW)
    root.querySelectorAll('[data-explode-tag]').forEach((button) => button.classList.remove('is-active'))
    updateAnnotations()
  }

  const resetExperience = () => {
    experienceGeneration += 1
    clearScheduledWork()
    interaction?.reset()
    audio.reset()
    videoController?.stop()
    renderer.resetPaint()
    exploded?.reset()
    parallax?.reset()
    hints.reset()
    progress.reset()
    progress.clearCompletion()
    hideBadge()
    hasSeenFullPaper = false
    paperDemoPlayed = false
    selectedLayer = null
    explodeProgress = 0
    interactionLocked = false
    pointerActivity = { isActive: false, mode: null }
    root.querySelector('.review-ember-glow').hidden = true
    root.querySelector('.craft-annotations').hidden = true
    showExplodeUi(false)
    renderer.renderBamboo(0, 1)
    errorOutput.hidden = true
    arBridge?.restartOpening?.()
    trackingPaused = Boolean(arBridge)
    transition(PAGE1_STATES.LINEART, { resetStamps: true })
    if (!arBridge && !debugMode) beginLineartStage()
    hints.hideBamboo('页面已重置，等待重新开始交互')
    syncCanvasHints({ hintAllowed: false })
  }

  const setupSceneControllers = () => {
    if (signal.aborted || interaction) return
    interaction = createCraftInteraction({
      scene,
      plane: craftPlane,
      canvasDimensions: config.canvas,
      holdDurationMs: config.bambooInteraction.holdDurationMs,
      states: PAGE1_STATES,
      eyeHotspot: config.eyeHotspot,
      signal,
      getState: () => state,
      isLocked: () => interactionLocked || trackingPaused,
      getBambooProgress: () => progress.get('bamboo'),
      onBambooStart() {
        if (state === PAGE1_STATES.LINEART) transition(PAGE1_STATES.BAMBOO_BUILD)
      },
      onBambooProgress(value) {
        const next = progress.set('bamboo', value)
        syncCanvasHints()
        renderer.renderBamboo(next, 1)
        ui.updateProgress('bamboo', next)
        updateDebug()
      },
      onBambooComplete: completeBamboo,
      onPaperProgress(value) {
        if (![PAGE1_STATES.PAPER_COMPARE, PAGE1_STATES.PAPER_READY].includes(state) || interactionLocked) return true
        paperDemoActive = false
        const next = progress.setExact('paper', value)
        syncCanvasHints()
        renderer.renderPaper(next)
        hints.updatePaperSlider(next)
        if (!hasSeenFullPaper && next >= config.paperCompare.completeThreshold) {
          hasSeenFullPaper = true
          transition(PAGE1_STATES.PAPER_READY)
          schedule(confirmPaper, 80)
        } else {
          ui.setState(state, progress.getAll(), meta())
          updateDebug()
        }
        return false
      },
      onPaintStroke(from, to) {
        if (state !== PAGE1_STATES.COLOR_PAINT || interactionLocked) return
        renderer.paintStroke(from, to)
        requestPaintCoverage()
      },
      onPointerInfo(info) {
        const insideMask = info.inside ? renderer.isPointInColorMask(info.canvasPoint) : false
        if (debugMode === 'paper') root.querySelector('[data-debug-uv]').textContent = info.inside ? `${info.uv.x.toFixed(3)}, ${info.uv.y.toFixed(3)}` : '—'
        if (debugMode === 'paint') {
          root.querySelector('[data-debug-brush-position]').textContent = info.inside ? `${Math.round(info.canvasPoint.x)}, ${Math.round(info.canvasPoint.y)}` : '—'
          root.querySelector('[data-debug-paint-inside]').textContent = info.inside ? '是' : '否'
          root.querySelector('[data-debug-paint-mask]').textContent = insideMask ? '是' : '否'
        }
        if (state === PAGE1_STATES.COLOR_PAINT || debugMode === 'paint') {
          hints.updatePaintCursor({
            point: info.inside ? info.clientPoint : null,
            active: pointerActivity.isActive && pointerActivity.mode === 'paint',
            insideMask,
          })
          syncCanvasHints({
            paintPoint: info.inside ? info.canvasPoint : null,
            paintActive: pointerActivity.isActive && pointerActivity.mode === 'paint',
            paintInsideMask: insideMask,
          })
        }
        if (debugMode === 'eye' && info.eventType === 'down') root.querySelector('[data-debug-eye-uv]').textContent = info.inside ? `${info.uv.x.toFixed(3)}, ${info.uv.y.toFixed(3)}` : '未命中平面'
      },
      onActivityChange(activity) {
        pointerActivity = activity
        hints.setActive(activity.mode, activity.isActive)
        if (activity.mode === 'paper' && activity.isActive) paperDemoActive = false
        if (!activity.isActive && activity.mode === 'paint') hints.hidePaintCursor()
        syncCanvasHints({
          paintActive: activity.isActive && activity.mode === 'paint',
          ...(activity.isActive ? {} : { paintPoint: null }),
        })
        updateDebug()
      },
      onEyeClick(info) {
        if (debugMode === 'eye') {
          root.querySelector('[data-debug-eye-uv]').textContent = `${info.uv.x.toFixed(3)}, ${info.uv.y.toFixed(3)}`
          root.querySelector('[data-debug-eye-hit]').textContent = info.hit ? '是' : '否'
          console.info(`[page1 eye] UV=(${info.uv.x.toFixed(4)}, ${info.uv.y.toFixed(4)}) hit=${info.hit}`)
        }
        if (!info.hit || state !== PAGE1_STATES.EYE_READY || interactionLocked) return
        interactionLocked = true
        transition(PAGE1_STATES.VIDEO_PLAYING)
        audio.stopAll()
        videoController.play()
      },
    })

    exploded = createExplodedViewController({
      scene,
      group: explodedGroup,
      panelContent,
      panel: craftPanel,
      craftPlane,
      outline: explodeOutline,
      config: config.explodedView,
      signal,
      isInteractive: () =>
        !trackingPaused && [PAGE1_STATES.EXPLODE_VIEW, PAGE1_STATES.LAYER_FOCUS].includes(state),
      onLayerClick: focusLayer,
      onAnimationProgress(value) {
        explodeProgress = value
        updateDebug()
      },
      onChanged() {
        updateDebug()
        updateAnnotations()
      },
    })

    parallax = createParallaxController({
      scene,
      group: explodedGroup,
      config: config.explodedView.parallax,
      signal,
      isEnabled: () =>
        !trackingPaused && [PAGE1_STATES.EXPLODE_VIEW, PAGE1_STATES.LAYER_FOCUS].includes(state),
      onUpdate(value) {
        parallaxState = value
        if (debugMode === 'explode') updateDebug()
        if (selectedLayer) updateAnnotations()
      },
      onFirstMove: () => {},
    })

    root.querySelectorAll('[data-explode-tag]').forEach((button) =>
      button.addEventListener('click', () => focusLayer(button.dataset.explodeTag), { signal }),
    )
    window.addEventListener('resize', updateProjectedUi, { signal })
    scene.addEventListener('renderstart', updateProjectedUi, { once: true, signal })
    if (window.ResizeObserver && scene.canvas) {
      resizeObserver = new ResizeObserver(updateProjectedUi)
      resizeObserver.observe(scene.canvas)
    }
    schedule(updateProjectedUi, 250)

    if (debugMode === 'paper') startPaperCompare({ demonstrate: false })
    else if (debugMode === 'paint') startPaint()
    else if (debugMode === 'eye' || debugMode === 'video') {
      renderer.drawLayer('color')
      transition(PAGE1_STATES.EYE_READY)
    } else if (debugMode === 'explode') {
      renderer.drawLayer('color')
      transition(PAGE1_STATES.AWAKEN_REVIEW)
      startExplodedView()
    } else transition(PAGE1_STATES.LINEART)
  }

  videoController = createVideoController({
    video,
    videoPlane,
    craftPlane,
    path: config.assets.awakenVideo,
    maxDurationMs: config.video.maxDurationMs,
    signal,
    errorOutput,
    onEnded: enterAwakenReview,
    onFailed: () => ui.showVideoFailure(),
    onStatusChange(status) {
      videoStatus = status
      updateDebug()
    },
  })

  if (debugLayers) {
    root.querySelectorAll('[data-layer]').forEach((button) =>
      button.addEventListener(
        'click',
        async () => {
          if (!(await renderer.drawLayer(button.dataset.layer))) return
          root.querySelectorAll('[data-layer]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)))
        },
        { signal },
      ),
    )
  }

  ui.setState(state, progress.getAll(), meta({ resetStamps: true }))
  renderer.renderBamboo(0, 1)
  if (!arBridge && !debugMode) beginLineartStage()
  if (scene.hasLoaded) setupSceneControllers()
  else scene.addEventListener('loaded', setupSceneControllers, { once: true, signal })

  const getSnapshot = () => ({
    currentState: state,
    progress: progress.getAll(),
    paperSliderPosition: progress.get('paper'),
    hasSeenFullPaper,
    videoStatus,
    videoCurrentTime: videoController?.getCurrentTime?.() ?? 0,
    videoPausedByTracking: videoController?.wasPausedByTracking?.() ?? false,
    explodeViewState: explodeProgress,
    selectedLayer,
    canvasPreserved: canvas.width > 0 && canvas.height > 0,
  })

  if (arBridge) {
    Object.assign(arBridge, {
      startCraft(restoredState = PAGE1_STATES.LINEART) {
        trackingPaused = false
        resumeScheduledWork()
        interactionLocked = false
        if ([PAGE1_STATES.PAPER_COMPARE, PAGE1_STATES.PAPER_READY, PAGE1_STATES.PAPER_COMPLETE].includes(restoredState)) {
          progress.set('bamboo', 1)
          renderer.drawLayer('bamboo')
          startPaperCompare({ demonstrate: false })
        } else if ([PAGE1_STATES.COLOR_PAINT, PAGE1_STATES.COLOR_COMPLETE].includes(restoredState)) {
          progress.set('bamboo', 1)
          progress.setExact('paper', 1)
          renderer.drawLayer('paper')
          startPaint()
        } else if (
          [
            PAGE1_STATES.EYE_READY,
            PAGE1_STATES.VIDEO_PLAYING,
            PAGE1_STATES.AWAKEN_REVIEW,
            PAGE1_STATES.EXPLODE_TRANSITION,
            PAGE1_STATES.EXPLODE_VIEW,
            PAGE1_STATES.LAYER_FOCUS,
            PAGE1_STATES.COMPLETED,
          ].includes(restoredState)
        ) {
          progress.set('bamboo', 1)
          progress.setExact('paper', 1)
          progress.set('paint', 1)
          renderer.drawLayer('color')
          transition(
            [PAGE1_STATES.EXPLODE_TRANSITION, PAGE1_STATES.EXPLODE_VIEW, PAGE1_STATES.LAYER_FOCUS, PAGE1_STATES.COMPLETED].includes(restoredState)
              ? PAGE1_STATES.AWAKEN_REVIEW
              : PAGE1_STATES.EYE_READY,
          )
        } else {
          beginLineartStage()
        }
      },
      pauseTracking() {
        if (trackingPaused) return getSnapshot()
        trackingPaused = true
        pauseScheduledWork()
        if (paintStatisticsTimer !== null) clearTimeout(paintStatisticsTimer)
        paintStatisticsTimer = null
        interaction?.stop()
        hints.hideBamboo('targetLost或追踪暂停')
        syncCanvasHints({ hintAllowed: false, paintPoint: null, paintActive: false })
        audio.stopAll()
        videoController?.pauseForTracking?.()
        updateDebug()
        return getSnapshot()
      },
      resumeTracking() {
        if (!trackingPaused) return getSnapshot()
        trackingPaused = false
        resumeScheduledWork()
        hints.resumeBamboo()
        syncCanvasHints()
        updateDebug()
        return getSnapshot()
      },
      continueVideo() {
        return videoController?.resumeAfterTracking?.() ?? false
      },
      stopCurrentGesture() {
        interaction?.stop()
      },
      refreshHints() {
        updateProjectedUi()
        hints.refresh()
        return hints.getDebugSnapshot()
      },
      refreshProjectedUi: updateProjectedUi,
      hideHints(reason) {
        hints.hideBamboo(reason)
        return hints.getDebugSnapshot()
      },
      getHintSnapshot: () => hints.getDebugSnapshot(),
      getSnapshot,
      resetExperience,
    })
  }

  const cleanup = () => {
    experienceGeneration += 1
    clearScheduledWork()
    abortController.abort()
    interaction?.stop()
    exploded?.destroy()
    parallax?.destroy()
    hints.reset()
    audio.stopAll()
    videoController?.stop()
    renderer.destroy()
    resizeObserver?.disconnect()
  }
  return cleanup
}
