const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3)

// 文件名为兼容旧工程保留；控制器只负责面板升起动画，不再读取设备方向或进行角度判定。
export function createPanelRiseController({ panelHinge, config, onUpdate, onRiseStart, onComplete }) {
  const THREE = window.AFRAME.THREE
  const sign = config.frontDirectionSign === -1 ? -1 : 1
  let rising = false
  let paused = false
  let elapsed = 0
  let previousTime = performance.now()
  let frameId = null

  const orientedRotation = (rotation) => ({
    x: rotation.x * sign,
    y: rotation.y,
    z: rotation.z,
  })

  const startRotation = orientedRotation(config.startRotation)
  const endRotation = orientedRotation(config.endRotation)

  const setRotation = (rotation) => {
    panelHinge.object3D.rotation.set(
      THREE.MathUtils.degToRad(rotation.x),
      THREE.MathUtils.degToRad(rotation.y),
      THREE.MathUtils.degToRad(rotation.z),
    )
  }

  const emitUpdate = (progress, rotation) =>
    onUpdate?.({ progress, rotation, targetRotation: endRotation, frontDirectionSign: sign })

  const tick = (time) => {
    const delta = Math.max(0, time - previousTime)
    previousTime = time
    if (rising && !paused) {
      elapsed += delta
      const linear = Math.min(1, elapsed / config.animationDuration)
      const eased = easeOutCubic(linear)
      const rotation = {
        x: startRotation.x + (endRotation.x - startRotation.x) * eased,
        y: startRotation.y + (endRotation.y - startRotation.y) * eased,
        z: startRotation.z + (endRotation.z - startRotation.z) * eased,
      }
      setRotation(rotation)
      emitUpdate(linear, rotation)
      if (linear >= 1) {
        rising = false
        onComplete?.()
      }
    }
    frameId = requestAnimationFrame(tick)
  }

  setRotation(startRotation)
  emitUpdate(0, startRotation)
  frameId = requestAnimationFrame(tick)

  return {
    startRise() {
      if (rising) return
      elapsed = 0
      paused = false
      rising = true
      previousTime = performance.now()
      setRotation(startRotation)
      emitUpdate(0, startRotation)
      onRiseStart?.()
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
      setRotation(startRotation)
      emitUpdate(0, startRotation)
    },
    getState: () => ({
      rising,
      paused,
      progress: Math.min(1, elapsed / config.animationDuration),
      targetRotation: endRotation,
      frontDirectionSign: sign,
    }),
    destroy() {
      if (frameId !== null) cancelAnimationFrame(frameId)
      frameId = null
    },
  }
}
