import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const dist = resolve(import.meta.dirname, '../dist')
const htmlPath = resolve(dist, 'index.html')
let html = readFileSync(htmlPath, 'utf8')

html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  const css = readFileSync(resolve(dist, href.replace(/^\.\//, '')), 'utf8')
  const safe = css.replace(/<\/style/gi, '<\\/style')
  return `<style>${safe}</style>`
})

html = html.replace(/<script type="module"[^>]*src="([^"]+)"><\/script>/g, (_, src) => {
  let js = readFileSync(resolve(dist, src.replace(/^\.\//, '')), 'utf8')
  const embed = (name) => {
    const file = [resolve(dist, 'assets', name), resolve(dist, name)].find((path) => {
      try {
        readFileSync(path)
        return true
      } catch {
        return false
      }
    })
    if (!file) throw new Error(`missing portrait ${name}`)
    const mime = name.endsWith('.webp') ? 'image/webp' : 'image/png'
    return `data:${mime};base64,${readFileSync(file).toString('base64')}`
  }
  // Vite 把超过内联上限的图写成 new URL(`file.png`, import.meta.url).href。
  // 换成 data URL 时必须连同 .href 一起换掉，否则读到的是字符串的 href，图一直是空的。
  js = js.replace(/new URL\(`(?:assets\/)?([^`]+\.(?:png|webp))`,\s*import\.meta\.url\)(?:\.href)?/g, (_, name) => `\`${embed(name)}\``)
  js = js.replace(/(?:\.\.\/|\.\/|\/)?assets\/[A-Za-z0-9._-]+\.png/g, (match) => {
    const rel = match.replace(/^\.\.\//, '').replace(/^\.\//, '').replace(/^\//, '')
    return embed(rel.split('/').pop())
  })
  const safe = js.replace(/<\/script/gi, '<\\/script')
  return `<script type="module">${safe}</script>`
})

const out = process.argv[2] || resolve(dist, 'jiangnan.html')
writeFileSync(out, html)
console.log(out, html.length)
