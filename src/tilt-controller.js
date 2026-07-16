const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3)

// 文件名为兼容旧工程保留；控制器只负责已选展示模式的局部展开动画。
export function createPanelRiseController({
  panelHinge,
  panelContent,
  config,
  markerAspectFallback,
  onUpdate,
  onRiseStart,
  onComplete,
}) {
  const THREE = window.AFRAME.THREE
  const sign = config.frontDirectionSign === -1 ? -1 : 1
  let modeName = null
  let mode = null
  let markerAspect = markerAspectFallback
  let rising = false
  let paused = false
  let elapsed = 0
  let previousTime = performance.now()
  let frameId = null

  const vector = (value = {}) => ({ x: value.x ?? 0, y: value.y ?? 0, z: value.z ?? 0 })
  const orientedRotation = (rotation) => ({ x: rotation.x * sign, y: rotation.y, z: rotation.z })
  const lerpVector = (from, to, progress) => ({
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    z: from.z + (to.z - from.z) * progress,
  })

  const getTransforms = () => {
    const vertical = modeName === 'vertical'
    const hinge = vector(vertical ? mode.hingePosition : mode.position)
    if (vertical) hinge.y *= markerAspect / markerAspectFallback
    const content = vector(mode.contentPosition)
    const startRotation = orientedRotation(vector(mode.startRotation ?? mode.rotation))
    const targetRotation = orientedRotation(vector(mode.endRotation ?? mode.rotation))
    const startPosition = { ...hinge }
    const targetPosition = {
      ...hinge,
      z: hinge.z + (vertical ? 0 : sign * mode.frontOffset),
    }
    const targetContentPosition = {
      ...content,
      z: content.z + (vertical ? sign * mode.frontOffset : 0),
    }
    return { startRotation, targetRotation, startPosition, targetPosition, targetContentPosition }
  }

  const apply = (progress) => {
    if (!mode) return
    const eased = easeOutCubic(progress)
    const transforms = getTransforms()
    const rotation = lerpVector(transforms.startRotation, transforms.targetRotation, eased)
    const position = lerpVector(transforms.startPosition, transforms.targetPosition, eased)
    panelHinge.object3D.position.set(position.x, position.y, position.z)
    panelHinge.object3D.rotation.set(
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z),
    )
    panelContent.object3D.position.set(
      transforms.targetContentPosition.x,
      transforms.targetContentPosition.y,
      transforms.targetContentPosition.z,
    )
    const effectiveScale = config.baseScale * mode.scale
    panelContent.object3D.scale.setScalar(effectiveScale)
    onUpdate?.({
      mode: modeName,
      progress,
      rotation,
      targetRotation: transforms.targetRotation,
      position,
      contentPosition: transforms.targetContentPosition,
      scale: effectiveScale,
      frontDirectionSign: sign,
    })
  }

  const tick = (time) => {
    const delta = Math.max(0, time - previousTime)
    previousTime = time
    if (rising && !paused && mode) {
      elapsed += delta
      const progress = Math.min(1, elapsed / mode.animationDuration)
      apply(progress)
      if (progress >= 1) {
        rising = false
        onComplete?.({ mode: modeName })
      }
    }
    frameId = requestAnimationFrame(tick)
  }

  frameId = requestAnimationFrame(tick)

  return {
    configure(nextModeName, nextMode, nextMarkerAspect = markerAspectFallback) {
      modeName = nextModeName
      mode = nextMode
      markerAspect = nextMarkerAspect || markerAspectFallback
      rising = false
      paused = false
      elapsed = 0
      apply(0)
    },
    updateMarkerAspect(nextMarkerAspect) {
      markerAspect = nextMarkerAspect || markerAspectFallback
      apply(mode && !rising && elapsed >= mode.animationDuration ? 1 : Math.min(1, elapsed / (mode?.animationDuration || 1)))
    },
    startRise() {
      if (!mode || rising) return
      elapsed = 0
      paused = false
      rising = true
      previousTime = performance.now()
      apply(0)
      onRiseStart?.({ mode: modeName })
    },
    pause() {
      paused = true
    },
    resume() {
      paused = false
      previousTime = performance.now()
    },
    reset() {
      rising = false
      paused = false
      elapsed = 0
      if (mode) apply(0)
    },
    getState: () => ({
      mode: modeName,
      rising,
      paused,
      progress: mode ? Math.min(1, elapsed / mode.animationDuration) : 0,
      frontDirectionSign: sign,
    }),
    destroy() {
      if (frameId !== null) cancelAnimationFrame(frameId)
      frameId = null
    },
  }
}
