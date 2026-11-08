import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import {
  advanceGuide,
  applyFreeRefill,
  arrangeOrders,
  buildTask,
  buyEnergyWithGems,
  claimLevelModal,
  completeOrder,
  confirmDecor,
  createGame,
  dropItem,
  enterKitchen,
  findEmpty,
  findProducer,
  gemEnergyPrice,
  generateOrder,
  lockAt,
  mulberry32,
  nextTask,
  openCellCount,
  openSmilePrize,
  orderCraftable,
  orderSatisfied,
  pokeGift,
  reconcileLevel,
  refreshGuide,
  rushGift,
  sellItem,
  skipOpening,
  syncEnergy,
  tapProducer,
  taskPrice,
  tryAdvanceStory,
  unlockHints,
} from '../src/logic/sim'
import type { GameConfig, GameState, Pos } from '../src/types'

describe('第六轮', () => {
  it('开局只开母棋周围 7 格，旁边合成会把全遮揭成半开', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    expect(openCellCount(state)).toBe(2)
    const food = findProducer(state, 'food')
    expect(food?.item.kind === 'producer' && food.item.level).toBe(1)
    expect(findProducer(state, 'bev')).toBeNull()
    const full = state.locks.filter((lock) => lock.veil === 'full').length
    const half = state.locks.filter((lock) => lock.veil === 'half' && lock.cover !== 'gift').length
    expect(full).toBeGreaterThan(half)
    expect(half).toBe(1)
    expect(lockAt(state, 4, 0)?.veil).toBe('full')
    dropItem(state, { row: 3, col: 1 }, { row: 4, col: 1 }, cfg)
  dropItem(state, { row: 4, col: 1 }, { row: 4, col: 2 }, cfg)
  dropItem(state, { row: 4, col: 2 }, { row: 4, col: 3 }, cfg)
    expect(lockAt(state, 4, 0)?.veil).toBe('half')
  })

  it('前期只有蒸笼的 A/B 订单，升到 3 级才有竹编篓', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    const food = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (food?.kind === 'producer') food.level = 4
    for (let i = 0; i < 12; i++) {
      const order = generateOrder(state, cfg, mulberry32(i + 9))
      expect(order).toBeTruthy()
      for (const slot of order?.slots ?? []) {
        expect(slot.line).toBe('food')
        expect(orderCraftable(state, cfg, slot.line, slot.level)).toBe(true)
      }
      const shape = order?.slots.length === 1 ? 'A' : 'B'
      if (shape === 'A') expect(order?.slots[0]?.level).toBe(5)
      if (shape === 'B') expect(order?.slots).toHaveLength(2)
    }
    state.xp = cfg.economy.levelTaskThresholds[1] * cfg.economy.xpPerTask
    const events = reconcileLevel(state, cfg, mulberry32(1))
    expect(events.some((event) => event.type === 'levelup' && event.level === 3)).toBe(true)
    const queued = [state.levelModal, ...state.levelQueue].flatMap((modal) => modal?.rewards ?? [])
    expect(queued.some((reward) => reward.id === 'bev')).toBe(true)
  })

  it('礼物要点一下才冷却，加速可以花钻石或免费', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    const gift = { row: 5, col: 4 }
    state.locks = state.locks.filter((lock) => lock.row !== gift.row || lock.col !== gift.col)
    state.board[gift.row][gift.col] = null
    state.locks.push({
      row: gift.row,
      col: gift.col,
      cover: 'gift',
      veil: 'half',
      buried: { kind: 'product', line: 'food', level: 1 },
    })
    expect(lockAt(state, gift.row, gift.col)?.giftUntil).toBeUndefined()
    expect(pokeGift(state, gift, cfg, 1_000).ok).toBe(true)
    expect(lockAt(state, gift.row, gift.col)?.giftUntil).toBe(1_000 + cfg.economy.giftCooldownMs)
    state.gems = 1
    expect(rushGift(state, gift, cfg, 'gem').reason).toBe('gems')
    state.gems = 2
    expect(rushGift(state, gift, cfg, 'gem').ok).toBe(true)
    expect(lockAt(state, gift.row, gift.col)).toBeUndefined()
    expect(state.gems).toBe(0)
  })

  it('笑脸满 12 送配置数量的棋，多出来的笑脸进奖励框', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.orders = [{ id: 'need', customerId: 'xiaotao', big: false, slots: [{ line: 'food', level: 3, filled: false }] }]
    state.smiles = cfg.economy.smileGoal + 4
    const opened = openSmilePrize(state, cfg, mulberry32(2))
    expect(opened.ok).toBe(true)
    expect(state.smiles).toBe(0)
    expect(state.smileModal?.names).toHaveLength(cfg.economy.smilePrizeCount)
    expect(state.rewards.some((item) => item.kind === 'rewardBox' && item.box === 'smile' && item.n === 4)).toBe(true)
  })

  it('铜钱够时 5 级前引导去建造，不够时引导返回', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.coins = 0
    refreshGuide(state, cfg, 'house')
    expect(state.guide).toBe('backBtn')
    refreshGuide(state, cfg, 'board')
    expect(state.guide).toBe('backTalk')
    advanceGuide(state, cfg)
    expect(state.guide).toBe('none')
    state.coins = 8
    refreshGuide(state, cfg, 'board')
    expect(state.guide).toBe('buildTalk')
    advanceGuide(state, cfg)
    expect(state.guide).toBe('buildBtn')
    refreshGuide(state, cfg, 'house')
    expect(state.guide).toBe('repairBtn')
    state.guide = 'none'
    state.guidedTask = null
    state.buildGuideCount = cfg.economy.guideShows
    refreshGuide(state, cfg, 'board')
    expect(state.guide).toBe('none')
  })

  it('从剧情玩到 8 级，前 10 分钟能开出十几格，订单都做得了', () => {
    const report = playThrough()
    expect(report.level).toBeGreaterThanOrEqual(8)
    expect(report.opensAt0).toBe(2)
    expect(report.opensAt10).toBeGreaterThan(report.opensAt0)
    expect(report.badOrders).toBe(0)
    expect(report.levels.some((entry) => entry.level === 5)).toBe(true)
    expect(report.levels.some((entry) => entry.level === 8)).toBe(true)
  })
})

