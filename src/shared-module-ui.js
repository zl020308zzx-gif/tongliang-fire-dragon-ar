const MODULE_COPY = Object.freeze({
  0: { number: '01', title: '竹骨成龙', loading: '正在加载《竹骨成龙》' },
  1: { number: '02', title: '龙脉探源', loading: '正在加载《龙脉探源》' },
  2: { number: '03', title: '火舞夜空', loading: '正在加载《火舞夜空》' },
})

export const sharedModuleUiMarkup = () => `
  <header class="module-header" hidden>
    <span data-module-number>01</span>
    <h1 data-module-title>竹骨成龙</h1>
  </header>
  <p class="module-bottom-hint" hidden>
    扫描成功后，请保持手机与识别卡垂直，以获得更好的体验
  </p>
  <p class="shared-target-lost" role="status" hidden>
    识别已丢失，请重新扫描识别卡
  </p>
  <section class="module-loading-overlay" role="status" hidden>
    <strong data-module-loading-title>正在加载</strong>
    <span data-module-loading-progress>0%</span>
    <i><b data-module-loading-bar></b></i>
    <button type="button" data-module-loading-retry hidden>资源加载失败，点击重试</button>
  </section>
`

export function createSharedModuleUi({ root, signal }) {
  const header = root.querySelector('.module-header')
  const number = root.querySelector('[data-module-number]')
  const title = root.querySelector('[data-module-title]')
  const bottomHint = root.querySelector('.module-bottom-hint')
  const lost = root.querySelector('.shared-target-lost')
  const loading = root.querySelector('.module-loading-overlay')
  const loadingTitle = root.querySelector('[data-module-loading-title]')
  const loadingProgress = root.querySelector('[data-module-loading-progress]')
  const loadingBar = root.querySelector('[data-module-loading-bar]')
  const retry = root.querySelector('[data-module-loading-retry]')
  let retryAction = null

  retry.addEventListener('click', () => retryAction?.(), { signal })

  const checkDuplicateHeaders = () => {
    if (!import.meta.env.DEV) return
    requestAnimationFrame(() => {
      const visibleHeaders = [...root.querySelectorAll('.module-header')]
        .filter((element) => !element.hidden && getComputedStyle(element).display !== 'none')
      if (visibleHeaders.length > 1) console.warn('[UI] Duplicate module headers detected')
    })
  }

  return {
    activate(targetIndex) {
      const copy = MODULE_COPY[targetIndex]
      if (!copy) return
      number.textContent = copy.number
      title.textContent = copy.title
      header.hidden = false
      bottomHint.hidden = false
      lost.hidden = true
      checkDuplicateHeaders()
    },
    deactivate() {
      header.hidden = true
      bottomHint.hidden = true
      lost.hidden = true
      loading.hidden = true
    },
    showLost() {
      lost.hidden = false
    },
    hideLost() {
      lost.hidden = true
    },
    showLoading(targetIndex, progress = 0, failed = false, onRetry = null) {
      const copy = MODULE_COPY[targetIndex]
      const value = Math.max(0, Math.min(100, Number(progress) || 0))
      loadingTitle.textContent = copy?.loading || '正在加载AR内容'
      loadingProgress.textContent = `${Math.round(value)}%`
      loadingBar.style.width = `${value}%`
      retry.hidden = !failed
      retryAction = onRetry
      loading.hidden = false
    },
    hideLoading() {
      loading.hidden = true
      retry.hidden = true
      retryAction = null
    },
    getState() {
      return {
        moduleHeaderVisible: !header.hidden,
        bottomHintVisible: !bottomHint.hidden,
        lostTrackingUIVisible: !lost.hidden,
        loadingVisible: !loading.hidden,
      }
    },
  }
}
