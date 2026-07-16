export function createInteractionHints({ root, config }) {
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

  root.style.setProperty('--hint-gold', hints.color)
  root.style.setProperty('--hint-gold-bright', hints.brightColor)
  root.style.setProperty('--hint-dim-opacity', hints.dimOpacity)

  const setCircle = (element, center, radius) => {
    if (!element || !center) return
    element.style.left = `${center.x - radius}px`
    element.style.top = `${center.y - radius}px`
    element.style.width = `${radius * 2}px`
    element.style.height = `${radius * 2}px`
  }

  const updateGeometry = (nextBounds, projector) => {
    bounds = nextBounds
    projectUv = projector
    if (!bounds || !projectUv) return

    const holdCenter = projectUv(hints.bamboo.center)
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
  }

  const updatePaperSlider = (ratio) => {
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
      element.hidden = !elements.includes(element)
      element.classList.remove('hint-muted')
    })
    if (!elements.includes(paintHint)) paintCursor.hidden = true
  }

  const showForState = (state, states, { showAll = false } = {}) => {
    if (showAll) {
      ;[holdHint, paperHint, paintHint, eyeHint].forEach((element) => (element.hidden = false))
      return
    }
    if (state === states.LINEART || state === states.BAMBOO_BUILD) showOnly(holdHint)
    else if (state === states.PAPER_COMPARE || state === states.PAPER_READY) showOnly(paperHint)
    else if (state === states.COLOR_PAINT) showOnly(paintHint)
    else if (state === states.EYE_READY) showOnly(eyeHint)
    else showOnly()
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
    setActive,
    burst,
    hidePaintCursor: () => (paintCursor.hidden = true),
    reset() {
      if (particleTimer !== null) clearTimeout(particleTimer)
      particleTimer = null
      particles.replaceChildren()
      showOnly()
    },
  }
}
