import { defineConfig } from 'vite'
import { execFileSync } from 'node:child_process'

const GITHUB_PAGES_BASE = '/tongliang-fire-dragon-ar/'

const readGitSha = () => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? GITHUB_PAGES_BASE : '/',
  define: {
    __BUILD_META__: JSON.stringify({
      gitSha: readGitSha(),
      buildTime: new Date().toISOString(),
    }),
  },
})
