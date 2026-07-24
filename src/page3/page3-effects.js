const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const randomBetween = (min, max) => min + Math.random() * (max - min)

const createSparkTexture = (THREE) => {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 15)
  gradient.addColorStop(0, 'rgba(255,248,195,1)')
  gradient.addColorStop(0.22, 'rgba(255,193,72,.98)')
  gradient.addColorStop(0.58, 'rgba(235,91,21,.65)')
  gradient.addColorStop(1, 'rgba(160,31,7,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 32, 32)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

export function createPage3Effects({ root, config }) {
  const THREE = window.AFRAME.THREE
  const host = root.querySelector('#page3-effect-root')
  const lowPower = (navigator.hardwareConcurrency || 4) <= 4
  const count = lowPower ? config.particles.low : config.particles.normal
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const lifetimes = new Float32Array(count)
  const ages = new Float32Array(count)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const texture = createSparkTexture(THREE)
  const material = new THREE.PointsMaterial({
    map: texture,
    color: 0xffb33c,
    size: config.particles.size,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geometry, material)
  points.renderOrder = config.renderOrder.effects
  points.frustumCulled = false
  host.object3D.add(points)

  const ripples = []
  let continuous = false
  let continuousAccumulator = 0
  let activeParticleCount = 0

  const hideParticle = (index) => {
    const offset = index * 3
    positions[offset] = 99
    positions[offset + 1] = 99
    positions[offset + 2] = 99
    ages[index] = 0
    lifetimes[index] = 0
  }
  for (let index = 0; index < count; index += 1) hideParticle(index)

  const spawnParticle = (index, origin = { x: 0, y: -0.02, z: 0 }) => {
    const offset = index * 3
    positions[offset] = origin.x + randomBetween(-0.28, 0.28)
    positions[offset + 1] = origin.y + randomBetween(-0.12, 0.12)
    positions[offset + 2] = origin.z + randomBetween(-0.015, 0.045)
    velocities[offset] = randomBetween(-0.09, 0.09)
    velocities[offset + 1] = randomBetween(0.12, 0.31)
    velocities[offset + 2] = randomBetween(-0.01, 0.04)
    ages[index] = 0
    lifetimes[index] = randomBetween(700, 1500)
  }

  const burst = (amount = 18, origin) => {
    const spawnCount = Math.min(count, Math.max(1, amount))
    for (let index = 0; index < spawnCount; index += 1) spawnParticle(index, origin)
    activeParticleCount = Math.max(activeParticleCount, spawnCount)
    material.opacity = 0.94
    host.object3D.visible = true
  }

  const addRipple = ({ x, y, z }, delayMs = 0, strong = false) => {
    const geometry = new THREE.RingGeometry(0.035, 0.045, 48)
    const material = new THREE.MeshBasicMaterial({
      color: strong ? 0xffd677 : 0xf2aa3b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, y, z)
    mesh.renderOrder = config.renderOrder.effects + 1
    host.object3D.add(mesh)
    ripples.push({ mesh, geometry, material, elapsed: -delayMs, strong })
    host.object3D.visible = true
  }

  const update = (delta) => {
    const seconds = Math.min(0.05, delta / 1000)
    if (continuous) {
      continuousAccumulator += seconds * config.particles.continuousRatePerSecond
      while (continuousAccumulator >= 1) {
        const index = Math.floor(Math.random() * count)
        spawnParticle(index)
        activeParticleCount = Math.max(activeParticleCount, index + 1)
        continuousAccumulator -= 1
      }
    }
    let alive = 0
    for (let index = 0; index < activeParticleCount; index += 1) {
      if (lifetimes[index] <= 0) continue
      ages[index] += delta
      if (ages[index] >= lifetimes[index]) {
        hideParticle(index)
        continue
      }
      alive += 1
      const offset = index * 3
      positions[offset] += velocities[offset] * seconds
      positions[offset + 1] += velocities[offset + 1] * seconds
      positions[offset + 2] += velocities[offset + 2] * seconds
      velocities[offset + 1] -= 0.08 * seconds
    }
    geometry.attributes.position.needsUpdate = true
    material.opacity = alive ? 0.9 : 0

    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      const ripple = ripples[index]
      ripple.elapsed += delta
      if (ripple.elapsed < 0) continue
      const progress = clamp(ripple.elapsed / config.durations.rippleMs)
      const scale = config.drum.rippleStartScale
        + (config.drum.rippleEndScale - config.drum.rippleStartScale) * progress
      ripple.mesh.scale.setScalar(scale * (ripple.strong ? 1.25 : 1))
      ripple.material.opacity = (1 - progress) * (ripple.strong ? 0.9 : 0.75)
      if (progress >= 1) {
        host.object3D.remove(ripple.mesh)
        ripple.geometry.dispose()
        ripple.material.dispose()
        ripples.splice(index, 1)
      }
    }
    if (!continuous && alive === 0 && ripples.length === 0) host.object3D.visible = false
  }

  const clear = () => {
    continuous = false
    continuousAccumulator = 0
    activeParticleCount = 0
    for (let index = 0; index < count; index += 1) hideParticle(index)
    geometry.attributes.position.needsUpdate = true
    material.opacity = 0
    ripples.splice(0).forEach((ripple) => {
      host.object3D.remove(ripple.mesh)
      ripple.geometry.dispose()
      ripple.material.dispose()
    })
    host.object3D.visible = false
  }

  clear()
  return {
    burst,
    addRipple,
    setContinuous(value) {
      continuous = Boolean(value)
      if (continuous) host.object3D.visible = true
    },
    update,
    clear,
    destroy() {
      clear()
      host.object3D.remove(points)
      geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}