function playThrough() {
  const cfg = defaultConfig()
  cfg.economy.producerL2Chance = 0
  const state = createGame(1_700_000_000_000, cfg)
  const marks = new Map<number, number>([[0, openCellCount(state)]])
  while (state.phase === 'story') tryAdvanceStory(state, cfg, true)
  enterKitchen(state, cfg)
  dropItem(state, { row: 3, col: 1 }, { row: 4, col: 1 }, cfg)
  dropItem(state, { row: 4, col: 1 }, { row: 4, col: 2 }, cfg)
  dropItem(state, { row: 4, col: 2 }, { row: 4, col: 3 }, cfg)
  const producer = findProducer(state, 'food')
  if (producer) {
    for (let i = 0; i < 4; i++) tapProducer(state, producer, cfg, () => 0.9, 2_000 + i)
  }
  mergeUp(state, cfg, 'food', 3)
  const ready = state.orders.find((order) => orderSatisfied(state, order))
  if (ready) completeOrder(state, ready.id, cfg, mulberry32(1), 3_000)
  if (state.phase !== 'play') skipOpening(state, cfg, mulberry32(2))
  const rng = mulberry32(6)
  let now = 1_700_000_000_000
  let badOrders = 0
  const levels: { level: number; playedMs: number }[] = [{ level: 1, playedMs: 0 }]
  const minute = 60_000
  for (let step = 0; step < 8000 && state.level < 8; step++) {
    for (const order of state.orders) {
      for (const slot of order.slots) if (!orderCraftable(state, cfg, slot.line, slot.level)) badOrders += 1
    }
    const before = state.level
    let acted = false
    if (state.energy < 1) {
      if (!state.freeRefillUsed) applyFreeRefill(state, cfg, now)
      else if (state.gems >= gemEnergyPrice(cfg, state.gemBuys)) buyEnergyWithGems(state, cfg, now)
      else {
        now += cfg.economy.energyRegenMs
        state.playedMs += cfg.economy.energyRegenMs
        syncEnergy(state, now, cfg)
      }
    } else if (deliverOne(state, cfg, rng, now)) acted = true
    else if (buildOne(state, cfg, rng, now)) acted = true
    else if (unlockOne(state, cfg)) acted = true
    else if (mergeEdge(state, cfg)) acted = true
    else if (produceOne(state, cfg, now)) acted = true
    else if (sellOne(state, cfg)) acted = true
    else {
      now += cfg.economy.producerRoundCooldownMs
      state.playedMs += 5000
      syncEnergy(state, now, cfg)
    }
    if (acted) {
      state.playedMs += 5000
      now += 5000
    }
    while (state.levelModal) claimLevelModal(state, cfg, rng)
    if (state.level > before) levels.push({ level: state.level, playedMs: state.playedMs })
    for (const mark of [2, 5, 10]) {
      if (!marks.has(mark) && state.playedMs >= mark * minute) marks.set(mark, openCellCount(state))
    }
    arrangeOrders(state, now)
  }
  return {
    level: state.level,
    opensAt0: marks.get(0) ?? 0,
    opensAt10: marks.get(10) ?? openCellCount(state),
    badOrders,
    levels,
  }
}

