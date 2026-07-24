export function createUiController({ root, states, signal, actions, copy, stampDurationMs, feedbackDurationMs }) {
  const stepNumber = root.querySelector('.step-number')
  const title = root.querySelector('#step-title')
  const description = root.querySelector('.step-description')
  const hint = root.querySelector('.step-hint')
  const actionButtons = root.querySelectorAll('[data-card-action]')
  const actionContainer = root.querySelector('.card-actions')
  const endNotice = root.querySelector('.preview-end-notice')
  const feedback = root.querySelector('.craft-feedback')
  const stamps = [...root.querySelectorAll('[data-craft-stamp]')]
  let feedbackTimer = null
  let lastState = null

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
    stepNumber.innerHTML = content.number
    title.textContent = content.title
    description.textContent = content.description
    hint.innerHTML = `<span>操作提示</span>${hintText}`
    endNotice.hidden = true
    hideActions()
  }

  const showFeedback = (message) => {
    if (!feedback || !message) return
    window.clearTimeout(feedbackTimer)
    feedback.textContent = message
    feedback.hidden = false
    feedback.classList.remove('is-showing')
    requestAnimationFrame(() => feedback.classList.add('is-showing'))
    feedbackTimer = window.setTimeout(() => {
      feedback.classList.remove('is-showing')
      feedback.hidden = true
    }, feedbackDurationMs)
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
    const stateChanged = state !== lastState
    if (state === states.LINEART) apply(copy.steps.lineart, '识别竹篾与龙首比例，准备进入扎骨阶段。')
    else if (state === states.BAMBOO_BUILD) apply(copy.steps.bamboo, progress.bamboo > 0 ? `持续长按关键区域，竹骨成形 ${Math.round(progress.bamboo * 100)}%` : '长按龙首关键区域，让竹骨逐段成形。')
    else if (state === states.BAMBOO_COMPLETE) apply(copy.steps.bamboo, '扎骨完成，竹篾已形成龙头内部支撑。')
    else if (state === states.PAPER_COMPARE || state === states.PAPER_READY) {
      apply(
        copy.steps.paper,
        meta.hasSeenFullPaper ? '裱糊覆盖已达到完成范围。' : '从最左侧拖动把手，可左右来回比较竹骨与裱糊层。',
      )
    } else if (state === states.PAPER_COMPLETE) apply(copy.steps.paper, '裱糊完成，龙头已获得连续外形。')
    else if (state === states.COLOR_PAINT) apply(copy.steps.paint, progress.paint > 0 ? '继续在有效区域内涂抹，达到覆盖范围后将自动补全。' : '在龙首区域内连续涂抹，画笔离开后返回仍可继续。')
    else if (state === states.COLOR_COMPLETE) apply(copy.steps.paint, '彩绘完成，龙头的色彩与纹样已经补全。')
    else if (state === states.EYE_READY) apply(copy.steps.eye, '点击龙眼，唤醒火龙。')
    else if (state === states.VIDEO_PLAYING) apply(copy.steps.video, '正在唤醒火龙……')
    else if (state === states.AWAKEN_REVIEW) {
      apply(copy.steps.video, '火龙已苏醒，点击按钮进入工艺总览。')
      showActions('review')
    } else if (state === states.EXPLODE_TRANSITION) apply(copy.steps.overview, '线稿、竹骨、裱糊和彩绘层正在展开……')
    else if (state === states.EXPLODE_VIEW) {
      apply(copy.steps.overview, '点击图层标签，查看每一层新增的结构与工艺细节。')
      showActions('overview', 'restart', 'end')
    } else if (state === states.LAYER_FOCUS) {
      const layer = copy.layers[meta.selectedLayer] ?? copy.layers.color
      apply({ number: '工艺图层', ...layer }, '查看画面中的局部标注；再次点击当前标签可返回全貌。')
      showActions('overview', 'restart', 'end')
    } else if (state === states.COMPLETED) {
      apply(copy.steps.overview, '第一页体验已完成，可继续扫描其他模块。')
      showActions('overview', 'restart', 'end')
    }
    if (stateChanged) {
      if (state === states.BAMBOO_COMPLETE) showFeedback(copy.feedback.bamboo)
      else if (state === states.PAPER_COMPLETE) showFeedback(copy.feedback.paper)
      else if (state === states.COLOR_COMPLETE) showFeedback(copy.feedback.paint)
      else if (state === states.AWAKEN_REVIEW) showFeedback(copy.feedback.eye)
      else if (state === states.EXPLODE_VIEW) showFeedback(copy.feedback.overview)
    }
    lastState = state
    updateStamps(state, meta.resetStamps)
  }

  const updateProgress = (kind, value) => {
    if (kind === 'bamboo') hint.innerHTML = `<span>操作提示</span>竹骨成形 ${Math.round(value * 100)}%`
    if (kind === 'paint') hint.innerHTML = `<span>操作提示</span>彩绘进度 ${Math.round(value * 100)}%`
  }

  actionButtons.forEach((button) => button.addEventListener('click', () => actions[button.dataset.cardAction]?.(), { signal }))
  signal.addEventListener('abort', () => window.clearTimeout(feedbackTimer), { once: true })

  return {
    setState,
    updateProgress,
    showFeedback,
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
