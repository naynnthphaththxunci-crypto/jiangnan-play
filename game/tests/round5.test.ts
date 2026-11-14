import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import {
  applyFreeRefill,
  buyEnergyWithGems,
  claimLevelModal,
  completeOrder,
  createGame,
  dropItem,
  findEmpty,
  gemEnergyPrice,
  refreshProducers,
  lockAt,
  makePotion,
  makeProducer,
  mulberry32,
  orderCraftable,
  orderSatisfied,
  queueReward,
  sellItem,
  syncEnergy,
  takeReward,
  tapConsumable,
  tapProducer,
  unlockHints,
} from '../src/logic/sim'
import type { GameConfig, GameState, Pos } from '../src/types'

describe('第五轮', () => {
  it('订单每样东西都要能由当前拥有的 3 级以上母棋产出或合成', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    expect(orderCraftable(state, cfg, 'food', 3)).toBe(false)
    const food = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (food?.kind === 'producer') food.level = 4
    expect(orderCraftable(state, cfg, 'food', 3)).toBe(true)
    expect(orderCraftable(state, cfg, 'bev', 6)).toBe(false)
    expect(orderCraftable(state, cfg, 'toy', 8)).toBe(false)
    queueReward(state, makeProducer(state, 'bev', cfg, 1))
    expect(orderCraftable(state, cfg, 'bev', 3)).toBe(false)
    queueReward(state, makeProducer(state, 'bev', cfg, 4))
    expect(orderCraftable(state, cfg, 'bev', 4)).toBe(true)
  })

  it('开局按游戏时长不冷却，次数用完才冷却', () => {
    const cfg = defaultConfig()
    const state = createGame(1_000, cfg)
    state.phase = 'play'
    state.locks = []
    const item = state.board[3][1]
    expect(item?.kind).toBe('producer')
    if (item?.kind !== 'producer') return
    item.level = 4
    item.charges = 200
    const charges = item.charges
    for (let i = 0; i < 4; i++) {
      state.board[3][2] = null
      expect(tapProducer(state, { row: 3, col: 1 }, cfg, () => 0.9, 2_000 + i).ok).toBe(true)
    }
    expect(item.charges).toBe(charges - 4)
    expect(item.cooldownUntil).toBe(0)
    expect(state.energy).toBe(96)
    item.charges = 1
    item.cooldownUntil = 0
    state.board[3][2] = null
    expect(tapProducer(state, { row: 3, col: 1 }, cfg, () => 0, 9_000).ok).toBe(true)
    expect(item.charges).toBe(0)
    expect(item.cooldownUntil).toBe(9_000 + cfg.economy.producerRoundCooldownMs)
    expect(tapProducer(state, { row: 3, col: 1 }, cfg, () => 0, 9_010).reason).toBe('cooldown')
  })

  it('打开一格后，相邻全遮变成半开', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    expect(lockAt(state, 4, 0)?.veil).toBe('full')
    const opened = dropItem(state, { row: 3, col: 1 }, { row: 4, col: 1 }, cfg)
    expect(opened.ok).toBe(true)
    expect(lockAt(state, 4, 0)?.veil).toBe('half')
    expect(lockAt(state, 5, 1)?.veil).toBe('half')
  })

  it('奖励进同一个栏，点一下放一个，棋盘满了留着', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.locks = []
    state.rewards = []
    queueReward(state, makePotion(state, 1))
    queueReward(state, makePotion(state, 2))
    expect(state.rewards).toHaveLength(2)
    expect(takeReward(state).ok).toBe(true)
    expect(state.rewards).toHaveLength(1)
    expect(state.rewards[0]?.kind === 'potion' && state.rewards[0].tier).toBe(2)
    state.board = state.board.map((row) => row.map((item) => item ?? makePotion(state, 1)))
    const kept = takeReward(state)
    expect(kept.reason).toBe('full')
    expect(state.rewards).toHaveLength(1)
  })

  it('体力瓶和钻石点两次才用，点别处等于取消', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.board[2][1] = makePotion(state, 1)
    const before = state.energy
    const first = tapConsumable(state, { row: 2, col: 1 }, cfg, 1)
    expect(first.reason).toBe('arm')
    expect(state.energy).toBe(before)
    expect(state.chainPop?.kind).toBe('potion')
    state.armed = null
    state.chainPop = null
    const again = tapConsumable(state, { row: 2, col: 1 }, cfg, 2)
    expect(again.reason).toBe('arm')
    const used = tapConsumable(state, { row: 2, col: 1 }, cfg, 3)
    expect(used.ok).toBe(true)
    expect(state.energy).toBe(before + 5)
    expect(state.board[2][1]).toBeNull()
  })

  it('从开局模拟到 5 级，订单能交、格子能开、母棋能产出', () => {
    const report = playToLevelFive()
    expect(report.level).toBeGreaterThanOrEqual(3)
    expect(report.spawns).toBeGreaterThan(0)
    expect(report.delivers).toBeGreaterThan(0)
    expect(report.unlocks).toBeGreaterThan(0)
    expect(report.halfGrew).toBe(true)
    expect(report.ordersOk).toBe(true)
  })
})

