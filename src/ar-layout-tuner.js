const STORAGE_KEY = 'tongliangArLayoutTunerV1'

const PAGE_META = Object.freeze({
  0: { name: 'Page1｜竹骨成龙', scope: '#stableAnchor' },
  1: { name: 'Page2｜龙脉探源', scope: '#page2-anchor' },
  2: { name: 'Page3｜火舞夜空', scope: '#page3-anchor' },
})

const ROUTE_PAGE = Object.freeze({
  page1: 0,
  page2: 1,
  page3: 2,
})

const VECTOR_AXES = ['x', 'y', 'z']
const GROUPS = ['position', 'rotation', 'scale']
const EXCLUDED_ID = /(?:marker|debug|hotspot|hit|cue|ripple|glow|particle|spatial|touch)/i
const GROUP_ID = /(?:root|hinge|center|content|craft-plane|bamboo-badge|explodedCraftGroup)$/i

const finite = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const round = (value, digits = 6) => Number(finite(value).toFixed(digits))

const readStoredTweaks = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return saved?.version === 1 && saved.pages && typeof saved.pages === 'object'
      ? saved.pages
      : {}
  } catch {
    return {}
  }
}

const vectorFromObject = (object, group, THREE) => {
  if (group === 'rotation') {
    return VECTOR_AXES.map((axis) => round(THREE.MathUtils.radToDeg(object.rotation[axis])))
  }
  return VECTOR_AXES.map((axis) => round(object[group][axis]))
}

const readTransform = (element, THREE) => {
  const object = element?.object3D
  if (!object) return null
  return Object.fromEntries(GROUPS.map((group) => [group, vectorFromObject(object, group, THREE)]))
}

const writeTransform = (element, transform, THREE) => {
  const object = element?.object3D
  if (!object || !transform) return false
  GROUPS.forEach((group) => {
    const values = transform[group]
    if (!Array.isArray(values) || values.length !== 3 || !values.every(Number.isFinite)) return
    if (group === 'rotation') {
      object.rotation.set(...values.map(THREE.MathUtils.degToRad))
    } else {
      object[group].set(...values)
    }
    element.setAttribute(group, values.join(' '))
  })
  object.updateMatrixWorld?.(true)
  return true
}

const getElementKey = (element) => {
  if (element.id) return `#${element.id}`
  const page2Key = element.dataset.page2AssetKey
  if (page2Key) return `[data-page2-asset-key="${page2Key}"]`
  const page3Key = element.dataset.page3AssetKey
  if (page3Key) return `[data-page3-asset-key="${page3Key}"]`
  return ''
}

const getElementLabel = (element) =>
  element.dataset.page2AssetKey
  || element.dataset.page3AssetKey
  || element.id
  || element.tagName.toLowerCase()

const isTunableElement = (element) => {
  const tag = element.tagName?.toLowerCase()
  const asset = element.dataset.page2AssetKey || element.dataset.page3AssetKey
  if (asset) return true
  if (!element.id || EXCLUDED_ID.test(element.id)) return false
  return ['a-image', 'a-video'].includes(tag)
    || (tag === 'a-plane' && /craft|floor|background|title|stage/i.test(element.id))
    || (tag === 'a-entity' && GROUP_ID.test(element.id))
}

const tunerMarkup = () => `
  <aside class="ar-layout-tuner" aria-label="AR素材位置调节器">
    <header>
      <strong>素材位置调节器</strong>
      <button type="button" data-layout-action="collapse" aria-label="折叠调节器">收起</button>
    </header>
    <div class="ar-layout-tuner-body">
      <p data-layout-page>请先扫描识别卡</p>
      <label>素材对象
        <select data-layout-entity><option value="">等待页面素材</option></select>
      </label>
      <label>调节步长
        <select data-layout-step>
          <option value="0.1">0.1</option>
          <option value="0.01">0.01</option>
          <option value="0.001" selected>0.001</option>
          <option value="0.0001">0.0001</option>
        </select>
      </label>
      ${GROUPS.map((group) => `
        <fieldset data-layout-group="${group}">
          <legend>${group === 'position' ? '位置 Position' : group === 'rotation' ? '旋转 Rotation' : '缩放 Scale'}</legend>
          <div>
            ${VECTOR_AXES.map((axis) => `
              <label>${axis.toUpperCase()}
                <input type="number" inputmode="decimal" data-layout-value="${group}.${axis}">
              </label>
            `).join('')}
          </div>
        </fieldset>
      `).join('')}
      <div class="ar-layout-tuner-actions">
        <button type="button" data-layout-action="reset-one">复位所选</button>
        <button type="button" data-layout-action="reset-page">复位本页</button>
        <button type="button" data-layout-action="save">保存到本机</button>
        <button type="button" data-layout-action="copy">复制本页参数</button>
      </div>
      <small data-layout-status>修改只在 layout=1 调节模式生效，不会自动改写源码。</small>
      <pre data-layout-output>{}</pre>
    </div>
  </aside>
`

