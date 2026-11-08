import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const outDir = '/tmp/jiangnan-shots3'
mkdirSync(outDir, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  protocolTimeout: 30000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})
const page = await browser.newPage()
page.on('pageerror', (err) => console.log('PAGEERROR', err.message))

async function boot(width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.goto('http://127.0.0.1:47321/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => window.__JIANGNAN__ && window.__JIANGNAN__.state.phase === 'story')
}
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

await boot(375, 667)
await shot('开局剧情书房')
for (let i = 0; i < 7; i++) {
  await clickLogical(180, 500)
  await new Promise((r) => setTimeout(r, 40))
}
await page.waitForFunction(() => window.__JIANGNAN__.state.storyStep === 7)
await shot('开局剧情点心铺')
await clickLogical(180, 420)
const after = await page.evaluate(() => ({ phase: window.__JIANGNAN__.state.phase, step: window.__JIANGNAN__.state.storyStep }))
console.log('after shop click', after)
await page.waitForFunction(() => window.__JIANGNAN__.state.phase === 'opening' && window.__JIANGNAN__.frame.enterBtn.w > 20)
const enter = await page.evaluate(() => {
  const r = window.__JIANGNAN__.frame.enterBtn
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w }
})
console.log('enter', enter)
await clickLogical(enter.x, enter.y)
await page.waitForFunction(() => window.__JIANGNAN__.state.openingStep === 1)
await page.waitForFunction(() => {
  const hand = window.__JIANGNAN__.hand()
  if (!hand?.visible) return false
  const a = window.__JIANGNAN__.cellCenter(3, 2)
  const b = window.__JIANGNAN__.cellCenter(3, 3)
  return Math.hypot(hand.x - (a.x + b.x) / 2, hand.y - (a.y + b.y) / 2) < 22
})
await shot('合并步骤白手拖动')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const talk = game.cfg.copy.tutorial.findIndex((step) => step.id === 'stashTalk')
  game.state.phase = 'opening'
  game.state.openingStep = talk
  game.state.storageOpen = true
})
await new Promise((r) => setTimeout(r, 80))
await shot('对话步骤点击任意处继续')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const step = game.cfg.copy.tutorial.findIndex((entry) => entry.id === 'stashIn')
  game.state.openingStep = step
  game.state.storageOpen = true
})
await page.waitForFunction(() => {
  const hand = window.__JIANGNAN__.hand()
  return hand?.visible
})
await shot('暂存区教学白手')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  game.state.phase = 'play'
  game.state.storySeen = true
  game.state.storageOpen = true
  game.state.sale = null
  game.state.orders = [
    { id: 'full', customerId: 'xiaotao', big: false, slots: [{ line: 'steamer', level: 3, filled: false }] },
    {
      id: 'part',
      customerId: 'teaGuest',
      big: false,
      slots: [
        { line: 'tea', level: 3, filled: false },
        { line: 'tea', level: 3, filled: false },
      ],
    },
  ]
  game.state.board[1][0] = null
  game.state.locks = game.state.locks.filter((lock) => !(lock.row === 1 && lock.col === 0))
  game.state.board[4][4] = { uid: 'bun-a', kind: 'product', line: 'steamer', level: 3 }
  game.state.board[5][3] = { uid: 'bun-b', kind: 'product', line: 'steamer', level: 3 }
  game.state.board[4][2] = { uid: 'tea-a', kind: 'product', line: 'tea', level: 3 }
  game.state.board[5][2] = { uid: 'flour', kind: 'product', line: 'steamer', level: 1 }
  game.state.seen.steamer = [1, 2, 3]
  game.state.seen.tea = [3]
  const lock = game.state.locks.find((entry) => entry.row === 6 && entry.col === 2)
  if (lock) lock.buried = { kind: 'product', line: 'steamer', level: 1 }
})
await new Promise((r) => setTimeout(r, 60))
const tea = await page.evaluate(() => window.__JIANGNAN__.cellCenter(4, 2))
await clickLogical(tea.x, tea.y)
await new Promise((r) => setTimeout(r, 80))
await shot('主界面自由玩-750x1334')
await shot('卖出说明栏')
const icon = await page.evaluate(() => {
  const hit = window.__JIANGNAN__.frame.orderIcons[0]
  return { x: hit.rect.x + hit.rect.w / 2, y: hit.rect.y + hit.rect.h / 2 }
})
await clickLogical(icon.x, icon.y)
await new Promise((r) => setTimeout(r, 80))
await shot('子棋图鉴')
await clickLogical(20, 20)
await new Promise((r) => setTimeout(r, 40))

await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await new Promise((r) => setTimeout(r, 200))
await shot('主界面自由玩-1080x2340')

await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await new Promise((r) => setTimeout(r, 120))
const sell = await page.evaluate(() => {
  const r = window.__JIANGNAN__.frame.sellBtn
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
})
await clickLogical(sell.x, sell.y)
await new Promise((r) => setTimeout(r, 80))
await page.evaluate(() => {
  window.__JIANGNAN__.fx.toasts.length = 0
})
await shot('撤回说明栏')

const prod = await page.evaluate(() => window.__JIANGNAN__.cellCenter(4, 3))
await clickLogical(prod.x, prod.y)
await new Promise((r) => setTimeout(r, 80))
const info = await page.evaluate(() => {
  const r = window.__JIANGNAN__.frame.chainBtn
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
})
await clickLogical(info.x, info.y)
await new Promise((r) => setTimeout(r, 80))
await page.evaluate(() => {
  window.__JIANGNAN__.fx.toasts.length = 0
})
await shot('母棋图鉴')

await browser.close()
console.log('done')
