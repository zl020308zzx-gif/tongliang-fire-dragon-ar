import './style.css'
import { renderArPage1 } from './ar-page1.js'
import { renderPage1Preview } from './page1-preview.js'

const app = document.querySelector('#app')
const params = new URLSearchParams(window.location.search)
const preview = params.get('preview')
const ar = params.get('ar')

if (ar === 'page1' || ar === 'page2') {
  renderArPage1(app)
} else if (!preview || preview === 'page1') {
  renderPage1Preview(app)
} else {
  app.innerHTML = `
    <main class="route-message">
      <p>暂未提供该预览页面。</p>
      <a href="/?preview=page1">打开第一页预览</a>
    </main>
  `
}
