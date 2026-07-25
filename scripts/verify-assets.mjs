import { execFileSync } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configFiles = {
  page1: path.join(workspace, 'src', 'config.js'),
  page2: path.join(workspace, 'src', 'page2', 'page2-config.js'),
  page3: path.join(workspace, 'src', 'page3', 'page3-config.js'),
}

const matches = (source, expression) =>
  [...source.matchAll(expression)].map((match) => match[1])

const normalizeAssetPath = (assetPath) =>
  String(assetPath).replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '')

const collectConfiguredAssets = async () => {
  const [page1, page2, page3] = await Promise.all(
    Object.values(configFiles).map((file) => readFile(file, 'utf8')),
  )
  const assets = new Set()
  const add = (assetPath) => assets.add(normalizeAssetPath(assetPath))

  matches(page1, /\$\{PAGE1_DIRECTORY\}\/([^`'"]+)/g)
    .forEach((file) => {
      add(`assets/page1/images/page1/${file}`)
      add(`assets/page1-mobile/images/page1/${file}`)
    })
  matches(page1, /assetUrl\(['"]([^'"]+)['"]\)/g).forEach(add)

  matches(page2, /page2Asset\(['"]([^'"]+)['"]\)/g).forEach((file) => {
    add(`assets/page2/${file}`)
    add(`assets/page2-mobile/${file}`)
  })
  matches(page2, /assetUrl\(['"]([^'"]+)['"]\)/g).forEach(add)

  matches(page3, /page3ImageAsset\(['"]([^'"]+)['"]\)/g).forEach((file) => {
    add(`assets/page3/${file}`)
    add(`assets/page3-mobile/${file}`)
  })
  matches(page3, /page3Asset\(['"]([^'"]+)['"]\)/g).forEach((file) => add(`assets/page3/${file}`))
  matches(page3, /assetUrl\(['"]([^'"]+)['"]\)/g).forEach(add)

  return [...assets]
    .filter((assetPath) => assetPath.startsWith('assets/') && path.posix.extname(assetPath))
    .sort()
}

const assertExactCase = async (root, relativePath) => {
  let current = root
  for (const segment of relativePath.split('/')) {
    const entries = await readdir(current)
    if (!entries.includes(segment)) {
      const caseInsensitive = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase())
      const detail = caseInsensitive ? `（实际大小写：${caseInsensitive}）` : ''
      throw new Error(`路径大小写或文件缺失：${relativePath}${detail}`)
    }
    current = path.join(current, segment)
  }
  return current
}

const isGitTracked = (relativePath) => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', `public/${relativePath}`], {
      cwd: workspace,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

const verifyOne = async (relativePath) => {
  const segments = relativePath.split('/')
  for (let index = 1; index < segments.length; index += 1) {
    if (segments[index] === segments[index - 1]) {
      throw new Error(`路径包含意外重复目录：${relativePath}`)
    }
  }
  const publicFile = await assertExactCase(path.join(workspace, 'public'), relativePath)
  const distFile = await assertExactCase(path.join(workspace, 'dist'), relativePath)
  const [publicInfo, distInfo] = await Promise.all([stat(publicFile), stat(distFile)])
  if (!publicInfo.isFile() || publicInfo.size <= 0) throw new Error(`public 资产为空：${relativePath}`)
  if (!distInfo.isFile() || distInfo.size <= 0) throw new Error(`dist 资产为空：${relativePath}`)
  if (!isGitTracked(relativePath)) throw new Error(`资产未被 Git 跟踪：public/${relativePath}`)
  return { relativePath, publicBytes: publicInfo.size, distBytes: distInfo.size }
}

const assets = await collectConfiguredAssets()
const results = []
const failures = []
for (const assetPath of assets) {
  try {
    results.push(await verifyOne(assetPath))
  } catch (error) {
    failures.push(error.message)
  }
}

const focusPaths = new Set([
  'assets/page1/images/page1/01-lineart.png',
  'assets/page3-mobile/title/page3-title-fire-night.png',
])
results
  .filter(({ relativePath }) => focusPaths.has(relativePath))
  .forEach(({ relativePath, publicBytes, distBytes }) => {
    console.log(`[verify-assets] ${relativePath}: public=${publicBytes} bytes, dist=${distBytes} bytes`)
  })

if (failures.length) {
  console.error(`[verify-assets] FAILED (${failures.length}/${assets.length})`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(`[verify-assets] OK: ${results.length} configured assets verified in public, dist, and Git`)
}