export function createArLayoutTuner({ root, scene, signal }) {
  const THREE = window.AFRAME?.THREE
  if (!THREE) return { destroy() {} }

  root.insertAdjacentHTML('beforeend', tunerMarkup())
  const panel = root.querySelector('.ar-layout-tuner')
  const body = panel.querySelector('.ar-layout-tuner-body')
  const pageLabel = panel.querySelector('[data-layout-page]')
  const entitySelect = panel.querySelector('[data-layout-entity]')
  const stepSelect = panel.querySelector('[data-layout-step]')
  const status = panel.querySelector('[data-layout-status]')
  const output = panel.querySelector('[data-layout-output]')
  const elements = new Map()
  const initialTransforms = new Map()
  const runtimeTweaks = new Map()
  const storedPages = readStoredTweaks()
  let activePageIndex = -1
  let selectedKey = ''
  let refreshTimer = 0
  let enforcementFrame = 0
  let observer = null

  const routeFallback = () => {
    const route = new URLSearchParams(window.location.search).get('ar') || 'collection'
    return Object.prototype.hasOwnProperty.call(ROUTE_PAGE, route) ? ROUTE_PAGE[route] : -1
  }

  const getActivePageIndex = () => {
    const value = Number(root.querySelector('.page1-ar')?.dataset.activeTarget)
    return PAGE_META[value] ? value : routeFallback()
  }

  const pageTweaks = (pageIndex = activePageIndex) => {
    const entries = [...runtimeTweaks.entries()]
      .filter(([, value]) => value.pageIndex === pageIndex)
      .map(([runtimeKey, value]) => {
        const key = runtimeKey.slice(runtimeKey.indexOf(':') + 1)
        return [key, {
          label: value.label,
          position: value.position,
          rotation: value.rotation,
          scale: value.scale,
        }]
      })
    return Object.fromEntries(entries)
  }

  const renderOutput = () => {
    output.textContent = JSON.stringify({
      page: PAGE_META[activePageIndex]?.name || '未识别',
      transforms: pageTweaks(),
    }, null, 2)
  }

  const setStatus = (message) => {
    status.textContent = message
  }

  const getSelected = () => elements.get(selectedKey)?.element || null

  const syncInputs = () => {
    const transform = readTransform(getSelected(), THREE)
    panel.querySelectorAll('[data-layout-value]').forEach((input) => {
      const [group, axis] = input.dataset.layoutValue.split('.')
      const axisIndex = VECTOR_AXES.indexOf(axis)
      input.value = transform ? String(transform[group][axisIndex]) : ''
      input.disabled = !transform
      input.step = group === 'rotation' ? String(Math.max(0.1, finite(stepSelect.value, 0.001) * 100)) : stepSelect.value
    })
  }

  const collectElements = () => {
    const nextPageIndex = getActivePageIndex()
    const meta = PAGE_META[nextPageIndex]
    activePageIndex = meta ? nextPageIndex : -1
    pageLabel.textContent = meta?.name || '请先扫描识别卡'
    const scope = meta ? root.querySelector(meta.scope) : null
    const previousKey = selectedKey
    elements.clear()
    if (scope) {
      scope.querySelectorAll('a-image, a-video, a-plane, a-entity').forEach((element) => {
        if (!isTunableElement(element) || !element.object3D) return
        const key = getElementKey(element)
        if (!key || elements.has(key)) return
        const label = getElementLabel(element)
        elements.set(key, { element, label, pageIndex: activePageIndex })
        const initialKey = `${activePageIndex}:${key}`
        if (!initialTransforms.has(initialKey)) {
          initialTransforms.set(initialKey, readTransform(element, THREE))
        }
        const stored = storedPages?.[String(activePageIndex)]?.[key]
        if (stored && !runtimeTweaks.has(initialKey)) {
          runtimeTweaks.set(initialKey, {
            pageIndex: activePageIndex,
            label,
            position: stored.position,
            rotation: stored.rotation,
            scale: stored.scale,
          })
        }
      })
    }
    entitySelect.replaceChildren(
      ...([...elements.entries()].map(([key, item]) => {
        const option = document.createElement('option')
        option.value = key
        option.textContent = item.label
        return option
      })),
    )
    selectedKey = elements.has(previousKey) ? previousKey : elements.keys().next().value || ''
    entitySelect.value = selectedKey
    syncInputs()
    renderOutput()
  }

  const scheduleCollect = () => {
    window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(collectElements, 80)
  }

  const readInputs = () => {
    const transform = {}
    GROUPS.forEach((group) => {
      transform[group] = VECTOR_AXES.map((axis) =>
        finite(panel.querySelector(`[data-layout-value="${group}.${axis}"]`)?.value,
          group === 'scale' ? 1 : 0))
    })
    return transform
  }

  const updateSelected = () => {
    const item = elements.get(selectedKey)
    if (!item) return
    const transform = readInputs()
    const runtimeKey = `${activePageIndex}:${selectedKey}`
    runtimeTweaks.set(runtimeKey, {
      pageIndex: activePageIndex,
      label: item.label,
      ...transform,
    })
    writeTransform(item.element, transform, THREE)
    setStatus(`已实时调整：${item.label}`)
    renderOutput()
  }

  const resetOne = () => {
    const item = elements.get(selectedKey)
    if (!item) return
    const runtimeKey = `${activePageIndex}:${selectedKey}`
    const initial = initialTransforms.get(runtimeKey)
    runtimeTweaks.delete(runtimeKey)
    if (initial) writeTransform(item.element, initial, THREE)
    syncInputs()
    renderOutput()
    setStatus(`已复位：${item.label}`)
  }

  const resetPage = () => {
    for (const [key, item] of elements) {
      const runtimeKey = `${activePageIndex}:${key}`
      const initial = initialTransforms.get(runtimeKey)
      runtimeTweaks.delete(runtimeKey)
      if (initial) writeTransform(item.element, initial, THREE)
    }
    delete storedPages[String(activePageIndex)]
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, pages: storedPages }))
    } catch {
      // 本地存储不可用时，仍保留本次实时调节。
    }
    syncInputs()
    renderOutput()
    setStatus('已复位本页全部调节值')
  }

  const savePage = () => {
    storedPages[String(activePageIndex)] = pageTweaks()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, pages: storedPages }))
      setStatus('已保存到当前浏览器；仅在 layout=1 模式自动应用')
    } catch {
      setStatus('浏览器禁止本地存储，请使用“复制本页参数”')
    }
  }

  const copyPage = async () => {
    const value = output.textContent
    try {
      await navigator.clipboard.writeText(value)
      setStatus('本页参数已复制，可以直接发给 Codex')
    } catch {
      setStatus('自动复制失败，请长按下方参数手动复制')
    }
  }

  entitySelect.addEventListener('change', () => {
    selectedKey = entitySelect.value
    syncInputs()
  }, { signal })
  stepSelect.addEventListener('change', syncInputs, { signal })
  panel.querySelectorAll('[data-layout-value]').forEach((input) => {
    input.addEventListener('input', updateSelected, { signal })
  })
  panel.querySelector('[data-layout-action="reset-one"]').addEventListener('click', resetOne, { signal })
  panel.querySelector('[data-layout-action="reset-page"]').addEventListener('click', resetPage, { signal })
  panel.querySelector('[data-layout-action="save"]').addEventListener('click', savePage, { signal })
  panel.querySelector('[data-layout-action="copy"]').addEventListener('click', copyPage, { signal })
  panel.querySelector('[data-layout-action="collapse"]').addEventListener('click', (event) => {
    body.hidden = !body.hidden
    panel.classList.toggle('is-collapsed', body.hidden)
    event.currentTarget.textContent = body.hidden ? '展开' : '收起'
  }, { signal })

  const enforceTweaks = () => {
    for (const [runtimeKey, transform] of runtimeTweaks) {
      const separator = runtimeKey.indexOf(':')
      const pageIndex = Number(runtimeKey.slice(0, separator))
      const key = runtimeKey.slice(separator + 1)
      if (pageIndex !== activePageIndex) continue
      const item = elements.get(key)
      if (item) writeTransform(item.element, transform, THREE)
    }
    enforcementFrame = requestAnimationFrame(enforceTweaks)
  }

  observer = new MutationObserver(scheduleCollect)
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-active-target'] })
  scene.addEventListener('loaded', scheduleCollect, { signal })
  collectElements()
  enforcementFrame = requestAnimationFrame(enforceTweaks)

  signal?.addEventListener('abort', () => {
    window.clearTimeout(refreshTimer)
    cancelAnimationFrame(enforcementFrame)
    observer?.disconnect()
  }, { once: true })

  return {
    refresh: collectElements,
    destroy() {
      window.clearTimeout(refreshTimer)
      cancelAnimationFrame(enforcementFrame)
      observer?.disconnect()
      panel.remove()
    },
  }
}
