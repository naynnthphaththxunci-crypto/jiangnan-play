import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const outDir = process.argv[2] || '/tmp/jiangnan-shots'
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
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE', msg.text())
})
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__JIANGNAN__ && window.__JIANGNAN__.hotspot().w > 0)
await page.evaluate(() => document.fonts.ready)

async function point(x, y) {
  const mapped = await page.evaluate(
    (lx, ly) => {
      const canvas = document.querySelector('canvas')
      const rect = canvas.getBoundingClientRect()
      const frame = window.__JIANGNAN__.frame
      return {
        x: rect.left + (lx / frame.w) * rect.width,
        y: rect.top + (ly / frame.h) * rect.height,
      }
    },
    x,
    y,
  )
  return mapped
}

async function clickLogical(x, y) {
  const p = await point(x, y)
  await page.mouse.click(p.x, p.y)
}

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` })
  console.log('shot', name)
}

const hotspot = await page.evaluate(() => window.__JIANGNAN__.hotspot())
await shot('开局引导')
for (let i = 0; i < 8; i++) {
  const spot = await page.evaluate(() => {
    const r = window.__JIANGNAN__.hotspot()
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
  })
  await clickLogical(spot.x, spot.y)
  await new Promise((r) => setTimeout(r, 80))
}
await page.waitForFunction(() => window.__JIANGNAN__.state.openingStep === 8)
await page.evaluate(() => {
  window.__JIANGNAN__.cfg.economy.producerL2Chance = 0
})

async function cellOf(predSource) {
  return page.evaluate(predSource)
}

const steamer = await page.evaluate(() => {
  const state = window.__JIANGNAN__.state
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      const item = state.board[row][col]
      if (item && item.kind === 'producer') return window.__JIANGNAN__.cellCenter(row, col)
    }
  }
  return null
})
if (!steamer) throw new Error('no steamer')
for (let i = 0; i < 4; i++) {
  await clickLogical(steamer.x, steamer.y)
  await new Promise((r) => setTimeout(r, 420))
}

async function dragLogical(x1, y1, x2, y2, shotName, shotAt = 0.72) {
  const a = await point(x1, y1)
  const b = await point(x2, y2)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  if (shotName) {
    await page.mouse.move(a.x + (b.x - a.x) * shotAt, a.y + (b.y - a.y) * shotAt, { steps: 10 })
    await shot(shotName)
  }
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
  await new Promise((r) => setTimeout(r, 280))
}

const flours = await page.evaluate(() => {
  const found = []
  const state = window.__JIANGNAN__.state
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      const item = state.board[row][col]
      if (item && item.kind === 'product' && item.level === 1) {
        const center = window.__JIANGNAN__.cellCenter(row, col)
        found.push({ row, col, x: center.x, y: center.y })
      }
    }
  }
  return found
})
if (flours.length < 2) throw new Error('need two flour, got ' + flours.length)
const cornerA = await page.evaluate(() => window.__JIANGNAN__.cellCenter(0, 0))
const cornerB = await page.evaluate(() => window.__JIANGNAN__.cellCenter(0, 1))
await dragLogical(flours[0].x, flours[0].y, cornerA.x, cornerA.y)
await dragLogical(flours[1].x, flours[1].y, cornerB.x, cornerB.y)
await dragLogical(cornerA.x, cornerA.y, cornerB.x, cornerB.y, '棋盘拖动合成', 0.62)

async function mergePair(level) {
  const pair = await page.evaluate((lv) => {
    const found = []
    const state = window.__JIANGNAN__.state
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        const item = state.board[row][col]
        if (item && item.kind === 'product' && item.line === 'steamer' && item.level === lv) {
          found.push(window.__JIANGNAN__.cellCenter(row, col))
        }
      }
    }
    return found
  }, level)
  if (pair.length < 2) throw new Error('pair ' + level + ' missing ' + pair.length)
  const p1 = await point(pair[0].x, pair[0].y)
  const p2 = await point(pair[1].x, pair[1].y)
  await page.mouse.move(p1.x, p1.y)
  await page.mouse.down()
  await page.mouse.move(p2.x, p2.y, { steps: 8 })
  await page.mouse.up()
  await new Promise((r) => setTimeout(r, 500))
}

// first merge already done in the screenshot drag. Two flours left, plus one dough if the drag landed.
const levels = await page.evaluate(() => {
  const counts = {}
  for (const row of window.__JIANGNAN__.state.board) {
    for (const item of row) {
      if (item && item.kind === 'product') counts[item.level] = (counts[item.level] || 0) + 1
    }
  }
  return counts
})
console.log('after first drag', levels)
if ((levels[1] || 0) >= 2) await mergePair(1)
if ((await page.evaluate(() => window.__JIANGNAN__.state.board.flat().filter((item) => item && item.kind === 'product' && item.level === 2).length)) >= 2) {
  await mergePair(2)
}

const bun = await page.evaluate(() => {
  const state = window.__JIANGNAN__.state
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      const item = state.board[row][col]
      if (item && item.kind === 'product' && item.level === 3) return window.__JIANGNAN__.cellCenter(row, col)
    }
  }
  return null
})
if (!bun) throw new Error('no bun ' + JSON.stringify(levels))
const order = await page.evaluate(() => {
  const rect = window.__JIANGNAN__.orders()[0]
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
})
const bunPt = await point(bun.x, bun.y)
const orderPt = await point(order.x, order.y)
await page.mouse.move(bunPt.x, bunPt.y)
await page.mouse.down()
await page.mouse.move(orderPt.x, orderPt.y, { steps: 10 })
await page.mouse.up()
await new Promise((r) => setTimeout(r, 280))
await shot('交单铜钱飞入')
await page.waitForFunction(() => window.__JIANGNAN__.state.openingStep === 9 && window.__JIANGNAN__.frame.sheetBtn.w > 0, { timeout: 4000 })
const sheet = await page.evaluate(() => {
  const r = window.__JIANGNAN__.buttons().sheet
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
})
await clickLogical(sheet.x, sheet.y)
await page.waitForFunction(() => window.__JIANGNAN__.state.tasksDone.includes('t1'))
await page.waitForFunction(() => window.__JIANGNAN__.buttons().house.w > 20)
const house = await page.evaluate(() => {
  const r = window.__JIANGNAN__.buttons().house
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
})
await clickLogical(house.x, house.y)
await page.waitForFunction(() => window.__JIANGNAN__.view === 'house', { timeout: 3000 })
await new Promise((r) => setTimeout(r, 250))
await shot('茶楼修缮')

const summary = await page.evaluate(() => ({
  tasks: window.__JIANGNAN__.state.tasksDone,
  phase: window.__JIANGNAN__.state.phase,
  coins: window.__JIANGNAN__.state.coins,
  xp: window.__JIANGNAN__.state.xp,
  orders: window.__JIANGNAN__.state.orders.length,
  view: window.__JIANGNAN__.view,
  tuner: window.__JIANGNAN__.frame.showTuner,
}))
console.log(JSON.stringify(summary))
if (!summary.tasks.includes('t1')) throw new Error('first task not done')
if (summary.tuner) throw new Error('tuner open')
await browser.close()
console.log('playthrough ok', hotspot.w)
