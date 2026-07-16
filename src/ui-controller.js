const CONTENT = {
  lineart: ['步骤：<strong>01 / 04</strong>', '选材起稿', '根据龙头造型确定龙眼、鼻部、龙口、龙角和龙颈的位置，<br />为后续竹骨扎制建立基本轮廓。'],
  bamboo: ['步骤：<strong>02 / 04</strong>', '扎骨成形', '竹篾依照线稿弯曲、交叉和扎结，<br />形成龙头眼眶、上下颌、额角与龙颈的内部支撑。'],
  paper: ['步骤：<strong>03 / 04</strong>', '裱糊塑形', '纸、布等表层材料覆盖竹骨，<br />使开放的竹篾结构形成完整龙头外形，<br />并为后续彩绘提供稳定表面。'],
  paint: ['步骤：<strong>04 / 04</strong>', '彩绘装饰', '以朱红塑造火龙主体，以白黑强化眼眶、牙齿和龙口，<br />再以金色勾勒纹样、龙角与装饰边缘。'],
  eye: ['完成仪式', '点睛成龙', '龙首完成彩绘后，<br />点击龙眼进入火龙苏醒的数字表演状态。'],
  video: ['完成仪式', '火龙苏醒', '点睛后的龙首在锣鼓与火光中苏醒，<br />由制作完成的龙具进入火龙表演状态。'],
  explode: ['完成仪式', '四层成龙谱', '从线稿起形、竹骨立架、裱糊塑形到彩绘成龙，<br />火龙龙首的制作时间过程被转化为可观察的空间层次。'],
}

const LAYER_CONTENT = {
  lineart: ['01 选材起稿', '确定龙眼、龙鼻、龙口、龙角和龙颈的位置，<br />建立火龙龙首的基本造型比例。'],
  bamboo: ['02 扎骨成形', '竹篾经过弯曲、交叉和扎结，<br />形成眼眶、上下颌、额角和龙颈的轻质支撑。'],
  paper: ['03 裱糊塑形', '纸、布等表层材料覆盖竹骨，<br />将开放骨架转化为完整外形，并形成后续彩绘的基础。'],
  color: ['04 彩绘装饰', '朱红塑造火龙主体，白黑强化眼眶、平齿和龙口，<br />金色勾勒纹样与装饰边缘。'],
}