function playToLevelFive(): {
  level: number
  spawns: number
  delivers: number
  unlocks: number
  halfGrew: boolean
  ordersOk: boolean
} {
  const cfg = defaultConfig()
  cfg.economy.producerL2Chance = 0
  cfg.economy.earlyOrderUntil = 0
  cfg.orders.twoSlotChance = 0
  cfg.orders.bigChance = 0
  const state = createGame(1_700_000_000_000, cfg)
  state.phase = 'play'
  state.openingStep = cfg.copy.tutorial.length
  dropItem(state, { row: 3, col: 1 }, { row: 4, col: 1 }, cfg)
  dropItem(state, { row: 4, col: 1 }, { row: 4, col: 2 }, cfg)
  dropItem(state, { row: 4, col: 2 }, { row: 4, col: 3 }, cfg)
  const rng = mulberry32(5)
  let now = 1_700_000_000_000
  let spawns = 0
  let delivers = 0
  let unlocks = 0
  let ordersOk = true
  let halfGrew = false
  for (let step = 0; step < 6000 && state.level < 5; step++) {
    for (const order of state.orders) {
      for (const slot of order.slots) {
        if (!orderCraftable(state, cfg, slot.line, slot.level)) ordersOk = false
      }
    }
    if (state.energy < 1) {
      if (!state.freeRefillUsed) applyFreeRefill(state, cfg, now)
      else if (state.gems >= gemEnergyPrice(cfg, state.gemBuys)) buyEnergyWithGems(state, cfg, now)
      else {
        now += cfg.economy.energyRegenMs
        syncEnergy(state, now, cfg)
      }
      continue
    }
    const ready = state.orders.find((order) => orderSatisfied(state, order))
    if (ready) {
      const result = completeOrder(state, ready.id, cfg, rng, now)
      if (!result.ok) throw new Error(`交单失败 ${result.reason}`)
      delivers += 1
      while (state.levelModal) claimLevelModal(state, cfg, rng)
      continue
    }
    const pair = lowPair(state)
    if (pair) {
      dropItem(state, pair[0], pair[1], cfg)
      continue
    }
    if (unlocks < 1) {
      const hints = unlockHints(state).filter((entry) => {
        const lock = lockAt(state, entry.to.row, entry.to.col)
        return lock?.buried.kind === 'product' && lock.buried.level < 3
      })
      const hint = hints.find((entry) =>
        neighbors(entry.to).some((pos) => lockAt(state, pos.row, pos.col)?.veil === 'full'),
      )
      if (hint) {
        const covered = neighbors(hint.to).filter((pos) => lockAt(state, pos.row, pos.col)?.veil === 'full')
        if (dropItem(state, hint.from, hint.to, cfg).ok) {
          unlocks += 1
          if (covered.some((pos) => lockAt(state, pos.row, pos.col)?.veil === 'half')) halfGrew = true
          continue
        }
      }
    }
    const line = state.orders[0]?.slots[0]?.line ?? 'food'
    if (!producerOf(state, line)) {
      const index = state.rewards.findIndex((item) => item.kind === 'producer' && item.line === line)
      if (index >= 0) {
        const [item] = state.rewards.splice(index, 1)
        if (item) state.rewards.unshift(item)
        if (findEmpty(state).length) takeReward(state)
        continue
      }
    }
    const prod = producerOf(state, line)
    if (prod && findEmpty(state).length) {
      const result = tapProducer(state, prod, cfg, () => 0.9, now)
      if (result.ok) {
        spawns += 1
        continue
      }
    }
    if (sellSpare(state, cfg, line)) continue
    now += cfg.economy.producerRoundCooldownMs
    state.playedMs += cfg.economy.producerRoundCooldownMs
    refreshProducers(state, now, cfg)
  }
  return {
    level: state.level,
    spawns,
    delivers,
    unlocks,
    halfGrew,
    ordersOk,
  }
}

function neighbors(pos: Pos): Pos[] {
  return [
    { row: pos.row + 1, col: pos.col },
    { row: pos.row - 1, col: pos.col },
    { row: pos.row, col: pos.col + 1 },
    { row: pos.row, col: pos.col - 1 },
  ]
}

function producerOf(state: GameState, line: string): Pos | null {
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      const item = state.board[row]?.[col]
      if (item?.kind === 'producer' && item.line === line && item.level >= 3 && !lockAt(state, row, col)) {
        return { row, col }
      }
    }
  }
  return null
}

function lowPair(state: GameState): [Pos, Pos] | null {
  const buckets = new Map<string, Pos[]>()
  state.board.forEach((row, r) => {
    row.forEach((item, c) => {
      if (!item || item.kind !== 'product' || item.level >= 6 || lockAt(state, r, c)) return
      const key = `${item.line}:${item.level}`
      const list = buckets.get(key) ?? []
      list.push({ row: r, col: c })
      buckets.set(key, list)
    })
  })
  for (const list of buckets.values()) {
    if (list[0] && list[1]) return [list[0], list[1]]
  }
  return null
}

function sellSpare(state: GameState, cfg: GameConfig, line: string): boolean {
  if (findEmpty(state).length > 0) return false
  const ranked: { row: number; col: number; score: number }[] = []
  state.board.forEach((row, r) => {
    row.forEach((item, c) => {
      if (!item || item.kind !== 'product' || lockAt(state, r, c)) return
      const keep = item.line === line && item.level < 3 ? 0 : 10 + item.level
      ranked.push({ row: r, col: c, score: keep })
    })
  })
  ranked.sort((a, b) => b.score - a.score)
  const pick = ranked.find((entry) => entry.score > 0) ?? ranked[0]
  if (!pick) return false
  return sellItem(state, cfg, { row: pick.row, col: pick.col }).ok
}
