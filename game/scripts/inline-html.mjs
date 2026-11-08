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
    return `data:image/png;base64,${readFileSync(file).toString('base64')}`
  }
  js = js.replace(/new URL\(`(?:assets\/)?([^`]+\.png)`,\s*import\.meta\.url\)/g, (_, name) => `\`${embed(name)}\``)
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
