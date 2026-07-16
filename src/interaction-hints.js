export function createInteractionHints({ root, config, canShowBambooHint, onHintVisibilityChange, renderInCanvas = false }) {
  const hints = config.interactionHints
  const holdHint = root.querySelector('.hold-interaction-hint')
  const paperHint = root.querySelector('.paper-slider-hint')
  const paintHint = root.querySelector('.paint-entry-hint')
  const paintCursor = root.querySelector('.paint-brush-cursor')
  const eyeHint = root.querySelector('.eye-interaction-hint')
  const particles = root.querySelector('.stage-particles')
  let bounds = null
  let projectUv = null
  let particleTimer = null
  let requestedState = null
  let requestedStates = null
  let showAllForDebug = false
  let holdCenter = null
  let hiddenReason = '尚未进入扎骨步骤'
  let bambooSuppressed = false
  let canvasHintVisible = false

  root.style.setProperty('--hint-gold', hints.color)
  root.style.setProperty('--hint-gold-bright', hints.brightColor)
  root.style.setProperty('--hint-dim-opacity', hints.dimOpacity)

  const isFinitePoint = (point) =>
    point && Number.isFinite(point.x) && Number.isFinite(point.y)

  const isValidBounds = (value) =>
    value &&
    [value.left, value.top, value.width, value.height].every(Number.isFinite) &&
    value.width > 0 &&
    value.height > 0

  const setCircle = (element, center, radius) => {
    if (!element || !isFinitePoint(center) || !Number.isFinite(radius) || radius <= 0) return false
    element.style.left = `${center.x - radius}px`
    element.style.top = `${center.y - radius}px`
    element.style.width = `${radius * 2}px`
    element.style.height = `${radius * 2}px`
    return true
  }

  const notifyHintVisibility = () =>
    onHintVisibilityChange?.({
      hintVisible: renderInCanvas ? canvasHintVisible : !holdHint.hidden,
      hintScreenX: holdCenter?.x ?? null,
      hintScreenY: holdCenter?.y ?? null,
      canvasScreenRect: bounds,
      hiddenReason: holdHint.hidden ? hiddenReason : '',
    })

  const updateGeometry = (nextBounds, projector) => {
    bounds = null
    projectUv = null
    holdCenter = null
    if (!isValidBounds(nextBounds)) {
      hiddenReason = nextBounds ? 'craftCanvas屏幕投影尺寸无效' : 'craftCanvas尚未挂载或无法投影'
      showOnly()
      notifyHintVisibility()
      return
    }
    if (typeof projector !== 'function') {
      hiddenReason = '龙头热点投影函数不可用'
      showOnly()
      notifyHintVisibility()
      return
    }

    bounds = nextBounds
    projectUv = projector

    holdCenter = projectUv(hints.bamboo.center)
    if (!isFinitePoint(holdCenter)) {
      hiddenReason = '龙头热点位置不是有限数字'
      bounds = null
      projectUv = null
      holdCenter = null
      showOnly()
      notifyHintVisibility()
      return
    }
    setCircle(holdHint, holdCenter, hints.bamboo.outerRadiusPx)
    holdHint.style.setProperty('--hint-inner-radius', `${hints.bamboo.innerRadiusPx}px`)
    holdHint.style.setProperty('--hint-inner-line', `${hints.bamboo.innerLineWidthPx}px`)
    holdHint.style.setProperty('--hint-outer-line', `${hints.bamboo.outerLineWidthPx}px`)
    holdHint.style.setProperty('--hint-pulse-duration', `${hints.bamboo.pulseDurationMs}ms`)

    paintHint.style.left = `${bounds.left}px`
    paintHint.style.top = `${bounds.top}px`
    paintHint.style.width = `${bounds.width}px`
    paintHint.style.height = `${bounds.height}px`
    paintHint.style.setProperty('--paint-sweep-duration', `${hints.paint.sweepDurationMs}ms`)

    const eyeCenter = projectUv(config.eyeHotspot)
    const eyeEdge = projectUv({
      x: config.eyeHotspot.x + config.eyeHotspot.radius,
      y: config.eyeHotspot.y,
    })
    if (eyeCenter && eyeEdge) {
      const radius = Math.abs(eyeEdge.x - eyeCenter.x) * hints.eye.outerScale
      setCircle(eyeHint, eyeCenter, radius)
      eyeHint.style.setProperty('--eye-inner-scale', hints.eye.innerScale / hints.eye.outerScale)
      eyeHint.style.setProperty('--eye-inner-line', `${hints.eye.innerLineWidthPx}px`)
      eyeHint.style.setProperty('--eye-outer-line', `${hints.eye.outerLineWidthPx}px`)
      eyeHint.style.setProperty('--eye-pulse-duration', `${hints.eye.pulseDurationMs}ms`)
    }
    syncStateVisibility()
  }

  const updatePaperSlider = (ratio) => {
    if (renderInCanvas) return
    if (!bounds) return
    const x = bounds.left + bounds.width * ratio
    paperHint.style.left = `${x}px`
    paperHint.style.top = `${bounds.top}px`
    paperHint.style.height = `${bounds.height}px`
    paperHint.style.setProperty('--paper-line-width', `${hints.paper.lineWidthPx}px`)
    paperHint.style.setProperty('--paper-handle-size', `${hints.paper.handleSizePx}px`)
    paperHint.style.setProperty('--paper-handle-border', `${hints.paper.handleBorderWidthPx}px`)
    paperHint.style.setProperty('--paper-pulse-duration', `${hints.paper.pulseDurationMs}ms`)
  }

  const updatePaintCursor = ({ point, active, insideMask }) => {
    if (renderInCanvas) return
    if (!point || !bounds) {
      paintCursor.hidden = true
      return
    }
    const diameter = (config.paintBrush.radius * 2 * bounds.width) / config.canvas.width
    paintCursor.hidden = false
    paintCursor.style.left = `${point.x - diameter / 2}px`
    paintCursor.style.top = `${point.y - diameter / 2}px`
    paintCursor.style.width = `${diameter}px`
    paintCursor.style.height = `${diameter}px`
    paintCursor.classList.toggle('is-active', active)
    paintCursor.classList.toggle('is-outside-mask', !insideMask)
    paintHint.classList.toggle('hint-muted', active)
  }

  const showOnly = (...elements) => {
    ;[holdHint, paperHint, paintHint, eyeHint].forEach((element) => {
      element.hidden = renderInCanvas || !elements.includes(element)
      element.classList.remove('hint-muted')
    })
    if (!elements.includes(paintHint)) paintCursor.hidden = true
  }

  const syncStateVisibility = () => {
    const state = requestedState
    const states = requestedStates
    canvasHintVisible = false
    if (!state || !states) {
      hiddenReason = '尚未进入扎骨步骤'
      showOnly()
      notifyHintVisibility()
      return
    }
    if (showAllForDebug) {
      if (!renderInCanvas) {
        ;[holdHint, paperHint, paintHint, eyeHint].forEach((element) => (element.hidden = false))
      }
      canvasHintVisible = state === states.LINEART || state === states.BAMBOO_BUILD
      hiddenReason = ''
      notifyHintVisibility()
      return
    }
    if (bambooSuppressed && (state === states.LINEART || state === states.BAMBOO_BUILD)) {
      showOnly()
      notifyHintVisibility()
      return
    }
    if (state === states.LINEART || state === states.BAMBOO_BUILD) {
      if (!isValidBounds(bounds) || !isFinitePoint(holdCenter)) {
        hiddenReason ||= 'craftCanvas投影尚未就绪'
        showOnly()
      } else {
        const gate = canShowBambooHint?.({ state, bounds, center: holdCenter }) ?? true
        const allowed = typeof gate === 'object' ? gate.allowed : Boolean(gate)
        if (allowed) {
          hiddenReason = ''
          canvasHintVisible = true
          showOnly(holdHint)
        } else {
          hiddenReason = typeof gate === 'object' && gate.reason ? gate.reason : 'AR前置条件尚未满足'
          showOnly()
        }
      }
    } else if (state === states.PAPER_COMPARE || state === states.PAPER_READY) {
      hiddenReason = '当前不是扎骨步骤'
      showOnly(paperHint)
    } else if (state === states.COLOR_PAINT) {
      hiddenReason = '当前不是扎骨步骤'
      showOnly(paintHint)
    } else if (state === states.EYE_READY) {
      hiddenReason = '当前不是扎骨步骤'
      showOnly(eyeHint)
    } else {
      hiddenReason = '当前状态禁止显示扎骨提示'
      showOnly()
    }
    notifyHintVisibility()
  }

  const showForState = (state, states, { showAll = false } = {}) => {
    bambooSuppressed = false
    requestedState = state
    requestedStates = states
    showAllForDebug = showAll
    syncStateVisibility()
  }

  const setActive = (mode, active) => {
    const element = mode === 'bamboo' ? holdHint : mode === 'paper' ? paperHint : paintHint
    element?.classList.toggle('hint-muted', active)
  }

  const burst = (type, count, durationMs) => {
    if (particleTimer !== null) clearTimeout(particleTimer)
    particles.className = `stage-particles effect-${type}`
    particles.replaceChildren()
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('i')
      particle.style.setProperty('--particle-index', index)
      particle.style.setProperty('--particle-angle', `${(360 / count) * index}deg`)
      particle.style.setProperty('--particle-duration', `${durationMs}ms`)
      particles.append(particle)
    }
    particleTimer = window.setTimeout(() => {
      particles.replaceChildren()
      particleTimer = null
    }, durationMs + 80)
  }

  return {
    updateGeometry,
    updatePaperSlider,
    updatePaintCursor,
    showForState,
    refresh: syncStateVisibility,
    hideBamboo(reason = 'AR状态禁止显示扎骨提示') {
      hiddenReason = reason
      bambooSuppressed = true
      canvasHintVisible = false
      holdHint.hidden = true
      notifyHintVisibility()
    },
    resumeBamboo() {
      bambooSuppressed = false
      syncStateVisibility()
    },
    getDebugSnapshot: () => ({
      hintVisible: renderInCanvas ? canvasHintVisible : !holdHint.hidden,
      hintScreenX: holdCenter?.x ?? null,
      hintScreenY: holdCenter?.y ?? null,
      canvasScreenRect: bounds,
      hiddenReason: holdHint.hidden ? hiddenReason : '',
    }),
    setActive,
    burst,
    hidePaintCursor: () => (paintCursor.hidden = true),
    reset() {
      if (particleTimer !== null) clearTimeout(particleTimer)
      particleTimer = null
      particles.replaceChildren()
      requestedState = null
      requestedStates = null
      showAllForDebug = false
      bambooSuppressed = false
      canvasHintVisible = false
      bounds = null
      projectUv = null
      holdCenter = null
      hiddenReason = '提示已重置'
      showOnly()
      notifyHintVisibility()
    },
  }
}
