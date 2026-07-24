import { assetUrl } from './asset-url.js'

const PAGE1_DIRECTORY = assetUrl('assets/page1/images/page1')
const FRONT_DIRECTION_SIGN = 1
const A5_WIDTH_MM = 148
const A5_HEIGHT_MM = 210
const A5_ASPECT_RATIO = A5_HEIGHT_MM / A5_WIDTH_MM
const PANEL_HEIGHT = 6.8
const PANEL_WIDTH = PANEL_HEIGHT / A5_ASPECT_RATIO
const CRAFT_WIDTH = 3.42
const CRAFT_HEIGHT = CRAFT_WIDTH * (1024 / 1041)

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
  a5Layout: {
    widthMm: A5_WIDTH_MM,
    heightMm: A5_HEIGHT_MM,
    aspectRatio: A5_ASPECT_RATIO,
    marker: {
      width: 1,
      height: A5_ASPECT_RATIO,
    },
    panel: {
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
      position: [0, 0, -0.08],
    },
    craft: {
      width: CRAFT_WIDTH,
      height: CRAFT_HEIGHT,
      position: [0, -0.22, 0],
    },
    video: {
      width: 1.884375,
      height: 3.35,
      position: [0, -0.22, 0.03],
    },
  },
  copy: {
    steps: {
      lineart: {
        number: '步骤：<strong>01 / 05</strong>',
        title: '选材起稿',
        description: '以竹篾为基础，依照火龙龙头的造型比例勾勒轮廓，为后续扎制作出清晰的结构依据。',
      },
      bamboo: {
        number: '步骤：<strong>02 / 05</strong>',
        title: '扎骨成形',
        description: '竹篾骨架决定火龙的基本体量与结构关系，是龙头从平面轮廓走向立体形态的关键。',
      },
      paper: {
        number: '步骤：<strong>03 / 05</strong>',
        title: '裱糊塑形',
        description: '在竹骨外部完成裱糊，使开放骨架获得完整外形，龙头的轮廓与体面关系由此被塑造。',
      },
      paint: {
        number: '步骤：<strong>04 / 05</strong>',
        title: '彩绘装饰',
        description: '以色彩和纹样强化龙眼、龙口与额角，使工艺结构转化为具有节庆气氛的火龙形象。',
      },
      eye: {
        number: '步骤：<strong>05 / 05</strong>',
        title: '点睛唤醒',
        description: '点睛赋予龙头完整神采，也象征火龙由工艺器物走向舞动生命。',
      },
      video: {
        number: '唤醒仪式',
        title: '火龙苏醒',
        description: '点睛后的龙首在火光中苏醒，制作完成的龙具由静态工艺进入表演状态。',
      },
      overview: {
        number: '工艺总览',
        title: '成龙谱',
        description: '线稿、竹骨、裱糊和彩绘依次展开，呈现龙首由造型依据到节庆成品的完整工艺关系。',
      },
    },
    layers: {
      lineart: {
        title: '01 选材起稿',
        description: '先确定龙眼、龙口、额角与龙颈的比例，使后续竹骨有可依循的造型基准。',
      },
      bamboo: {
        title: '02 扎骨成形',
        description: '竹篾沿线稿弯曲、交叉并扎结，新增承托眼眶、上下颌与龙颈的轻质骨架。',
      },
      paper: {
        title: '03 裱糊塑形',
        description: '纸布包覆开放竹骨，新增连续表面与完整体面，同时保留内部结构的轻巧。',
      },
      color: {
        title: '04 彩绘成品',
        description: '朱红、金色与黑白纹样覆盖裱糊表面，新增鲜明神态与表演识别度。',
      },
    },
    feedback: {
      lineart: '起稿完成',
      bamboo: '扎骨完成',
      paper: '裱糊完成',
      paint: '彩绘完成',
      eye: '点睛完成｜火龙苏醒',
      overview: '成龙谱已展开｜竹骨印记点亮',
    },
  },
  transitions: {
    lineartRevealDurationMs: 480,
    lineartCompleteHoldMs: 900,
    bambooCompleteHoldMs: 600,
    paperCompleteHoldMs: 600,
    colorCompleteHoldMs: 350,
  },
  bambooInteraction: {
    holdDurationMs: 3500,
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
    coreRatio: 0.12,
    middleRatio: 0.74,
    middleAlpha: 0.24,
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
      innerLineWidthPx: 6,
      outerLineWidthPx: 4,
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
    feedbackDurationMs: 1050,
    labels: ['起稿印', '竹骨印', '裱糊印', '彩绘印'],
  },
  backgroundBoard: {
    position: [0, 0, -0.08],
    // A5 竖版：148 × 210。
    size: { width: PANEL_WIDTH, height: PANEL_HEIGHT },
    rotation: [0, 0, 0],
  },
  craftPlane: {
    position: [0, -0.22, 0],
    // 平面宽高比与 1041 × 1024 Canvas 完全一致。
    size: { width: CRAFT_WIDTH, height: CRAFT_HEIGHT },
    rotation: [0, 0, 0],
  },
  videoPlane: {
    position: [0, -0.22, 0.03],
    // 原视频 720 × 1280，按 9:16 保持原始比例。
    size: { width: 1.884375, height: 3.35 },
    rotation: [0, 0, 0],
  },
  badge: {
    position: [1.56, 2.12, 0.06],
    size: { width: 0.72, height: 0.72265 },
    rotation: [0, 0, -8],
    animationDurationMs: 400,
  },
  explodedView: {
    groupPosition: [0, -0.22, 0],
    groupRotation: [0, 0, 0],
    planeSize: { width: CRAFT_WIDTH, height: CRAFT_HEIGHT },
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
      { id: 'color', stage: '04', shortLabel: '彩绘成品', x: 0.36, y: 0, z: 0.72, renderOrder: 13 },
    ],
    parallax: {
      maxHorizontalDeg: 8,
      maxVerticalDeg: 3,
      smoothing: 0.085,
      touchSensitivity: 1,
      orientationSensitivity: 0.18,
    },
    annotations: {
      lineart: [
        { id: 'lineart-outline', title: '龙头轮廓', description: '限定额角、龙口与龙颈外缘', uv: { x: 0.62, y: 0.55 }, offset: { x: 14, y: -16 } },
        { id: 'lineart-proportion', title: '造型比例', description: '协调龙眼、鼻部与上下颌位置', uv: { x: 0.37, y: 0.7 }, offset: { x: -156, y: 12 } },
      ],
      bamboo: [
        { id: 'bamboo-jaw', title: '口部骨架', description: '新增上下颌的开合支撑', uv: { x: 0.67, y: 0.51 }, offset: { x: 14, y: 8 } },
        { id: 'bamboo-head', title: '头部支撑', description: '交叉竹篾承托眼眶与额角', uv: { x: 0.39, y: 0.69 }, offset: { x: -158, y: -18 } },
      ],
      paper: [
        { id: 'paper-cover', title: '外表包覆', description: '纸布覆盖开放竹骨', uv: { x: 0.62, y: 0.56 }, offset: { x: 14, y: -18 } },
        { id: 'paper-form', title: '形体塑造', description: '新增连续表面与饱满体面', uv: { x: 0.35, y: 0.4 }, offset: { x: -154, y: 10 } },
      ],
      color: [
        { id: 'color-eye', title: '龙眼彩绘', description: '黑白层次集中龙首神采', uv: { x: 0.37, y: 0.7 }, offset: { x: -158, y: -22 } },
        { id: 'color-pattern', title: '纹样装饰', description: '朱红与金纹形成表演识别度', uv: { x: 0.68, y: 0.42 }, offset: { x: 14, y: 12 } },
      ],
    },
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
    markerAspectFallback: A5_ASPECT_RATIO,
    bambooHotspot: {
      // 坐标原点为识别图左上角。
      xMin: 0.03,
      xMax: 0.4,
      yMin: 0.64,
      yMax: 0.94,
    },
    bambooDropTarget: {
      xMin: 0.43,
      xMax: 0.78,
      yMin: 0.34,
      yMax: 0.62,
    },
    bambooDrag: {
      clickThresholdPx: 12,
      liftGuideDurationMs: 900,
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
          hingePosition: { x: 0, y: A5_ASPECT_RATIO / 2, z: 0.008 },
          contentPosition: { x: 0, y: 0.544, z: 0 },
          startRotation: { x: 0, y: 0, z: 0 },
          endRotation: { x: 74, y: 0, z: 0 },
          frontOffset: 0.018,
          scale: 0.89,
          animationDuration: 900,
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
  video: {
    maxDurationMs: 5000,
  },
}
