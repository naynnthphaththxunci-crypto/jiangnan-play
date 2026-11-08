import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const outDir = '/tmp/jiangnan-shots2'
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
await page.waitForFunction(() => window.__JIANGNAN__ && window.__JIANGNAN__.frame.enterBtn.w > 0)

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
async function center(row, col) {
  return page.evaluate((r, c) => window.__JIANGNAN__.cellCenter(r, c), row, col)
}

await shot('强制教学黑屏遮罩')
const enter = await page.evaluate(() => {
  const r = window.__JIANGNAN__.frame.enterBtn
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
})
await clickLogical(enter.x, enter.y)
await page.waitForFunction(() => window.__JIANGNAN__.state.openingStep === 1)
const a = await center(3, 2)
const b = await center(3, 3)
const pa = await point(a.x, a.y)
const pb = await point(b.x, b.y)
await page.mouse.move(pa.x, pa.y)
await page.mouse.down()
await page.mouse.move(pb.x, pb.y, { steps: 8 })
await page.mouse.up()
await page.waitForFunction(() => window.__JIANGNAN__.state.openingStep === 2)
const lock = await center(3, 4)
const dough = await page.evaluate(() => {
  const state = window.__JIANGNAN__.state
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 7; col++) {
      const item = state.board[row][col]
      if (item && item.kind === 'product' && item.level === 2) return window.__JIANGNAN__.cellCenter(row, col)
    }
  }
  return null
})
if (!dough) throw new Error('no dough')
const pd = await point(dough.x, dough.y)
const pl = await point(lock.x, lock.y)
await page.mouse.move(pd.x, pd.y)
await page.mouse.down()
await page.mouse.move(pd.x + (pl.x - pd.x) * 0.62, pd.y + (pl.y - pd.y) * 0.62, { steps: 8 })
await shot('合并解锁锁格')
await page.mouse.move(pl.x, pl.y, { steps: 6 })
await page.mouse.up()
await page.waitForFunction(() => window.__JIANGNAN__.state.openingStep === 3)
const prod = await center(4, 3)
await clickLogical(prod.x, prod.y)
await page.waitForFunction(() => window.__JIANGNAN__.state.openingStep === 4)
await new Promise((r) => setTimeout(r, 200))
await shot('订单绿色完成按钮')

const done = await page.evaluate(() => {
  const rect = window.__JIANGNAN__.orders()[0]
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h - 12 }
})
await clickLogical(done.x, done.y)
await page.waitForFunction(() => window.__JIANGNAN__.state.openingStep === 5)
const skip = await page.evaluate(() => {
  const r = window.__JIANGNAN__.skip()
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
})
await clickLogical(skip.x, skip.y)
await page.waitForFunction(() => window.__JIANGNAN__.state.phase === 'play')
await page.waitForFunction(() => window.__JIANGNAN__.frame.helpOk.w > 0)
const help = await page.evaluate(() => {
  const r = window.__JIANGNAN__.frame.helpOk
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w }
})
if (help.w > 0) {
  await clickLogical(help.x, help.y)
  await page.waitForFunction(() => !window.__JIANGNAN__.state.showHelp)
}

await new Promise((r) => setTimeout(r, 900))
await page.evaluate(() => {
  const game = window.__JIANGNAN__
  game.cfg.economy.smileUiAfterMs = 0
  game.state.smiles = 12
  game.state.orders = [
    { id: 'need', customerId: 'xiaotao', big: false, slots: [{ line: 'steamer', level: 3, filled: false }] },
  ]
})
await new Promise((r) => setTimeout(r, 100))
const smile = await page.evaluate(() => ({ x: window.__JIANGNAN__.frame.w / 2, y: window.__JIANGNAN__.frame.hud.y + window.__JIANGNAN__.frame.hud.h - 8 }))
await clickLogical(smile.x, smile.y)
await page.waitForFunction(() => window.__JIANGNAN__.state.smileModal)
await shot('笑脸开奖')
await page.evaluate(() => {
  window.__JIANGNAN__.state.smileModal = null
})

await page.evaluate(() => {
  window.__JIANGNAN__.state.coins = 1000
  window.__JIANGNAN__.state.xp = 30
  window.__JIANGNAN__.state.level = 1
  window.__JIANGNAN__.state.levelModal = {
    level: 2,
    rewards: [
      { id: 'blue', name: '蓝宝箱' },
      { id: 'purple', name: '紫礼盒' },
      { id: 'bag', name: '购物袋' },
    ],
  }
})
await new Promise((r) => setTimeout(r, 150))
await shot('升级奖励弹窗')
await page.evaluate(() => {
  window.__JIANGNAN__.state.levelModal = null
  window.__JIANGNAN__.state.level = 2
})
const infoCell = await center(0, 0)
await clickLogical(infoCell.x, infoCell.y)
await new Promise((r) => setTimeout(r, 200))
await shot('底部物品说明')

const check = await page.evaluate(() => ({
  rows: window.__JIANGNAN__.state.board.length,
  cols: window.__JIANGNAN__.state.board[0].length,
  info: window.__JIANGNAN__.frame.infoBar.h,
}))
console.log(JSON.stringify(check))
await browser.close()
