import './style.css'
import { renderArPage1 } from './ar-page1.js'
import { renderPage1Preview } from './page1-preview.js'

const app = document.querySelector('#app')
const params = new URLSearchParams(window.location.search)
const preview = params.get('preview')
const ar = params.get('ar')

document.title = '龙脉铜梁｜铜梁火龙非遗AR互动体验设计'

if (!preview && (!ar || ar === 'page1' || ar === 'page2' || ar === 'page3')) {
  renderArPage1(app)
} else if (preview === 'page1') {
  renderPage1Preview(app)
} else {
  app.innerHTML = `
    <main class="route-message">
      <p>暂未提供该预览页面。</p>
      <a href="/?preview=page1">打开第一页预览</a>
    </main>
  `
}
