import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const outDir = '/tmp/jiangnan-allen'
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
await page.waitForFunction(() => window.__JIANGNAN__ && window.__JIANGNAN__.state.phase === 'story')

async function point(x, y) {
  return page.evaluate((lx, ly) => {
    const rect = document.querySelector('canvas').getBoundingClientRect()
    const frame = window.__JIANGNAN__.frame
    return { x: rect.left + (lx / frame.w) * rect.width, y: rect.top + (ly / frame.h) * rect.height }
  }, x, y)
}
async function clickLogical(x, y) {
  const p = await point(x, y)
  await page.mouse.click(p.x, p.y)
}
async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` })
  console.log('shot', name)
}

await shot('剧情步只亮热点')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  game.state.phase = 'play'
  game.state.storySeen = true
  game.state.locks = []
  for (const row of game.state.board) row.fill(null)
  const place = (row, col, level) => {
    game.state.board[row][col] = {
      uid: `p${level}-${col}`,
      kind: 'producer',
      producerId: 'steamer',
      line: 'steamer',
      level,
      charges: 32,
      cooldownUntil: 0,
    }
  }
  place(3, 2, 1)
  place(3, 3, 1)
  place(4, 2, 2)
  place(4, 4, 3)
})
await new Promise((r) => setTimeout(r, 80))
await shot('母棋1到3级占位')

const low = await page.evaluate(() => window.__JIANGNAN__.cellCenter(3, 2))
await clickLogical(low.x, low.y)
await new Promise((r) => setTimeout(r, 60))
await shot('点1级母棋不出子')

const info = await page.evaluate(() => {
  const r = window.__JIANGNAN__.frame.chainBtn
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w }
})
await clickLogical(info.x, info.y)
await new Promise((r) => setTimeout(r, 80))
await shot('母棋图鉴1到8')
await clickLogical(30, 30)

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  game.state.level = 5
  game.state.storageOpen = true
  game.state.storageLesson = 2
  game.state.phase = 'play'
  game.state.board[5][3] = { uid: 'flour-hint', kind: 'product', line: 'steamer', level: 1 }
})
await page.waitForFunction(() => {
  const pose = window.__JIANGNAN__.hand && window.__JIANGNAN__.frame.pendingBtn.w > 0
  return pose
})
await new Promise((r) => setTimeout(r, 200))
await shot('升5级暂存教学')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const step = game.cfg.copy.tutorial.findIndex((entry) => entry.id === 'build')
  game.state.phase = 'opening'
  game.state.openingStep = step
  game.state.storageLesson = 4
})
await page.waitForFunction(() => {
  const hand = window.__JIANGNAN__.hand()
  return hand?.visible && window.__JIANGNAN__.frame.houseBtn.w > 0
})
await shot('教学指向右下角建造')

await browser.close()
console.log('done')
