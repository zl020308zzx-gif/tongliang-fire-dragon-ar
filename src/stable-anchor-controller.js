const MIN_SCALE_MAGNITUDE = 1e-6

const hasFiniteComponents = (value, components) =>
  components.every((component) => Number.isFinite(value?.[component]))

export function isFiniteScale(scale) {
  return (
    hasFiniteComponents(scale, ['x', 'y', 'z']) &&
    Math.abs(scale.x) > MIN_SCALE_MAGNITUDE &&
    Math.abs(scale.y) > MIN_SCALE_MAGNITUDE &&
    Math.abs(scale.z) > MIN_SCALE_MAGNITUDE
  )
}

export function createStableAnchorController({
  target,
  anchor,
  config,
  onUpdate,
  onFirstValidTransform,
  externalTick = false,
}) {
  const THREE = window.AFRAME.THREE
  const targetRelativeMatrix = new THREE.Matrix4()
  const parentInverseMatrix = new THREE.Matrix4()
  const rawPosition = new THREE.Vector3()
  const rawQuaternion = new THREE.Quaternion()
  const rawScale = new THREE.Vector3()
  const parentWorldScale = new THREE.Vector3(1, 1, 1)
  let targetTracked = false
  let initialized = false
  let firstValidFullTransformReceived = false
  let rawPoseValid = false
  let rawScaleValid = false
  let lostAt = null
  let recoverStartedAt = null
  let positionDelta = 0
  let rotationDeltaDeg = 0
  let scaleDelta = 0
  let frameId = null
  let anchorVisible = false

  const setVisible = (visible) => {
    if (visible === anchorVisible && anchor.object3D.visible === visible) return
    anchorVisible = visible
    anchor.object3D.visible = visible
    anchor.setAttribute('visible', visible)
  }

  const readRawTransform = () => {
    const parent = anchor.object3D.parent
    target.object3D.updateWorldMatrix(true, false)
    parent?.updateWorldMatrix(true, false)

    if (parent) {
      parentInverseMatrix.copy(parent.matrixWorld).invert()
      targetRelativeMatrix.multiplyMatrices(parentInverseMatrix, target.object3D.matrixWorld)
      parent.getWorldScale(parentWorldScale)
    } else {
      targetRelativeMatrix.copy(target.object3D.matrixWorld)
      parentWorldScale.set(1, 1, 1)
    }

    targetRelativeMatrix.decompose(rawPosition, rawQuaternion, rawScale)
    rawPoseValid =
      hasFiniteComponents(rawPosition, ['x', 'y', 'z']) &&
      hasFiniteComponents(rawQuaternion, ['x', 'y', 'z', 'w']) &&
      rawQuaternion.lengthSq() > Number.EPSILON
    rawScaleValid = isFiniteScale(rawScale)
    return rawPoseValid && rawScaleValid
  }

  const snapshot = (now = performance.now()) => {
    const parent = anchor.object3D.parent
    return {
      rawTargetPosition: rawPosition.toArray(),
      stableAnchorPosition: anchor.object3D.position.toArray(),
      rawQuaternion: rawQuaternion.toArray(),
      stableQuaternion: anchor.object3D.quaternion.toArray(),
      rawTargetScale: rawScale.toArray(),
      stableAnchorScale: anchor.object3D.scale.toArray(),
      stableAnchorParentScale: parentWorldScale.toArray(),
      positionDelta,
      rotationDeltaDeg,
      scaleDelta,
      positionLerp: config.positionLerp,
      rotationSlerp: config.rotationSlerp,
      scaleLerp: config.scaleLerp,
      targetTracked,
      rawPoseValid,
      rawScaleValid,
      firstValidFullTransformReceived,
      stableAnchorExists: Boolean(anchor?.object3D),
      stableAnchorVisible: Boolean(anchor.object3D.visible),
      stableAnchorParent: parent?.el?.id || parent?.el?.tagName?.toLowerCase() || parent?.type || '—',
      lostHoldRemaining:
        targetTracked || lostAt === null ? 0 : Math.max(0, config.lostHoldDuration - (now - lostAt)),
      recovering: recoverStartedAt !== null && now - recoverStartedAt < config.recoverDuration,
      visible: anchor.object3D.visible,
    }
  }

  const tick = (now) => {
    if (targetTracked) {
      const fullTransformValid = readRawTransform()
      if (fullTransformValid && !initialized) {
        anchor.object3D.position.copy(rawPosition)
        anchor.object3D.quaternion.copy(rawQuaternion)
        anchor.object3D.scale.copy(rawScale)
        initialized = true
        firstValidFullTransformReceived = true
        setVisible(true)
        onFirstValidTransform?.(snapshot(now))
      } else if (initialized) {
        const recoveryProgress =
          recoverStartedAt === null ? 1 : Math.min(1, (now - recoverStartedAt) / config.recoverDuration)
        const recoveryFactor = 0.25 + recoveryProgress * 0.75

        if (rawPoseValid) {
          positionDelta = anchor.object3D.position.distanceTo(rawPosition)
          rotationDeltaDeg = THREE.MathUtils.radToDeg(anchor.object3D.quaternion.angleTo(rawQuaternion))
          if (positionDelta > config.positionDeadzone) {
            anchor.object3D.position.lerp(rawPosition, config.positionLerp * recoveryFactor)
          }
          if (rotationDeltaDeg > config.rotationDeadzoneDeg) {
            anchor.object3D.quaternion.slerp(rawQuaternion, config.rotationSlerp * recoveryFactor)
          }
        }

        if (rawScaleValid) {
          scaleDelta = anchor.object3D.scale.distanceTo(rawScale)
          if (scaleDelta > config.scaleDeadzone) {
            anchor.object3D.scale.lerp(rawScale, config.scaleLerp * recoveryFactor)
          }
        }

        if (recoveryProgress >= 1) recoverStartedAt = null
        setVisible(true)
      }
    } else if (lostAt !== null && now - lostAt > config.lostHoldDuration) {
      setVisible(false)
    }

    anchor.object3D.updateMatrixWorld(true)
    onUpdate?.(snapshot(now))
    if (!externalTick) frameId = requestAnimationFrame(tick)
  }

  setVisible(false)
  if (!externalTick) frameId = requestAnimationFrame(tick)

  return {
    setTracked(tracked) {
      if (tracked === targetTracked) return
      targetTracked = tracked
      if (tracked) {
        recoverStartedAt = performance.now()
        lostAt = null
        if (initialized) setVisible(true)
      } else {
        lostAt = performance.now()
        recoverStartedAt = null
      }
    },
    hasValidFullTransform: () => firstValidFullTransformReceived,
    getState: snapshot,
    update(now = performance.now()) {
      if (externalTick) tick(now)
    },
    reset() {
      targetTracked = false
      initialized = false
      firstValidFullTransformReceived = false
      rawPoseValid = false
      rawScaleValid = false
      lostAt = null
      recoverStartedAt = null
      positionDelta = 0
      rotationDeltaDeg = 0
      scaleDelta = 0
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
