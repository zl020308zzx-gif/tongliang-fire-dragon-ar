import { defineConfig } from 'vite'

const GITHUB_PAGES_BASE = '/tongliang-fire-dragon-ar/'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? GITHUB_PAGES_BASE : '/',
})