export function createUiController({ root, states, signal, actions, stampDurationMs }) {
  const stepNumber = root.querySelector('.step-number')
  const title = root.querySelector('#step-title')
  const description = root.querySelector('.step-description')
  const hint = root.querySelector('.step-hint')
  const actionButtons = root.querySelectorAll('[data-card-action]')
  const actionContainer = root.querySelector('.card-actions')
  const endNotice = root.querySelector('.preview-end-notice')
  const stamps = [...root.querySelectorAll('[data-craft-stamp]')]

  const hideActions = () => {
    actionButtons.forEach((button) => (button.hidden = true))
    actionContainer.hidden = true
  }
  const showActions = (...names) => {
    hideActions()
    actionContainer.hidden = false
    names.forEach((name) => {
      const button = root.querySelector(`[data-card-action="${name}"]`)
      if (button) button.hidden = false
    })
  }
  const apply = (content, hintText) => {
    stepNumber.innerHTML = content[0]
    title.textContent = content[1]
    description.innerHTML = content[2]
    hint.innerHTML = `<span>操作提示</span>${hintText}`
    endNotice.hidden = true
    hideActions()
  }

  const stampLevelForState = (state) => {
    if ([states.LINEART].includes(state)) return { completed: -1, current: 0 }
    if ([states.BAMBOO_BUILD].includes(state)) return { completed: 0, current: 1 }
    if ([states.BAMBOO_COMPLETE, states.PAPER_COMPARE, states.PAPER_READY].includes(state)) return { completed: 1, current: 2 }
    if ([states.PAPER_COMPLETE, states.COLOR_PAINT].includes(state)) return { completed: 2, current: 3 }
    return { completed: 3, current: 3 }
  }

  const updateStamps = (state, reset = false) => {
    const level = stampLevelForState(state)
    stamps.forEach((stamp, index) => {
      const wasLit = stamp.classList.contains('is-complete')
      stamp.className = ''
      if (index <= level.completed) stamp.classList.add('is-complete')
      if (index === level.current) stamp.classList.add('is-current')
      if (!reset && !wasLit && index <= level.completed) {
        stamp.classList.add('just-lit')
        stamp.style.setProperty('--stamp-light-duration', `${stampDurationMs}ms`)
      }
    })
    root.querySelector('.craft-stamps').classList.toggle('all-complete', level.completed === 3)
  }

  const setState = (state, progress = {}, meta = {}) => {
    if (state === states.LINEART) apply(CONTENT.lineart, '长按龙首，让竹骨逐渐成形。')
    else if (state === states.BAMBOO_BUILD) apply(CONTENT.bamboo, `竹骨成形 ${Math.round(progress.bamboo * 100)}%`)
    else if (state === states.BAMBOO_COMPLETE) apply(CONTENT.bamboo, '扎骨完成，准备进入裱糊阶段。')
    else if (state === states.PAPER_COMPARE || state === states.PAPER_READY) {
      apply(
        CONTENT.paper,
        meta.hasSeenFullPaper
          ? '已查看完整裱糊效果，可继续对比或完成本步骤。'
          : '左右拖动滑杆，对比竹骨与裱糊效果。',
      )
      if (meta.hasSeenFullPaper) showActions('paper-complete')
    } else if (state === states.PAPER_COMPLETE) apply(CONTENT.paper, '裱糊完成，准备进行彩绘。')
    else if (state === states.COLOR_PAINT) apply(CONTENT.paint, progress.paint > 0 ? `彩绘进度 ${Math.round(progress.paint * 100)}%` : '在龙首区域内滑动彩绘，完成80%后自动补全。')
    else if (state === states.COLOR_COMPLETE) apply(CONTENT.paint, '彩绘完成')
    else if (state === states.EYE_READY) apply(CONTENT.eye, '点击龙眼，唤醒火龙。')
    else if (state === states.VIDEO_PLAYING) apply(CONTENT.video, '正在唤醒火龙……')
    else if (state === states.AWAKEN_REVIEW) {
      apply(CONTENT.video, '火龙已苏醒，查看龙首的四层成形过程。')
      showActions('review')
    } else if (state === states.EXPLODE_TRANSITION) apply(CONTENT.explode, '四层工艺正在展开……')
    else if (state === states.EXPLODE_VIEW) {
      apply(CONTENT.explode, '左右微微摆动手机，或拖动画面查看制作层次。点击图层可查看工艺说明。')
      showActions('overview', 'restart', 'end')
    } else if (state === states.LAYER_FOCUS) {
      const layer = LAYER_CONTENT[meta.selectedLayer] ?? LAYER_CONTENT.color
      apply(['工艺图层', layer[0], layer[1]], '再次点击当前标签或选择“返回全貌”。')
      showActions('overview', 'restart', 'end')
    } else if (state === states.COMPLETED) {
      apply(CONTENT.explode, '第一页体验已完成，可继续扫描其他模块。')
      showActions('overview', 'restart', 'end')
    }
    updateStamps(state, meta.resetStamps)
  }

  const updateProgress = (kind, value) => {
    if (kind === 'bamboo') hint.innerHTML = `<span>操作提示</span>竹骨成形 ${Math.round(value * 100)}%`
    if (kind === 'paint') hint.innerHTML = `<span>操作提示</span>彩绘进度 ${Math.round(value * 100)}%`
  }

  actionButtons.forEach((button) => button.addEventListener('click', () => actions[button.dataset.cardAction]?.(), { signal }))

  return {
    setState,
    updateProgress,
    showVideoFailure() {
      showActions('retry', 'skip')
      hint.innerHTML = '<span>操作提示</span>视频未能播放，可重新播放或跳过。'
    },
    showEndMessage() {
      endNotice.textContent = '第一页体验已完成，可继续扫描其他模块。'
      endNotice.hidden = false
    },
  }
}
