import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// 微信小游戏没有 DOM，打成一个 IIFE，入口自己调用 wx.createCanvas。
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-wx',
    emptyOutDir: true,
    target: 'es2017',
    minify: true,
    assetsInlineLimit: 1024 * 1024,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'src/wx-main.ts'),
      output: {
        format: 'iife',
        name: 'JiangnanGame',
        entryFileNames: 'game.js',
        inlineDynamicImports: true,
      },
    },
  },
})
