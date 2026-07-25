const clamp01 = (value) => Math.min(1, Math.max(0, value))

const makeRectangle = (THREE, width, depth, z, color) => {
  const points = [
    new THREE.Vector3(-width / 2, -depth / 2, z),
    new THREE.Vector3(width / 2, -depth / 2, z),
    new THREE.Vector3(width / 2, depth / 2, z),
    new THREE.Vector3(-width / 2, depth / 2, z),
    new THREE.Vector3(-width / 2, -depth / 2, z),
  ]
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, depthTest: true }),
  )
}

export function createPage2Floor({ root, config, debug = false }) {
  const THREE = window.AFRAME.THREE
  const entity = root.querySelector('#page2-floor-base')
  if (!entity) throw new Error('[page2] Missing #page2-floor-base')

  const floor = config.floorBase
  const widthAxis = new THREE.Vector3(1, 0, 0)
  const depthAxis = new THREE.Vector3(0, 1, 0)
  const upAxis = new THREE.Vector3(0, 0, 1)
  const basis = new THREE.Matrix4().makeBasis(widthAxis, depthAxis, upAxis)
  const geometry = new THREE.PlaneGeometry(floor.widthUnit, floor.depthUnit)
  geometry.applyMatrix4(basis)
  const material = new THREE.MeshBasicMaterial({
    color: floor.color,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'page2-floor-base-mesh'
  mesh.renderOrder = floor.renderOrder
  mesh.position.copy(upAxis).multiplyScalar(floor.initialClearanceUnit)
  entity.setObject3D('mesh', mesh)
  entity.object3D.visible = false
  entity.setAttribute('visible', false)
  mesh.visible = false

  const debugGroup = new THREE.Group()
  debugGroup.name = 'page2-floor-debug'
  debugGroup.visible = debug
  debugGroup.add(makeRectangle(THREE, floor.widthUnit, floor.depthUnit, 0.001, 0xff5c5c))
  debugGroup.add(makeRectangle(THREE, floor.widthUnit, floor.depthUnit, floor.clearanceUnit + 0.001, 0x52f7d4))

  const centerPoints = [
    new THREE.Vector3(-0.045, 0, floor.clearanceUnit + 0.002),
    new THREE.Vector3(0.045, 0, floor.clearanceUnit + 0.002),
    new THREE.Vector3(0, -0.045, floor.clearanceUnit + 0.002),
    new THREE.Vector3(0, 0.045, floor.clearanceUnit + 0.002),
  ]
  debugGroup.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(centerPoints),
    new THREE.LineBasicMaterial({ color: 0xffe66d, depthTest: false }),
  ))
  const normal = new THREE.ArrowHelper(upAxis, upAxis.clone().multiplyScalar(floor.clearanceUnit), 0.16, 0x61a5ff, 0.035, 0.018)
  debugGroup.add(normal)
  const hingePoints = [
    new THREE.Vector3(-floor.widthUnit / 2, floor.depthUnit / 2, floor.clearanceUnit + 0.003),
    new THREE.Vector3(floor.widthUnit / 2, floor.depthUnit / 2, floor.clearanceUnit + 0.003),
  ]
  debugGroup.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(hingePoints),
    new THREE.LineBasicMaterial({ color: 0xffc247, depthTest: false }),
  ))
  entity.object3D.add(debugGroup)

  let active = false
  let elapsed = 0
  let activeRunId = 0
  let texture = null
  let textureReady = false
  let sourceUrl = ''

  const hasFiniteTransform = () => [
    ...entity.object3D.position.toArray(),
    ...entity.object3D.rotation.toArray().slice(0, 3),
    ...entity.object3D.scale.toArray(),
  ].every(Number.isFinite)

  const isRenderable = () => Boolean(
    entity.object3D.parent &&
    mesh.parent &&
    material &&
    material.map &&
    material.map.image &&
    textureReady &&
    hasFiniteTransform(),
  )

  const bindImage = (image) => {
    if (!image?.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error(`[page2] Floor image is not decoded: ${floor.texture}`)
    }
    const expectedUrl = new URL(floor.texture, document.baseURI).href
    if (image.currentSrc !== expectedUrl && image.src !== expectedUrl) {
      throw new Error(`[page2] Floor image source mismatch: ${image.currentSrc || image.src}`)
    }
    entity.object3D.visible = false
    entity.setAttribute('visible', false)
    mesh.visible = false
    material.opacity = 0
    texture?.dispose?.()
    texture = new THREE.Texture(image)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    material.map = texture
    material.needsUpdate = true
    textureReady = true
    sourceUrl = expectedUrl
    return texture
  }

  const reset = (runId = activeRunId) => {
    activeRunId = runId
    active = false
    elapsed = 0
    entity.object3D.visible = false
    entity.setAttribute('visible', false)
    mesh.visible = false
    mesh.position.copy(upAxis).multiplyScalar(floor.initialClearanceUnit)
    material.opacity = 0
  }

  return {
    axes: { widthAxis, depthAxis, upAxis },
    bindImage,
    reset,
    start(runId) {
      reset(runId)
      if (!floor.enabled || !isRenderable()) return false
      entity.object3D.visible = true
      entity.setAttribute('visible', true)
      mesh.visible = true
      active = true
      return true
    },
    update(delta, runId) {
      if (!active || runId !== activeRunId) return
      elapsed += delta
      const progress = clamp01(elapsed / floor.fadeDuration)
      const clearance = floor.initialClearanceUnit
        + (floor.clearanceUnit - floor.initialClearanceUnit) * progress
      mesh.position.copy(upAxis).multiplyScalar(clearance)
      material.opacity = floor.opacity * progress
      if (progress >= 1) active = false
    },
    showFinal() {
      active = false
      const visible = floor.enabled && isRenderable()
      entity.object3D.visible = visible
      entity.setAttribute('visible', visible)
      mesh.visible = visible
      mesh.position.copy(upAxis).multiplyScalar(floor.clearanceUnit)
      material.opacity = visible ? floor.opacity : 0
    },
    hide() {
      active = false
      entity.object3D.visible = false
      entity.setAttribute('visible', false)
      mesh.visible = false
      material.opacity = 0
    },
    getDebugState() {
      const world = new THREE.Vector3()
      mesh.getWorldPosition(world)
      return {
        enabled: floor.enabled,
        widthUnit: floor.widthUnit,
        depthUnit: floor.depthUnit,
        clearanceMm: floor.clearanceMm,
        clearanceUnit: floor.clearanceUnit,
        opacity: material.opacity,
        imageReady: Boolean(texture?.image?.complete && texture.image.naturalWidth > 0 && texture.image.naturalHeight > 0),
        textureBound: Boolean(material.map && material.map.image),
        textureReady,
        entityMounted: Boolean(entity.object3D.parent && mesh.parent),
        entityRenderable: isRenderable(),
        sourceUrl,
        textureUuid: texture?.uuid || null,
        scale: mesh.scale.toArray(),
        rotationDegrees: [
          THREE.MathUtils.radToDeg(mesh.rotation.x),
          THREE.MathUtils.radToDeg(mesh.rotation.y),
          THREE.MathUtils.radToDeg(mesh.rotation.z),
        ],
        worldPosition: world.toArray(),
        widthAxis: widthAxis.toArray(),
        depthAxis: depthAxis.toArray(),
        upAxis: upAxis.toArray(),
      }
    },
    destroy() {
      entity.removeObject3D('mesh')
      entity.object3D.remove(debugGroup)
      geometry.dispose()
      material.dispose()
      texture?.dispose?.()
      debugGroup.traverse((object) => {
        object.geometry?.dispose?.()
        object.material?.dispose?.()
      })
    },
  }
}
