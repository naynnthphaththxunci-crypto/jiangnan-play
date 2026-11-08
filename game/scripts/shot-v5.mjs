import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const outDir = process.argv[2] || '/opt/cursor/artifacts'
mkdirSync(outDir, { recursive: true })
const url = process.argv[3] || 'http://127.0.0.1:47321/'

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  protocolTimeout: 30000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
})
const page = await browser.newPage()
page.on('pageerror', (err) => console.log('PAGEERROR', err.message))
await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__JIANGNAN__)
await page.evaluate(() => document.fonts.ready)
await new Promise((resolve) => setTimeout(resolve, 200))

async function shot(name) {
  await new Promise((resolve) => setTimeout(resolve, 80))
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
  state.rewards = [
    { uid: 'r1', kind: 'rewardBox', box: 'bag' },
    { uid: 'r2', kind: 'potion', tier: 4 },
    { uid: 'r3', kind: 'gem', tier: 1 },
  ]
  game.setView('board')
})
await shot('奖励框')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const state = game.state
  state.board[2][1] = { uid: 'pot', kind: 'potion', tier: 4 }
  state.armed = { row: 2, col: 1 }
  state.chainPop = { kind: 'potion', tier: 4 }
  game.setView('board')
  game.select(2, 1)
})
await shot('等级链小窗')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const state = game.state
  state.chainPop = null
  state.armed = null
  state.coins = 0
  state.decorate = null
  state.tasksDone = []
  game.setView('house')
})
await shot('建造页返回引导')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const state = game.state
  state.coins = 100
  state.tasksDone = ['t1']
  state.decorate = { taskId: 't1', index: 1 }
  game.setView('house')
})
await shot('装修选择窗')

await page.evaluate(() => {
  const game = window.__JIANGNAN__
  const state = game.state
  state.decorate = null
  state.chainPop = null
  state.armed = null
  state.level = 5
  state.xp = 180
  state.storageOpen = true
  state.storageLesson = 1
  state.phase = 'play'
  game.setView('board')
  game.select(2, 5)
})
await shot('暂存解锁')

await browser.close()
