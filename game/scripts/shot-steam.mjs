import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const outDir = '/tmp/jiangnan-steam'
mkdirSync(outDir, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  protocolTimeout: 30000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})
const page = await browser.newPage()
page.on('pageerror', (err) => console.log('PAGEERROR', err.message))
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto('http://127.0.0.1:47321/', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__JIANGNAN__)

async function point(x, y) {
  return page.evaluate((lx, ly) => {
    const rect = document.querySelector('canvas').getBoundingClientRect()
    const frame = window.__JIANGNAN__.frame
    return { x: rect.left + (lx / frame.w) * rect.width, y: rect.top + (ly / frame.h) * rect.height }
  }, x, y)
}
async function drag(a, b) {
  const pa = await point(a.x, a.y)
  const pb = await point(b.x, b.y)
  await page.mouse.move(pa.x, pa.y)
  await page.mouse.down()
  await page.mouse.move(pb.x, pb.y, { steps: 12 })
  await page.mouse.up()
}
async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` })
  console.log('shot', name)
}
function pair(level) {
  return page.evaluate((lv) => {
    const cells = []
    const board = window.__JIANGNAN__.state.board
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        const item = board[row][col]
        if (item && item.kind === 'producer' && item.producerId === 'steamer' && item.level === lv) {
          cells.push(window.__JIANGNAN__.cellCenter(row, col))
        }
      }
    }
    return cells
  }, level)
}

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const step = game.cfg.copy.tutorial.findIndex((entry) => entry.id === 'producerL2')
  game.state.phase = 'opening'
  game.state.openingStep = step
  game.state.storySeen = true
})
await page.waitForFunction(() => {
  const hand = window.__JIANGNAN__.hand()
  return hand?.visible
})
await shot('教学合成母棋到2级')

let ones = await pair(1)
await drag(ones[0], ones[1])
await page.waitForFunction(() => {
  const id = window.__JIANGNAN__.cfg.copy.tutorial[window.__JIANGNAN__.state.openingStep]?.id
  return id === 'producerL3'
})
await page.waitForFunction(() => window.__JIANGNAN__.hand()?.visible)
await shot('教学合成母棋到3级')

ones = await pair(1)
await drag(ones[0], ones[1])
await new Promise((r) => setTimeout(r, 80))
const twos = await pair(2)
await drag(twos[0], twos[1])
await page.waitForFunction(() => window.__JIANGNAN__.cfg.copy.tutorial[window.__JIANGNAN__.state.openingStep]?.id === 'produce')
const ready = await page.evaluate(() => {
  const board = window.__JIANGNAN__.state.board
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const item = board[row][col]
      if (item && item.kind === 'producer' && item.level >= 3) return window.__JIANGNAN__.cellCenter(row, col)
    }
  }
  return null
})
const p = await point(ready.x, ready.y)
await page.mouse.click(p.x, p.y)
await page.waitForFunction(() => window.__JIANGNAN__.cfg.copy.tutorial[window.__JIANGNAN__.state.openingStep]?.id === 'deliver')
await new Promise((r) => setTimeout(r, 200))
await shot('点3级母棋产出成功')

await browser.close()
console.log('done')
