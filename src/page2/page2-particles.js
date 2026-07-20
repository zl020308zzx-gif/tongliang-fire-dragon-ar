const createSparkTexture = (THREE) => {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 15)
  gradient.addColorStop(0, 'rgba(255,247,186,1)')
  gradient.addColorStop(0.24, 'rgba(255,183,58,0.95)')
  gradient.addColorStop(0.62, 'rgba(220,54,19,0.55)')
  gradient.addColorStop(1, 'rgba(120,15,4,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 32, 32)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

const randomBetween = (min, max) => min + Math.random() * (max - min)

export function createPage2Particles({ root, config }) {
  const THREE = window.AFRAME.THREE
  const host = root.querySelector('#page2-particle-root')
  const sparkTexture = createSparkTexture(THREE)
  const isLowPower = (navigator.hardwareConcurrency || 4) <= 4
  const total = isLowPower ? config.particles.low : config.particles.normal
  const sizeScale = config.particles.sizeScale || 1
  const definitions = [
    { id: 'far', ratio: 1 - config.particles.foregroundRatio - config.particles.middleRatio, size: 0.012 * sizeScale, opacity: 0.46, depth: [-0.2, -0.06], speed: [0.035, 0.075] },
    { id: 'middle', ratio: config.particles.middleRatio, size: 0.018 * sizeScale, opacity: 0.82, depth: [-0.07, 0.14], speed: [0.065, 0.14] },
    { id: 'front', ratio: config.particles.foregroundRatio, size: 0.026 * sizeScale, opacity: 0.96, depth: [0.12, 0.3], speed: [0.09, 0.19] },
  ]
  const layers = definitions.map((definition, index) => {
    const count = Math.max(4, Math.round(total * definition.ratio))
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const geometry = new THREE.BufferGeometry()
    const material = new THREE.PointsMaterial({
      map: sparkTexture,
      color: index === 0 ? 0xd43818 : index === 1 ? 0xff6427 : 0xffb13e,
      size: definition.size,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    host.object3D.add(points)

    const resetParticle = (particleIndex, initial = false) => {
      const offset = particleIndex * 3
      const angle = randomBetween(0, Math.PI * 2)
      const radius = randomBetween(0.06, 0.52)
      positions[offset] = Math.cos(angle) * radius
      positions[offset + 1] = randomBetween(definition.depth[0], definition.depth[1])
      positions[offset + 2] = randomBetween(-0.38, 0.12) - (initial ? Math.random() * 0.18 : 0)
      const speed = randomBetween(definition.speed[0], definition.speed[1])
      velocities[offset] = Math.cos(angle) * speed * 0.42
      velocities[offset + 1] = randomBetween(-0.025, 0.035)
      velocities[offset + 2] = speed
      seeds[particleIndex] = Math.random() * Math.PI * 2
    }
    for (let particleIndex = 0; particleIndex < count; particleIndex += 1) resetParticle(particleIndex, true)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { ...definition, count, geometry, material, points, positions, velocities, seeds, resetParticle }
  })
  let active = false
  let elapsed = 0
  let intensity = 0
  let targetIntensity = 0
  let settling = false

  host.object3D.visible = false

  return {
    startBurst() {
      elapsed = 0
      active = true
      settling = false
      intensity = 0
      targetIntensity = 1
      host.object3D.visible = true
      layers.forEach((layer) => {
        for (let index = 0; index < layer.count; index += 1) layer.resetParticle(index, true)
      })
    },
    settle() {
      settling = true
      targetIntensity = 0.16
    },
    smallBurst() {
      active = true
      settling = true
      intensity = Math.max(intensity, 0.42)
      targetIntensity = 0.12
      host.object3D.visible = true
    },
    hide() {
      active = false
      intensity = 0
      targetIntensity = 0
      host.object3D.visible = false
      layers.forEach((layer) => { layer.material.opacity = 0 })
    },
    update(delta) {
      if (!active) return
      const seconds = Math.min(0.05, delta / 1000)
      elapsed += delta
      const approach = Math.min(1, seconds * (settling ? 1.5 : 3.5))
      intensity += (targetIntensity - intensity) * approach
      if (!settling && elapsed > config.model.entranceDuration * config.particles.modelPeakTime) targetIntensity = 0.72
      layers.forEach((layer, layerIndex) => {
        for (let index = 0; index < layer.count; index += 1) {
          const offset = index * 3
          layer.positions[offset] += layer.velocities[offset] * seconds
          layer.positions[offset + 1] += layer.velocities[offset + 1] * seconds
          layer.positions[offset + 2] += layer.velocities[offset + 2] * seconds
          layer.positions[offset] += Math.sin(elapsed * 0.002 + layer.seeds[index]) * seconds * 0.006
          if (layer.positions[offset + 2] > 0.68 || Math.abs(layer.positions[offset]) > 0.78) {
            layer.resetParticle(index)
          }
        }
        layer.geometry.attributes.position.needsUpdate = true
        layer.material.opacity = Math.max(0, Math.min(1, intensity * layer.opacity))
        layer.points.rotation.z = Math.sin(elapsed * 0.00012 + layerIndex) * 0.025
      })
    },
    destroy() {
      layers.forEach((layer) => {
        host.object3D.remove(layer.points)
        layer.geometry.dispose()
        layer.material.dispose()
      })
      sparkTexture.dispose()
    },
  }
}
