export function createArUiController({ root, signal, actions }) {
  const preview = root.querySelector('.page1-preview')
  const startScreen = root.querySelector('.ar-start-screen')
  const waitingScreen = root.querySelector('.ar-waiting-screen')
  const startButton = root.querySelector('[data-ar-action="start"]')
  const scanStatus = root.querySelector('.ar-scan-status')
  const lostDialog = root.querySelector('.ar-lost-dialog')
  const videoResume = root.querySelector('.ar-video-resume')
  const errorPanel = root.querySelector('.ar-error-panel')
  const hotspotLabel = root.querySelector('.ar-hotspot-label')

  root.querySelectorAll('[data-ar-action]').forEach((button) =>
    button.addEventListener('click', () => actions[button.dataset.arAction]?.(), { signal }),
  )

  const hideTransient = () => {
    scanStatus.classList.remove('is-confirmed')
    scanStatus.hidden = true
    waitingScreen.hidden = true
    lostDialog.hidden = true
    videoResume.hidden = true
    errorPanel.hidden = true
  }

  return {
    hotspotLabel,
    showStarting() {
      startButton.disabled = true
      startButton.textContent = '正在开启摄像头…'
      waitingScreen.hidden = true
    },
    showScanning() {
      startScreen.hidden = true
      hideTransient()
      waitingScreen.hidden = false
    },
    showModuleScanning(message) {
      startScreen.hidden = true
      hideTransient()
      scanStatus.textContent = message
      scanStatus.hidden = false
    },
    showModule() {
      startScreen.hidden = true
      hideTransient()
    },
    showHotspot() {
      startScreen.hidden = true
      hideTransient()
      preview.classList.remove('is-craft-active')
      scanStatus.textContent = '识别成功｜竹骨成龙 · 点击识别图左下角竹篾'
      scanStatus.hidden = false
    },
    hideHotspot() {
      if (hotspotLabel) hotspotLabel.hidden = true
      scanStatus.hidden = true
    },
    showLiftGuide() {
      hideTransient()
      scanStatus.textContent = '请缓慢抬起手机，体验火龙工艺展开'
      scanStatus.classList.add('is-confirmed')
      scanStatus.hidden = false
    },
    showPanelRising() {
      hideTransient()
      scanStatus.textContent = '龙首工艺板正在展开…'
      scanStatus.hidden = false
    },
    showCraft() {
      hideTransient()
      preview.classList.add('is-craft-active')
    },
    showLost() {
      lostDialog.hidden = false
    },
    hideLost() {
      lostDialog.hidden = true
    },
    showVideoResume() {
      videoResume.hidden = false
    },
    hideVideoResume() {
      videoResume.hidden = true
    },
    showError(message) {
      startScreen.hidden = true
      hideTransient()
      errorPanel.querySelector('p').textContent = message
      errorPanel.hidden = false
    },
    resetStart() {
      hideTransient()
      startScreen.hidden = false
      waitingScreen.hidden = true
      startButton.disabled = false
      startButton.textContent = '开启AR体验'
    },
  }
}
