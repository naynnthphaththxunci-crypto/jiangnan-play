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
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__JIANGNAN__)
await page.evaluate(() => document.fonts.ready)

function order(id, customerId, slots) {
  return { id, customerId, big: false, chest: false, slots: slots.map(([line, level]) => ({ line, level, filled: false })) }
}

async function stage(orders, ready) {
  await page.evaluate(
    ({ orders, ready }) => {
      const game = window.__JIANGNAN__
      const state = game.state
      state.phase = 'play'
      state.storySeen = true
      state.openingStep = 99
      state.guide = 'none'
      state.levelModal = null
      state.buildStory = null
      state.notice = null
      state.chestLesson = 3
      state.producerLesson = null
      state.smileModal = null
      state.decorate = null
      state.giftPrompt = null
      state.orders = orders
      if (ready) {
        const cell = state.board[4][2]
        state.board[4][2] = { uid: 'shot-ready', kind: 'product', line: ready[0], level: ready[1] }
        void cell
      }
    },
    { orders, ready },
  )
  await new Promise((r) => setTimeout(r, 700))
}

async function save(name) {
  const canvas = await page.$('#game')
  await canvas.screenshot({ path: `${outDir}/${name}.png` })
  console.log(name)
}

await stage(
  [
    order('a', 'teaGuest', [['steamer', 3], ['steamer', 4]]),
    order('b', 'scholar', [['tea', 3]]),
    order('c', 'embroider', [['bamboo', 3]]),
  ],
  ['tea', 3],
)
await save('order-portraits')

await stage(
  [
    order('d', 'boatman', [['steamer', 3]]),
    order('e', 'squire', [['bamboo', 3], ['bamboo', 4]]),
    order('f', 'xiaotao', [['steamer', 5]]),
  ],
  ['steamer', 3],
)
await save('order-placeholders')

await stage(
  [
    order('g', 'teaGuest', [['steamer', 3]]),
    order('h', 'boatman', [['tea', 3]]),
  ],
  ['steamer', 3],
)
await page.evaluate(() => window.__JIANGNAN__.select(4, 3))
await new Promise((r) => setTimeout(r, 200))
await save('order-screen')

await browser.close()
