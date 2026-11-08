import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import {
  allTasks,
  buildTask,
  confirmDecor,
  createGame,
  dropItem,
  fillOrders,
  findEmpty,
  makeProducer,
  makeRewardBox,
  mulberry32,
  nextTask,
  openCellCount,
  openRewardBox,
  pressFirst,
  tapProducer,
} from '../src/logic/sim'

const CHOICES = ['t1', 't2', 't3', 't4', 't6', 't10', 't11']

describe('第七轮', () => {
  it('每个三选一修缮都能点确定并进入下一项', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.coins = 100_000
    state.levelModal = { level: 2, rewards: [] }
    state.storageLesson = 1
    state.guide = 'backBtn'
    const rng = mulberry32(3)
    const done: string[] = []
    while (nextTask(state, cfg)) {
      const task = nextTask(state, cfg)
      if (!task) break
      const before = state.coins
      const result = buildTask(state, task.id, null, cfg, rng, done.length + 1)
      expect(result.ok).toBe(true)
      expect(state.coins).toBe(before - task.price)
      if (task.choices?.length) {
        expect(state.decorate?.taskId).toBe(task.id)
        expect(pressFirst(state, 'house')).toBe('decor')
        expect(confirmDecor(state, cfg).ok).toBe(true)
        expect(state.decorate).toBeNull()
        expect(state.styles[task.id]).toBeTruthy()
        expect(state.buildStory?.taskId).toBe(task.id)
        state.buildStory = null
      }
      done.push(task.id)
      while (state.levelModal) state.levelModal = state.levelQueue.shift() ?? null
    }
    expect(done).toEqual(allTasks(cfg).map((task) => task.id))
    for (const id of CHOICES) expect(state.styles[id]).toBeTruthy()
    expect(nextTask(state, cfg)).toBeNull()
  })

  it('宝箱点一次只出一个，落到旁边，点空才消失', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    const spot = findEmpty(state)[0]
    if (!spot) throw new Error('no empty')
    const box = makeRewardBox(state, cfg, mulberry32(1), 'purple')
    if (box.kind !== 'rewardBox' || !box.drops) throw new Error('box')
    const total = box.drops.length
    expect(total).toBe(cfg.economy.purpleBoxCount)
    state.board[spot.row][spot.col] = box
    const before = state.board.flat().filter(Boolean).length
    expect(openRewardBox(state, spot, cfg, mulberry32(2)).ok).toBe(true)
    expect(state.board[spot.row]?.[spot.col]?.kind).toBe('rewardBox')
    expect(box.drops.length).toBe(total - 1)
    expect(state.board.flat().filter(Boolean).length).toBeGreaterThan(before)
    let guard = 0
    while (state.board[spot.row]?.[spot.col]?.kind === 'rewardBox' && guard < 8) {
      openRewardBox(state, spot, cfg, mulberry32(3))
      guard += 1
    }
    expect(state.board[spot.row]?.[spot.col]).toBeNull()
  })

  it('解锁多条链之后订单不会全挤在蒸笼上', () => {
    const cfg = defaultConfig()
    cfg.economy.earlyOrderUntil = 0
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.level = 8
    state.newestLine = 'toy'
    state.board[0][0] = makeProducer(state, 'toy', cfg, 6)
    state.board[0][1] = makeProducer(state, 'bev', cfg, 6)
    state.hasProducer.toy = true
    state.hasProducer.bev = true
    state.orders = []
    fillOrders(state, cfg, mulberry32(4))
    const lines = new Set(state.orders.flatMap((order) => order.slots.map((slot) => slot.line)))
    expect(lines.size).toBeGreaterThan(1)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 40; i++) {
      state.orders = []
      fillOrders(state, cfg, mulberry32(10 + i))
      for (const order of state.orders) for (const slot of order.slots) counts[slot.line] = (counts[slot.line] ?? 0) + 1
    }
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
    for (const line of ['food', 'toy', 'bev']) {
      expect((counts[line] ?? 0) / total).toBeGreaterThan(0.15)
    }
  })

  it('一管体力用完时开格落在 18 到 22，半开以 6 级以上为主', () => {
    const report = spendOneBar()
    expect(report.opens).toBeGreaterThanOrEqual(18)
    expect(report.opens).toBeLessThanOrEqual(22)
    expect(report.halfHigh).toBeGreaterThanOrEqual(0.6)
    expect(report.coins).toBe(3)
    expect(report.gems).toBe(3)
    expect(report.potions).toBe(3)
    expect(report.minutes).toBeGreaterThan(15)
    expect(report.minutes).toBeLessThan(25)
  })
})

