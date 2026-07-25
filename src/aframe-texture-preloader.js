const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const asArray = (value) => Array.isArray(value) ? value : [value]

const imageMatches = (candidate, image, expectedUrl) => candidate === image
  || candidate?.currentSrc === expectedUrl
  || candidate?.src === expectedUrl

const collectTextures = (entities, image, expectedUrl) => {
  const textures = new Set()
  entities.forEach((entity) => {
    entity?.object3D?.traverse((object) => {
      asArray(object.material).filter(Boolean).forEach((material) => {
        if (material.map && imageMatches(material.map.image, image, expectedUrl)) {
          textures.add(material.map)
        }
      })
    })
  })
  return textures
}

export async function prepareAFrameImageTexture({
  scene,
  entity = null,
  entities = null,
  image,
  assetKey,
  bindImage = null,
  gpuReady = null,
  maxBindingFrames = 180,
}) {
  if (!(image instanceof HTMLImageElement)
    || !image.complete
    || image.naturalWidth <= 0
    || image.naturalHeight <= 0) {
    throw new Error(`[texture] Image is not loaded: ${assetKey}`)
  }
  if (!image.id) throw new Error(`[texture] Image id is required: ${assetKey}`)

  const targets = (entities || [entity]).filter(Boolean)
  if (!targets.length) throw new Error(`[texture] Entity is missing: ${assetKey}`)
  const expectedUrl = new URL(image.currentSrc || image.src, document.baseURI).href

  if (bindImage) bindImage(image)
  else targets.forEach((target) => target.setAttribute('src', `#${image.id}`))

  let textures = collectTextures(targets, image, expectedUrl)
  for (let frame = 0; textures.size === 0 && frame < maxBindingFrames; frame += 1) {
    await nextFrame()
    textures = collectTextures(targets, image, expectedUrl)
  }
  if (textures.size === 0) {
    throw new Error(`[texture] Mesh/material.map was not created: ${assetKey}`)
  }

  const THREE = window.AFRAME?.THREE
  const renderer = scene?.renderer
  if (!THREE || !renderer || typeof renderer.initTexture !== 'function') {
    throw new Error(`[texture] WebGL renderer is not ready: ${assetKey}`)
  }

  const failures = []
  textures.forEach((texture) => {
    texture.generateMipmaps = false
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.needsUpdate = true
    try {
      renderer.initTexture(texture)
    } catch (error) {
      failures.push(error)
      console.error('[texture] renderer.initTexture failed', { assetKey, error })
    }
  })
  if (failures.length) {
    throw new Error(`[texture] GPU upload failed: ${assetKey}`)
  }

  await nextFrame()
  await nextFrame()
  const verified = collectTextures(targets, image, expectedUrl)
  if (verified.size !== textures.size) {
    throw new Error(`[texture] GPU texture verification failed: ${assetKey}`)
  }
  gpuReady?.add(assetKey)
  return {
    assetKey,
    textureCount: textures.size,
    textures: [...textures],
    width: image.naturalWidth,
    height: image.naturalHeight,
  }
}

export function disposeAFrameImageTextures({ entities = [], assetKey = '', gpuReady = null }) {
  const disposed = new Set()
  entities.filter(Boolean).forEach((entity) => {
    entity.object3D?.traverse((object) => {
      asArray(object.material).filter(Boolean).forEach((material) => {
        const texture = material.map
        if (!texture || disposed.has(texture)) return
        disposed.add(texture)
        texture.dispose?.()
        material.map = null
        material.needsUpdate = true
      })
    })
    entity.object3D.visible = false
    entity.setAttribute('visible', false)
  })
  if (assetKey) gpuReady?.delete(assetKey)
  return disposed.size
}
