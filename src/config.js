import { assetUrl } from './asset-url.js'

const PAGE1_DIRECTORY = assetUrl('assets/page1/images/page1')
const FRONT_DIRECTION_SIGN = 1

export const PAGE1_PREVIEW_CONFIG = {
  assets: {
    backgroundBoard: `${PAGE1_DIRECTORY}/craft-panel.png`,
    bambooBundle: `${PAGE1_DIRECTORY}/bamboo-bundle.png`,
    bambooBuildAudio: assetUrl('assets/page1/audio/bamboo-build.mp3'),
    paperCoverAudio: assetUrl('assets/page1/audio/paper-cover.mp3'),
    paintBrushAudio: assetUrl('assets/page1/audio/paint-brush.mp3'),
    completeAudio: assetUrl('assets/page1/audio/complete.mp3'),
    colorMask: `${PAGE1_DIRECTORY}/color-mask.png`,
    badge: `${PAGE1_DIRECTORY}/badge-bamboo.png`,
    phoneTiltGuide: `${PAGE1_DIRECTORY}/phone-tilt-guide.png`,
    awakenVideo: assetUrl('assets/page1/video/dragon-awaken.mp4'),
    craftLayers: [
      { id: 'lineart', label: '线稿', path: `${PAGE1_DIRECTORY}/01-lineart.png` },
      { id: 'bamboo', label: '竹骨', path: `${PAGE1_DIRECTORY}/02-bamboo-frame.png` },
      { id: 'paper', label: '裱糊', path: `${PAGE1_DIRECTORY}/03-paper-cover.png` },
      { id: 'color', label: '彩绘', path: `${PAGE1_DIRECTORY}/04-color-finished.png` },
    ],
  },
  canvas: {
    id: 'craft-canvas',
    // 使用初始线稿的真实像素尺寸作为四个状态的统一坐标系。
    width: 1041,
    height: 1024,
  },
  debug: {
    queryKey: 'debug',
    layersValue: 'layers',
    bambooValue: 'bamboo',
    paperValue: 'paper',
    paintValue: 'paint',
    eyeValue: 'eye',
    videoValue: 'video',
    explodeValue: 'explode',
    hintsValue: 'hints',
    stateValue: 'state',
  },
  storageKey: 'page1CraftCompleted',
  legacyStorageKeys: ['bambooActivated', 'page1LastState', 'page1DisplayMode'],
  transitions: {
    bambooCompleteHoldMs: 600,
    paperCompleteHoldMs: 600,
    colorCompleteHoldMs: 350,
  },
  bambooInteraction: {
    holdDurationMs: 2500,
    lineartFadeDurationMs: 300,
    mask: {
      // 归一化 Canvas 坐标，(0.5, 0.5) 为正中心。
      center: { x: 0.5, y: 0.5 },
      maxRadius: 850,
      featherWidth: 100,
    },
  },
  paperCompare: {
    completeThreshold: 0.9,
    confirmDurationMs: 300,
    featherWidth: 64,
    demonstration: {
      durationMs: 900,
      peakProgress: 0.15,
    },
  },
  paintInteraction: {
    completionThreshold: 0.8,
    autoCompleteDurationMs: 500,
    statistics: {
      size: 192,
      intervalMs: 120,
      validLuminanceThreshold: 128,
      paintedAlphaThreshold: 32,
    },
  },
  paintBrush: {
    radius: 58,
    coreRatio: 0.25,
    middleRatio: 0.62,
    middleAlpha: 0.38,
    outerAlpha: 0,
    interpolationSpacingRatio: 0.22,
    coverageRadiusRatio: 0.48,
  },
  eyeHotspot: {
    // A-Frame UV 坐标，原点位于龙头平面左下角。
    x: 0.368,
    y: 0.707,
    radius: 0.07,
    glowDurationMs: 1800,
  },
  interactionHints: {
    color: '#d7a64a',
    brightColor: '#ffe08a',
    dimOpacity: 0.28,
    bamboo: {
      center: { x: 0.5, y: 0.5 },
      innerRadiusPx: 38,
      outerRadiusPx: 55,
      innerLineWidthPx: 4,
      outerLineWidthPx: 2,
      pulseDurationMs: 1800,
    },
    paper: {
      lineWidthPx: 3,
      handleSizePx: 52,
      handleBorderWidthPx: 3,
      pulseDurationMs: 1600,
    },
    paint: {
      cursorLineWidthPx: 2,
      sweepDurationMs: 1200,
      labelDurationMs: 1800,
    },
    eye: {
      innerScale: 1,
      outerScale: 1.45,
      innerLineWidthPx: 4,
      outerLineWidthPx: 2,
      pulseDurationMs: 1800,
    },
    canvas: {
      holdRadius: 70,
      holdLineWidth: 7,
      paperLineWidth: 5,
      paperHandleRadius: 38,
      paintCursorLineWidth: 5,
      eyeLineWidth: 6,
    },
  },
  craftStamps: {
    lightDurationMs: 300,
    labels: ['起稿印', '竹骨印', '裱糊印', '彩绘印'],
  },
  backgroundBoard: {
    position: [0, 0, -0.08],
    // 原图 536 × 999。
    size: { width: 3.648448, height: 6.8 },
    rotation: [0, 0, 0],
  },
  craftPlane: {
    position: [0, 0.3, 0],
    // 平面宽高比与 1041 × 1024 Canvas 完全一致。
    size: { width: 3.15, height: 3.098943 },
    rotation: [0, 0, 0],
  },
  videoPlane: {
    position: [0, 0.3, 0.03],
    // 原视频 720 × 1280，按 9:16 保持原始比例。
    size: { width: 1.74375, height: 3.1 },
    rotation: [0, 0, 0],
  },
  badge: {
    position: [1.22, 1.85, 0.06],
    size: { width: 0.72, height: 0.72265 },
    rotation: [0, 0, -8],
    animationDurationMs: 400,
  },
  explodedView: {
    groupPosition: [0, 0.3, 0],
    groupRotation: [0, 0, 0],
    planeSize: { width: 3.15, height: 3.098943 },
    animationDurationMs: 1200,
    panelSurfaceZ: -0.08,
    frontDirectionSign: FRONT_DIRECTION_SIGN,
    minimumFrontGap: 0.02,
    focusDepth: 0.16,
    unfocusedOpacity: 0.42,
    layers: [
      { id: 'lineart', stage: '01', shortLabel: '起稿', x: -0.36, y: 0, z: 0.12, renderOrder: 10 },
      { id: 'bamboo', stage: '02', shortLabel: '竹骨', x: -0.12, y: 0, z: 0.32, renderOrder: 11 },
      { id: 'paper', stage: '03', shortLabel: '裱糊', x: 0.12, y: 0, z: 0.52, renderOrder: 12 },
      { id: 'color', stage: '04', shortLabel: '彩绘', x: 0.36, y: 0, z: 0.72, renderOrder: 13 },
    ],
    parallax: {
      maxHorizontalDeg: 8,
      maxVerticalDeg: 3,
      smoothing: 0.085,
      touchSensitivity: 1,
      orientationSensitivity: 0.18,
    },
    bambooAnnotations: [
      { id: 'eye-support', label: '眼眶支撑', uv: { x: 0.37, y: 0.7 } },
      { id: 'jaw-support', label: '上下颌支撑', uv: { x: 0.63, y: 0.54 } },
      { id: 'neck-link', label: '龙颈连接', uv: { x: 0.28, y: 0.3 } },
    ],
  },
  effects: {
    bambooParticleCount: 7,
    paintParticleCount: 7,
    emberParticleCount: 9,
    particleDurationMs: 900,
    reviewGlowDurationMs: 2400,
  },
  ar: {
    targetSrc: assetUrl('assets/markers/targets.mind'),
    markerImage: assetUrl('assets/markers/marker-01-craft.jpg'),
    targetIndex: 0,
    markerWidth: 1,
    markerAspectFallback: 1.2496,
    bambooHotspot: {
      // 坐标原点为识别图左上角。
      xMin: 0.03,
      xMax: 0.4,
      yMin: 0.6,
      yMax: 0.87,
    },
    trackingSmoothing: {
      positionLerp: 0.12,
      rotationSlerp: 0.1,
      scaleLerp: 0.15,
      positionDeadzone: 0.002,
      rotationDeadzoneDeg: 0.35,
      scaleDeadzone: 0.001,
      lostHoldDuration: 250,
      recoverDuration: 300,
    },
    arPanel: {
      frontDirectionSign: FRONT_DIRECTION_SIGN,
      baseScale: 0.18,
      modes: {
        vertical: {
          hingePosition: { x: 0, y: 0.6248, z: 0.008 },
          contentPosition: { x: 0, y: 0.544, z: 0 },
          startRotation: { x: 0, y: 0, z: 0 },
          endRotation: { x: 74, y: 0, z: 0 },
          frontOffset: 0.018,
          scale: 0.89,
          animationDuration: 900,
        },
        parallel: {
          position: { x: 0, y: 0, z: 0.006 },
          contentPosition: { x: 0, y: 0, z: 0 },
          startRotation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          frontOffset: 0.025,
          scale: 0.92,
          animationDuration: 650,
        },
      },
    },
    tracking: {
      lostDelayMs: 800,
    },
  },
  camera: {
    position: [0, 0, 8.4],
    rotation: [0, 0, 0],
    fov: 48,
  },
}
