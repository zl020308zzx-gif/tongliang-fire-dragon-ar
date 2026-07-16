export function createArUiController({ root, signal, actions }) {
  const preview = root.querySelector('.page1-preview')
  const startScreen = root.querySelector('.ar-start-screen')
  const startButton = root.querySelector('[data-ar-action="start"]')
  const scanStatus = root.querySelector('.ar-scan-status')
  const tiltPrompt = root.querySelector('.ar-tilt-prompt')
  const manualTilt = root.querySelector('[data-ar-action="manual-tilt"]')
  const lostDialog = root.querySelector('.ar-lost-dialog')
  const videoResume = root.querySelector('.ar-video-resume')
  const errorPanel = root.querySelector('.ar-error-panel')
  const hotspotLabel = root.querySelector('.ar-hotspot-label')

  root.querySelectorAll('[data-ar-action]').forEach((button) =>
    button.addEventListener('click', () => actions[button.dataset.arAction]?.(), { signal }),
  )

  const hideTransient = () => {
    scanStatus.hidden = true
    tiltPrompt.hidden = true
    lostDialog.hidden = true
    videoResume.hidden = true
    errorPanel.hidden = true
  }

  return {
    hotspotLabel,
    showStarting() {
      startButton.disabled = true
      startButton.textContent = '正在开启摄像头…'
      scanStatus.textContent = '正在请求摄像头权限…'
      scanStatus.hidden = false
    },
    showScanning(message = '请扫描竹骨燃龙识别卡') {
      startScreen.hidden = true
      hideTransient()
      scanStatus.textContent = message
      scanStatus.hidden = false
    },
    showHotspot() {
      startScreen.hidden = true
      hideTransient()
      preview.classList.remove('is-craft-active')
    },
    hideHotspot() {
      hotspotLabel.hidden = true
    },
    showTilt() {
      hideTransient()
      tiltPrompt.hidden = false
      manualTilt.hidden = true
    },
    showManualTilt() {
      manualTilt.hidden = false
    },
    showPanelRising() {
      tiltPrompt.querySelector('p').textContent = '龙首工艺板正在升起…'
      manualTilt.hidden = true
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
      startButton.disabled = false
      startButton.textContent = '开启AR体验'
    },
  }
}