function spendOneBar() {
  const cfg = defaultConfig()
  cfg.economy.producerL2Chance = 0
  cfg.economy.earlyOrderAChance = 0
  const state = createGame(1, cfg)
  state.phase = 'play'
  state.openingStep = cfg.copy.tutorial.length
  state.orders = []
  fillOrders(state, cfg, mulberry32(1))
  let minutes = 0
  for (let step = 0; step < 4000; step++) {
    const hint = lowestUnlock(state)
    if (hint && hint.level <= 5 && dropItem(state, hint.from, hint.to, cfg).ok) {
      minutes += 4 / 60
      continue
    }
    const pair = pairOf(state)
    if (pair && dropItem(state, pair[0], pair[1], cfg).ok) {
      minutes += 4 / 60
      continue
    }
    if (state.energy <= 0) break
    const spot = producerAt(state)
    if (!spot || !findEmpty(state).length) break
    if (!tapProducer(state, spot, cfg, () => 0.9, step + 1).ok) break
    minutes += 10 / 60
  }
  const halves = state.locks.filter((lock) => lock.veil === 'half' && lock.buried.kind === 'product')
  const high = halves.filter((lock) => lock.buried.kind === 'product' && lock.buried.level >= 6).length
  return {
    opens: openCellCount(state),
    halfHigh: halves.length ? high / halves.length : 1,
    coins: state.locks.filter((lock) => lock.buried.kind === 'coin').length,
    gems: state.locks.filter((lock) => lock.buried.kind === 'gem').length,
    potions: state.locks.filter((lock) => lock.buried.kind === 'potion').length,
    minutes,
  }
}

function producerAt(state: ReturnType<typeof createGame>) {
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      const item = state.board[row]?.[col]
      if (item?.kind === 'producer' && item.producerId === 'food') return { row, col }
    }
  }
  return null
}

function lowestUnlock(state: ReturnType<typeof createGame>) {
  const pieces: { row: number; col: number; line: string; level: number }[] = []
  state.board.forEach((row, r) => {
    row.forEach((item, c) => {
      if (item?.kind === 'product' && !state.locks.some((lock) => lock.row === r && lock.col === c)) {
        pieces.push({ row: r, col: c, line: item.line, level: item.level })
      }
    })
  })
  let best: { from: { row: number; col: number }; to: { row: number; col: number }; level: number } | null = null
  for (const lock of state.locks) {
    if (lock.veil === 'full' || lock.cover === 'gift' || lock.buried.kind !== 'product') continue
    const piece = pieces.find((entry) => entry.line === lock.buried.line && entry.level === lock.buried.level)
    if (!piece) continue
    if (!best || lock.buried.level < best.level) best = { from: piece, to: { row: lock.row, col: lock.col }, level: lock.buried.level }
  }
  return best
}

function pairOf(state: ReturnType<typeof createGame>) {
  const buckets = new Map<string, { row: number; col: number }[]>()
  state.board.forEach((row, r) => {
    row.forEach((item, c) => {
      if (!item || item.kind !== 'product' || item.level >= 5) return
      if (state.locks.some((lock) => lock.row === r && lock.col === c)) return
      const key = `${item.line}:${item.level}`
      const list = buckets.get(key) ?? []
      list.push({ row: r, col: c })
      buckets.set(key, list)
    })
  })
  for (const list of buckets.values()) if (list[0] && list[1]) return [list[0], list[1]] as const
  return null
}
