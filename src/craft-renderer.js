function createSizedCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function createCraftRenderer({
  canvas,
  plane,
  layers,
  bambooMask,
  paperConfig,
  paintConfig,
  paintBrush,
  colorMaskPath,
  errorOutput,
  paintDebug,
}) {
  const context = canvas.getContext('2d')
  const compositeCanvas = createSizedCanvas(canvas.width, canvas.height)
  const compositeContext = compositeCanvas.getContext('2d')
  const visualPaintMask = createSizedCanvas(canvas.width, canvas.height)
  const visualPaintContext = visualPaintMask.getContext('2d')
  const validMaskCanvas = createSizedCanvas(canvas.width, canvas.height)
  const validMaskContext = validMaskCanvas.getContext('2d')
  const statisticsSize = paintConfig.statistics.size
  const coverageMask = createSizedCanvas(statisticsSize, statisticsSize)
  const coverageContext = coverageMask.getContext('2d')
  const statisticsValidCanvas = createSizedCanvas(statisticsSize, statisticsSize)
  const statisticsValidContext = statisticsValidCanvas.getContext('2d')
  const imageCache = new Map()
  const textureRetryFrames = new Set()
  let validStatisticsPixels = null
  let validPixelCount = 0

  const getLayer = (layerId) => layers.find((item) => item.id === layerId)

  const showError = (kind, path) => {
    errorOutput.textContent = `${kind}加载失败：${path}`
    errorOutput.hidden = false
  }

  const clearError = () => {
    errorOutput.textContent = ''
    errorOutput.hidden = true
  }

  const loadImage = (path) => {
    if (imageCache.has(path)) return imageCache.get(path)

    const imagePromise = new Promise((resolve, reject) => {
      const image = new Image()
      image.draggable = false
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(path))
      image.src = path
    })
    imageCache.set(path, imagePromise)
    return imagePromise
  }

  const refreshTexture = () => {
    if (typeof plane.getObject3D !== 'function') return false
    const mesh = plane.getObject3D('mesh')
    if (!mesh) return false
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    let refreshed = false
    materials.forEach((material) => {
      if (material?.map) {
        material.map.needsUpdate = true
        refreshed = true
      }
    })
    return refreshed
  }

  const requestTextureRefresh = () => {
    if (refreshTexture()) return
    let attempts = 0
    const retry = () => {
      attempts += 1
      textureRetryFrames.delete(frameId)
      if (!refreshTexture() && attempts < 60) {
        frameId = requestAnimationFrame(retry)
        textureRetryFrames.add(frameId)
      }
    }
    let frameId = requestAnimationFrame(retry)
    textureRetryFrames.add(frameId)
  }

  const drawFull = (targetContext, image, alpha = 1) => {
    targetContext.save()
    targetContext.globalAlpha = alpha
    targetContext.drawImage(image, 0, 0, canvas.width, canvas.height)
    targetContext.restore()
  }

  const drawLayer = async (layerId) => {
    const layer = getLayer(layerId)
    if (!layer) return false
    try {
      const image = await loadImage(layer.path)
      clearError()
      context.clearRect(0, 0, canvas.width, canvas.height)
      drawFull(context, image)
      requestTextureRefresh()
      return true
    } catch {
      showError('图片', layer.path)
      return false
    }
  }

  const renderBamboo = async (progress, lineartOpacity = 1) => {
    const normalizedProgress = Math.min(1, Math.max(0, progress))
    const lineart = getLayer('lineart')
    const bamboo = getLayer('bamboo')
    try {
      const [lineartImage, bambooImage] = await Promise.all([
        loadImage(lineart.path),
        loadImage(bamboo.path),
      ])
      clearError()
      context.clearRect(0, 0, canvas.width, canvas.height)
      if (lineartOpacity > 0) drawFull(context, lineartImage, lineartOpacity)

      if (normalizedProgress > 0) {
        const radius = bambooMask.maxRadius * normalizedProgress
        const solidRadius = Math.max(0, radius - bambooMask.featherWidth)
        const centerX = canvas.width * bambooMask.center.x
        const centerY = canvas.height * bambooMask.center.y
        compositeContext.clearRect(0, 0, canvas.width, canvas.height)
        drawFull(compositeContext, bambooImage)
        compositeContext.globalCompositeOperation = 'destination-in'
        const gradient = compositeContext.createRadialGradient(
          centerX,
          centerY,
          solidRadius,
          centerX,
          centerY,
          radius,
        )
        gradient.addColorStop(0, 'rgba(0,0,0,1)')
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
        compositeContext.fillStyle = gradient
        compositeContext.fillRect(0, 0, canvas.width, canvas.height)
        compositeContext.globalCompositeOperation = 'source-over'
        context.drawImage(compositeCanvas, 0, 0)
      }
      requestTextureRefresh()
      return true
    } catch (error) {
      showError('图片', error.message)
      return false
    }
  }

  const renderPaper = async (progress) => {
    const normalizedProgress = Math.min(1, Math.max(0, progress))
    const bamboo = getLayer('bamboo')
    const paper = getLayer('paper')
    try {
      const [bambooImage, paperImage] = await Promise.all([
        loadImage(bamboo.path),
        loadImage(paper.path),
      ])
      clearError()
      context.clearRect(0, 0, canvas.width, canvas.height)
      drawFull(context, bambooImage)
      if (normalizedProgress > 0) {
        const boundary = canvas.width * normalizedProgress
        const halfFeather = paperConfig.featherWidth / 2
        const solidEnd = Math.max(0, boundary - halfFeather)
        const fadeEnd = Math.min(canvas.width, boundary + halfFeather)
        compositeContext.clearRect(0, 0, canvas.width, canvas.height)
        drawFull(compositeContext, paperImage)
        compositeContext.globalCompositeOperation = 'destination-in'
        const gradient = compositeContext.createLinearGradient(solidEnd, 0, fadeEnd, 0)
        gradient.addColorStop(0, 'rgba(0,0,0,1)')
        gradient.addColorStop(1, 'rgba(0,0,0,0)')
        compositeContext.fillStyle = gradient
        compositeContext.fillRect(0, 0, fadeEnd, canvas.height)
        compositeContext.globalCompositeOperation = 'source-over'
        context.drawImage(compositeCanvas, 0, 0)
      }
      requestTextureRefresh()
      return true
    } catch (error) {
      showError('图片', error.message)
      return false
    }
  }

  const syncPaintDebug = () => {
    if (!paintDebug) return
    const validContext = paintDebug.validCanvas.getContext('2d')
    const paintedContext = paintDebug.paintedCanvas.getContext('2d')
    validContext.clearRect(0, 0, statisticsSize, statisticsSize)
    paintedContext.clearRect(0, 0, statisticsSize, statisticsSize)
    validContext.drawImage(statisticsValidCanvas, 0, 0)
    paintedContext.drawImage(coverageMask, 0, 0)
  }

  const preparePaint = async () => {
    if (validStatisticsPixels) return true
    try {
      const maskImage = await loadImage(colorMaskPath)
      validMaskContext.clearRect(0, 0, canvas.width, canvas.height)
      validMaskContext.drawImage(maskImage, 0, 0, canvas.width, canvas.height)
      const pixels = validMaskContext.getImageData(0, 0, canvas.width, canvas.height)
      const data = pixels.data
      const threshold = paintConfig.statistics.validLuminanceThreshold
      for (let index = 0; index < data.length; index += 4) {
        const luminance = (data[index] + data[index + 1] + data[index + 2]) / 3
        const alpha = luminance >= threshold ? 255 : 0
        data[index] = 255
        data[index + 1] = 255
        data[index + 2] = 255
        data[index + 3] = alpha
      }
      validMaskContext.putImageData(pixels, 0, 0)
      statisticsValidContext.clearRect(0, 0, statisticsSize, statisticsSize)
      statisticsValidContext.drawImage(validMaskCanvas, 0, 0, statisticsSize, statisticsSize)
      validStatisticsPixels = statisticsValidContext.getImageData(
        0,
        0,
        statisticsSize,
        statisticsSize,
      ).data
      validPixelCount = 0
      for (let index = 3; index < validStatisticsPixels.length; index += 4) {
        if (validStatisticsPixels[index] > 0) validPixelCount += 1
      }
      syncPaintDebug()
      return true
    } catch {
      showError('图片', colorMaskPath)
      return false
    }
  }

  const drawVisualDab = (targetContext, x, y) => {
    const radius = paintBrush.radius
    const gradient = targetContext.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(paintBrush.coreRatio, 'rgba(255,255,255,0.96)')
    gradient.addColorStop(paintBrush.middleRatio, `rgba(255,255,255,${paintBrush.middleAlpha})`)
    gradient.addColorStop(1, `rgba(255,255,255,${paintBrush.outerAlpha})`)
    targetContext.fillStyle = gradient
    targetContext.beginPath()
    targetContext.arc(x, y, radius, 0, Math.PI * 2)
    targetContext.fill()
  }

  const drawCoverageDab = (targetContext, x, y, radius) => {
    targetContext.fillStyle = '#fff'
    targetContext.beginPath()
    targetContext.arc(x, y, radius, 0, Math.PI * 2)
    targetContext.fill()
  }

  const renderPaint = async () => {
    const paper = getLayer('paper')
    const color = getLayer('color')
    try {
      const [paperImage, colorImage, ready] = await Promise.all([
        loadImage(paper.path),
        loadImage(color.path),
        preparePaint(),
      ])
      if (!ready) return false
      context.clearRect(0, 0, canvas.width, canvas.height)
      drawFull(context, paperImage)
      compositeContext.clearRect(0, 0, canvas.width, canvas.height)
      drawFull(compositeContext, colorImage)
      compositeContext.globalCompositeOperation = 'destination-in'
      compositeContext.drawImage(visualPaintMask, 0, 0)
      compositeContext.drawImage(validMaskCanvas, 0, 0)
      compositeContext.globalCompositeOperation = 'source-over'
      context.drawImage(compositeCanvas, 0, 0)
      requestTextureRefresh()
      return true
    } catch (error) {
      showError('图片', error.message)
      return false
    }
  }

  const paintStroke = (from, to) => {
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const interpolationSpacing = paintBrush.radius * paintBrush.interpolationSpacingRatio
    const steps = Math.max(1, Math.ceil(distance / interpolationSpacing))
    const statisticsScaleX = statisticsSize / canvas.width
    const statisticsScaleY = statisticsSize / canvas.height
    const statisticsRadiusScale = (statisticsScaleX + statisticsScaleY) / 2
    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps
      const x = from.x + (to.x - from.x) * ratio
      const y = from.y + (to.y - from.y) * ratio
      drawVisualDab(visualPaintContext, x, y)
      drawCoverageDab(
        coverageContext,
        x * statisticsScaleX,
        y * statisticsScaleY,
        paintBrush.radius * paintBrush.coverageRadiusRatio * statisticsRadiusScale,
      )
    }
    syncPaintDebug()
    renderPaint()
  }

  const getPaintCoverage = () => {
    if (!validStatisticsPixels || validPixelCount === 0) return 0
    const paintedPixels = coverageContext.getImageData(
      0,
      0,
      statisticsSize,
      statisticsSize,
    ).data
    const threshold = paintConfig.statistics.paintedAlphaThreshold
    let covered = 0
    for (let index = 3; index < paintedPixels.length; index += 4) {
      if (validStatisticsPixels[index] > 0 && paintedPixels[index] >= threshold) covered += 1
    }
    return covered / validPixelCount
  }

  const renderPaintAuto = async (autoProgress) => {
    if (autoProgress >= 1) return drawLayer('color')
    await renderPaint()
    const color = getLayer('color')
    try {
      const colorImage = await loadImage(color.path)
      drawFull(context, colorImage, Math.min(1, Math.max(0, autoProgress)))
      requestTextureRefresh()
      return true
    } catch {
      showError('图片', color.path)
      return false
    }
  }

  const resetPaint = () => {
    visualPaintContext.clearRect(0, 0, canvas.width, canvas.height)
    coverageContext.clearRect(0, 0, statisticsSize, statisticsSize)
    syncPaintDebug()
  }

  const isPointInColorMask = (point) => {
    if (!validStatisticsPixels) return false
    const x = Math.max(0, Math.min(statisticsSize - 1, Math.floor((point.x / canvas.width) * statisticsSize)))
    const y = Math.max(0, Math.min(statisticsSize - 1, Math.floor((point.y / canvas.height) * statisticsSize)))
    return validStatisticsPixels[(y * statisticsSize + x) * 4 + 3] > 0
  }

  return {
    drawLayer,
    renderBamboo,
    renderPaper,
    preparePaint,
    renderPaint,
    paintStroke,
    getPaintCoverage,
    isPointInColorMask,
    renderPaintAuto,
    resetPaint,
    destroy() {
      textureRetryFrames.forEach(cancelAnimationFrame)
      textureRetryFrames.clear()
    },
  }
}