function deliverOne(state: GameState, cfg: GameConfig, rng: ReturnType<typeof mulberry32>, now: number) {
  const ready = state.orders.find((order) => orderSatisfied(state, order))
  if (!ready) return false
  return completeOrder(state, ready.id, cfg, rng, now).ok
}

function buildOne(state: GameState, cfg: GameConfig, rng: ReturnType<typeof mulberry32>, now: number) {
  const task = nextTask(state, cfg)
  if (!task || state.coins < taskPrice(task, cfg)) return false
  const choice = task.choices?.[0]?.id ?? null
  const result = buildTask(state, task.id, choice, cfg, rng, now)
  if (state.decorate) confirmDecor(state, cfg)
  return result.ok
}

function unlockOne(state: GameState, cfg: GameConfig) {
  const cap = 7 + Math.floor(state.playedMs / 45_000)
  if (openCellCount(state) >= Math.min(20, cap)) return false
  const hint = unlockHints(state).find((entry) => {
    const lock = lockAt(state, entry.to.row, entry.to.col)
    return lock?.buried.kind === 'product' && lock.buried.level <= 3
  })
  if (!hint) return false
  return dropItem(state, hint.from, hint.to, cfg).ok
}

function mergeEdge(state: GameState, cfg: GameConfig) {
  const pair = pairNearFull(state) ?? lowPair(state)
  if (!pair) return false
  return dropItem(state, pair[0], pair[1], cfg).ok
}

function produceOne(state: GameState, cfg: GameConfig, now: number) {
  if (!findEmpty(state).length) return false
  const line = state.orders[0]?.slots[0]?.line ?? 'food'
  const prod = producerOf(state, line) ?? producerOf(state, 'food')
  if (!prod) return false
  return tapProducer(state, prod, cfg, () => 0.9, now).ok
}

function sellOne(state: GameState, cfg: GameConfig) {
  if (findEmpty(state).length > 0) return false
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      const item = state.board[row]?.[col]
      if (item?.kind === 'product' && !lockAt(state, row, col)) return sellItem(state, cfg, { row, col }).ok
    }
  }
  return false
}

function producerOf(state: GameState, line: string): Pos | null {
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      const item = state.board[row]?.[col]
      if (item?.kind === 'producer' && item.line === line && item.level >= 3 && !lockAt(state, row, col)) return { row, col }
    }
  }
  return null
}

function findLevel(state: GameState, line: string, level: number): Pos | null {
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      const item = state.board[row]?.[col]
      if (item?.kind === 'product' && item.line === line && item.level === level && !lockAt(state, row, col)) return { row, col }
    }
  }
  return null
}

function mergeUp(state: GameState, cfg: GameConfig, line: string, level: number) {
  for (let guard = 0; guard < 20 && !findLevel(state, line, level); guard++) {
    const pair = lowPair(state)
    if (!pair || !dropItem(state, pair[0], pair[1], cfg).ok) break
  }
}

function lowPair(state: GameState): [Pos, Pos] | null {
  const buckets = new Map<string, Pos[]>()
  state.board.forEach((row, r) => {
    row.forEach((item, c) => {
      if (!item || item.kind !== 'product' || item.level >= 5 || lockAt(state, r, c)) return
      const key = `${item.line}:${item.level}`
      const list = buckets.get(key) ?? []
      list.push({ row: r, col: c })
      buckets.set(key, list)
    })
  })
  for (const list of buckets.values()) if (list[0] && list[1]) return [list[0], list[1]]
  return null
}

function pairNearFull(state: GameState): [Pos, Pos] | null {
  const pair = lowPair(state)
  if (!pair) return null
  const near = [pair[1], pair[0]].some((pos) =>
    [
      { row: pos.row + 1, col: pos.col },
      { row: pos.row - 1, col: pos.col },
      { row: pos.row, col: pos.col + 1 },
      { row: pos.row, col: pos.col - 1 },
    ].some((cell) => lockAt(state, cell.row, cell.col)?.veil === 'full'),
  )
  return near ? pair : null
}
