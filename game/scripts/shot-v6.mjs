import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const outDir = process.argv[2] || '/opt/cursor/artifacts'
mkdirSync(outDir, { recursive: true })
const url = process.argv[3] || 'http://127.0.0.1:47321/'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
})
const page = await browser.newPage()
page.on('pageerror', (err) => console.log('PAGEERROR', err.message))
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__JIANGNAN__)
await page.evaluate(() => document.fonts.ready)
await new Promise((r) => setTimeout(r, 250))

async function shot(name) {
  await new Promise((r) => setTimeout(r, 120))
  await page.screenshot({ path: `${outDir}/${name}.png` })
  console.log(name)
}

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const state = game.state
  state.phase = 'play'
  state.openingStep = 99
  state.storySeen = true
  state.levelModal = null
  state.notice = null
  state.guide = 'none'
  state.orders = [
    {
      id: 'shot',
      customerId: 'xiaotao',
      big: false,
      slots: [{ line: 'steamer', level: 1, filled: false }],
    },
  ]
  game.setView('board')
})
await shot('开局棋盘')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const state = game.state
  state.rewards = [
    { uid: 'r1', kind: 'rewardBox', box: 'blue' },
    { uid: 'r2', kind: 'potion', tier: 3 },
    { uid: 'r3', kind: 'gem', tier: 2 },
  ]
  state.board[4][2] = { uid: 'b1', kind: 'product', line: 'steamer', level: 3 }
  state.board[4][4] = { uid: 'b2', kind: 'product', line: 'steamer', level: 2 }
  state.orders = [
    {
      id: 'ready',
      customerId: 'xiaotao',
      big: false,
      readyAt: 1,
      slots: [
        { line: 'steamer', level: 3, filled: false },
        { line: 'steamer', level: 2, filled: false },
      ],
    },
    {
      id: 'wait',
      customerId: 'scholar',
      big: false,
      slots: [{ line: 'steamer', level: 5, filled: false }],
    },
  ]
  game.setView('board')
})
await shot('订单栏')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const state = game.state
  state.coins = 32
  state.level = 2
  state.guide = 'buildBtn'
  state.notice = null
  game.setView('board')
})
await shot('建造引导遮罩')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const state = game.state
  state.guide = 'smile'
  state.smiles = 12
  state.playStartedAt = 0
  game.setView('board')
})
await shot('笑脸领取')

await browser.close()
