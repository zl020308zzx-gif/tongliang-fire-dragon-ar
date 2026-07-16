export function createStableAnchorController({ target, anchor, config, onUpdate }) {
  const THREE = window.AFRAME.THREE
  const rawWorldPosition = new THREE.Vector3()
  const rawWorldQuaternion = new THREE.Quaternion()
  const targetLocalPosition = new THREE.Vector3()
  const targetLocalQuaternion = new THREE.Quaternion()
  const parentWorldQuaternion = new THREE.Quaternion()
  let targetTracked = false
  let initialized = false
  let lostAt = null
  let recoverStartedAt = null
  let positionDelta = 0
  let rotationDeltaDeg = 0
  let frameId = null
  let anchorVisible = false

  const setVisible = (visible) => {
    if (visible === anchorVisible) return
    anchorVisible = visible
    anchor.object3D.visible = visible
    anchor.setAttribute('visible', visible)
  }

  const readRawPose = () => {
    target.object3D.updateWorldMatrix(true, false)
    target.object3D.getWorldPosition(rawWorldPosition)
    target.object3D.getWorldQuaternion(rawWorldQuaternion)
    targetLocalPosition.copy(rawWorldPosition)
    const parent = anchor.object3D.parent
    if (parent) {
      parent.updateWorldMatrix(true, false)
      parent.worldToLocal(targetLocalPosition)
      parent.getWorldQuaternion(parentWorldQuaternion)
      targetLocalQuaternion.copy(parentWorldQuaternion).invert().multiply(rawWorldQuaternion)
    } else {
      targetLocalQuaternion.copy(rawWorldQuaternion)
    }
  }

  const snapshot = (now = performance.now()) => ({
    rawTargetPosition: rawWorldPosition.toArray(),
    stableAnchorPosition: anchor.object3D.position.toArray(),
    rawQuaternion: rawWorldQuaternion.toArray(),
    stableQuaternion: anchor.object3D.quaternion.toArray(),
    positionDelta,
    rotationDeltaDeg,
    positionLerp: config.positionLerp,
    rotationSlerp: config.rotationSlerp,
    targetTracked,
    lostHoldRemaining:
      targetTracked || lostAt === null ? 0 : Math.max(0, config.lostHoldDuration - (now - lostAt)),
    recovering: recoverStartedAt !== null && now - recoverStartedAt < config.recoverDuration,
    visible: anchor.object3D.visible,
  })

  const tick = (now) => {
    if (targetTracked) {
      readRawPose()
      if (!initialized) {
        anchor.object3D.position.copy(targetLocalPosition)
        anchor.object3D.quaternion.copy(targetLocalQuaternion)
        initialized = true
      } else {
        const recoveryProgress =
          recoverStartedAt === null ? 1 : Math.min(1, (now - recoverStartedAt) / config.recoverDuration)
        const recoveryFactor = 0.25 + recoveryProgress * 0.75
        positionDelta = anchor.object3D.position.distanceTo(targetLocalPosition)
        rotationDeltaDeg = THREE.MathUtils.radToDeg(anchor.object3D.quaternion.angleTo(targetLocalQuaternion))
        if (positionDelta > config.positionDeadzone) {
          anchor.object3D.position.lerp(targetLocalPosition, config.positionLerp * recoveryFactor)
        }
        if (rotationDeltaDeg > config.rotationDeadzoneDeg) {
          anchor.object3D.quaternion.slerp(targetLocalQuaternion, config.rotationSlerp * recoveryFactor)
        }
        if (recoveryProgress >= 1) recoverStartedAt = null
      }
      setVisible(true)
    } else if (lostAt !== null && now - lostAt > config.lostHoldDuration) {
      setVisible(false)
    }
    anchor.object3D.updateMatrixWorld(true)
    onUpdate?.(snapshot(now))
    frameId = requestAnimationFrame(tick)
  }

  setVisible(false)
  frameId = requestAnimationFrame(tick)

  return {
    setTracked(tracked) {
      if (tracked === targetTracked) return
      targetTracked = tracked
      if (tracked) {
        recoverStartedAt = performance.now()
        lostAt = null
        setVisible(true)
      } else {
        lostAt = performance.now()
        recoverStartedAt = null
      }
    },
    getState: snapshot,
    reset() {
      targetTracked = false
      initialized = false
      lostAt = null
      recoverStartedAt = null
      positionDelta = 0
      rotationDeltaDeg = 0
      anchor.object3D.position.set(0, 0, 0)
      anchor.object3D.quaternion.identity()
      setVisible(false)
    },
    destroy() {
      if (frameId !== null) cancelAnimationFrame(frameId)
      frameId = null
    },
  }
}
