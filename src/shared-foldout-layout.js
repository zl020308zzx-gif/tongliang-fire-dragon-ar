const markerWidthMm = 148
const markerHeightMm = 210
const markerAspect = markerHeightMm / markerWidthMm
const boardWidth = 1.02
const boardHeight = boardWidth * 1.5

export const SHARED_FOLDOUT_LAYOUT = Object.freeze({
  markerAspect,
  rootPosition: Object.freeze([0, 0, 0]),
  rootRotationDegrees: Object.freeze([0, 0, 0]),
  rootScale: Object.freeze([1, 1, 1]),
  floor: Object.freeze({
    // 三张底板均为 2:3 PNG，以识别卡深度为高度，避免拉伸。
    width: markerAspect * (2 / 3),
    depth: markerAspect,
    position: Object.freeze([0, 0, 2 / markerWidthMm]),
    rotationDegrees: Object.freeze([0, 0, 0]),
    scale: Object.freeze([1, 1, 1]),
    lift: 2 / markerWidthMm,
    renderOrder: -100,
  }),
  backboardHinge: Object.freeze({
    position: Object.freeze([0, markerAspect / 2, 0.004]),
    rotationStartDegrees: Object.freeze([0, 0, 0]),
    rotationEndDegrees: Object.freeze([90, 0, 0]),
    scale: Object.freeze([1, 1, 1]),
  }),
  backgroundBoard: Object.freeze({
    width: boardWidth,
    height: boardHeight,
    localPosition: Object.freeze([0, boardHeight / 2, 0]),
    rotationDegrees: Object.freeze([0, 0, 0]),
    scale: Object.freeze([1, 1, 1]),
  }),
  backgroundFloorAngle: 90,
})

export const cloneVector = (values) => [...values]
