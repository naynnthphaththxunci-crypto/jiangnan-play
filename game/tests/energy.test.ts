import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import {
  applyAdRefill,
  applyFreeRefill,
  canClaimDaily,
  claimDailyChest,
  createGame,
  drinkPotion,
  findProducer,
  makeChest,
  makePotion,
  openChest,
  rollEnergy,
  syncEnergy,
  tapProducer,
  eachCell,
} from '../src/logic/sim'
import { COLS, ROWS, type GameState } from '../src/types'

function boot() {
  const cfg = defaultConfig()
  cfg.economy.producerL2Chance = 0
  const state = createGame(1_700_000_000_000, cfg)
  state.locks = []
  return { cfg, state }
}

function producerAt(state: GameState) {
  const found = findProducer(state, 'food')
  if (!found) throw new Error('no food')
  if (found.item.kind === 'producer') {
    found.item.level = 6
    found.item.charges = 400
    found.item.cooldownUntil = 0
  }
  return found
}

function potionEnergySum(state: GameState, cfg: ReturnType<typeof defaultConfig>): number {
  let sum = 0
  eachCell(state.board, (item) => {
    if (item?.kind === 'potion') {
      sum += cfg.items.potions.find((p) => p.tier === item.tier)?.energy ?? 0
    }
  })
  for (const item of state.pending) {
    if (item.kind === 'potion') sum += cfg.items.potions.find((p) => p.tier === item.tier)?.energy ?? 0
  }
  for (const item of state.rewards) {
    if (item.kind === 'potion') sum += cfg.items.potions.find((p) => p.tier === item.tier)?.energy ?? 0
  }
  return sum
}

describe('体力', () => {
  it('点母棋扣 1 点，满体力时开始倒计时，两分钟回 1 点且不超过上限', () => {
    const { state, cfg } = boot()
    const spot = producerAt(state)
    state.board[3][2] = null
    expect(state.energy).toBe(100)
    const tapped = tapProducer(state, spot, cfg, () => 0.9, 5_000)
    expect(tapped.ok).toBe(true)
    expect(tapped.events[0].type).toBe('spawn')
    expect(state.energy).toBe(99)
    expect(state.energyTs).toBe(5_000)
    expect(state.stats.producerTaps).toBe(1)
    const item = state.board.flat().find((cell) => cell?.kind === 'product')
    expect(item && item.kind === 'product' && item.level).toBe(1)
    expect(syncEnergy(state, 5_000 + 119_999, cfg)).toBe(0)
    expect(state.energy).toBe(99)
    expect(syncEnergy(state, 5_000 + 120_000, cfg)).toBe(1)
    expect(state.energy).toBe(100)
    expect(syncEnergy(state, 5_000 + 999_999, cfg)).toBe(0)
    expect(state.energy).toBe(100)
  })

  it('超过上限不自然恢复，体力不够不扣次数也不出子棋', () => {
    const { state, cfg } = boot()
    state.energy = 130
    state.energyTs = 0
    expect(syncEnergy(state, 999_999, cfg)).toBe(0)
    expect(state.energy).toBe(130)
    const spot = producerAt(state)
    const charges = spot.item.kind === 'producer' ? spot.item.charges : 0
    state.board[3][2] = null
    state.energy = 0
    const denied = tapProducer(state, spot, cfg, () => 0, 10)
    expect(denied.ok).toBe(false)
    expect(denied.events[0].type).toBe('needEnergy')
    const before = state.board.flat().filter((cell) => cell?.kind === 'product').length
    expect(state.energy).toBe(0)
    expect(spot.item.kind === 'producer' && spot.item.charges).toBe(charges)
    expect(state.board.flat().filter((cell) => cell?.kind === 'product').length).toBe(before)
  })

  it('棋盘满了不扣体力', () => {
    const { state, cfg } = boot()
    eachCell(state.board, (item, row, col) => {
      if (!item) state.board[row][col] = makePotion(state, 1)
    })
    const spot = producerAt(state)
    const before = state.energy
    const result = tapProducer(state, spot, cfg, () => 0, 10)
    expect(result.reason).toBe('full')
    expect(state.energy).toBe(before)
  })

  it('点满一轮进入冷却，到点后恢复次数', () => {
    const { state, cfg } = boot()
    state.playedMs = cfg.economy.producerGraceMs
    const spot = producerAt(state)
    state.board[3][2] = null
    state.board[3][3] = null
    if (spot.item.kind === 'producer') {
      spot.item.charges = 1
      spot.item.cooldownUntil = 0
    }
    expect(tapProducer(state, spot, cfg, () => 0, 0).ok).toBe(true)
    expect(spot.item.kind === 'producer' && spot.item.charges).toBe(0)
    expect(spot.item.kind === 'producer' && spot.item.cooldownUntil).toBe(cfg.economy.producerRoundCooldownMs)
    expect(tapProducer(state, spot, cfg, () => 0, 10).reason).toBe('cooldown')
    expect(state.energy).toBe(99)
    state.energyTs = cfg.economy.producerRoundCooldownMs
    const again = tapProducer(state, spot, cfg, () => 0, cfg.economy.producerRoundCooldownMs)
    expect(again.ok).toBe(true)
    expect(state.energy).toBe(98)
  })

  it('二级产出看概率', () => {
    const { state, cfg } = boot()
    const spot = producerAt(state)
    if (spot.item.kind === 'producer') spot.item.level = 7
    eachCell(state.board, (item, row, col) => {
      if (item?.kind === 'product') state.board[row][col] = null
    })
    tapProducer(state, spot, cfg, () => 0.99, 0)
    const first = state.board.flat().find((cell) => cell?.kind === 'product')
    expect(first && first.kind === 'product' && first.level).toBe(1)
    if (first) {
      const pos = producerAt(state)
      // remove the product by drinking nothing; clear products
      eachCell(state.board, (item, row, col) => {
        if (item?.kind === 'product') state.board[row][col] = null
      })
      tapProducer(state, pos, cfg, () => 0.05, 1)
    }
    const second = state.board.flat().find((cell) => cell?.kind === 'product')
    expect(second && second.kind === 'product' && second.level).toBe(2)
  })

  it('第一次用完免费回一百，之后广告加十五且可超过上限', () => {
    const { state, cfg } = boot()
    state.energy = 0
    const free = applyFreeRefill(state, cfg, 100)
    expect(free.ok).toBe(true)
    expect(state.energy).toBe(100)
    expect(state.freeRefillUsed).toBe(true)
    expect(applyFreeRefill(state, cfg, 200).ok).toBe(false)
    const ad = applyAdRefill(state, cfg, 300)
    expect(ad.ok).toBe(true)
    expect(state.energy).toBe(115)
    expect(state.stats.adClicks).toBe(1)
    expect(syncEnergy(state, 999_999, cfg)).toBe(0)
    expect(state.energy).toBe(115)
  })

  it('喝体力瓶按瓶上的点数加，可以超过一百', () => {
    const { state, cfg } = boot()
    state.energy = 90
    state.board[0][0] = makePotion(state, 4)
    const drank = drinkPotion(state, { row: 0, col: 0 }, cfg, 50)
    expect(drank.events[0]).toMatchObject({ type: 'drink', amount: 40 })
    expect(state.energy).toBe(130)
    expect(state.board[0][0]).toBeNull()
  })

  it('宝箱权重与新手前两只固定四十八点', () => {
    const { cfg } = boot()
    expect(rollEnergy(cfg, () => 0)).toBe(5)
    expect(rollEnergy(cfg, () => 0.399)).toBe(5)
    expect(rollEnergy(cfg, () => 0.4)).toBe(10)
    expect(rollEnergy(cfg, () => 0.699)).toBe(10)
    expect(rollEnergy(cfg, () => 0.7)).toBe(20)
    expect(rollEnergy(cfg, () => 0.899)).toBe(20)
    expect(rollEnergy(cfg, () => 0.9)).toBe(40)
    expect(rollEnergy(cfg, () => 0.999)).toBe(40)

    const state = createGame(1_700_000_000_000, cfg)
    const putChest = () => {
      for (let row = ROWS - 1; row >= 0; row--) {
        for (let col = COLS - 1; col >= 0; col--) {
          if (!state.board[row][col]) {
            state.board[row][col] = makeChest(state)
            return { row, col }
          }
        }
      }
      throw new Error('no space')
    }
    const drain = (rng: () => number) => {
      const pos = putChest()
      let guard = 0
      while (state.board[pos.row]?.[pos.col]?.kind === 'chest' && guard < 8) {
        openChest(state, pos, cfg, rng)
        guard += 1
      }
    }
    drain(() => 0.99)
    expect(potionEnergySum(state, cfg)).toBe(50)
    drain(() => 0.99)
    expect(potionEnergySum(state, cfg)).toBe(100)
    drain(() => 0)
    expect(potionEnergySum(state, cfg)).toBe(125)
    expect(state.chestsOpened).toBe(3)
  })

  it('每日体力宝箱从第二天起，一天一次，算一次广告按钮', () => {
    const { state, cfg } = boot()
    state.firstPlayDate = '2026-11-05'
    const day1 = Date.parse('2026-11-05T12:00:00')
    const day2 = Date.parse('2026-11-06T12:00:00')
    expect(canClaimDaily(state, day1, cfg)).toBe(false)
    expect(claimDailyChest(state, day1, cfg).ok).toBe(false)
    expect(canClaimDaily(state, day2, cfg)).toBe(true)
    expect(claimDailyChest(state, day2, cfg).ok).toBe(true)
    expect(state.stats.adClicks).toBe(1)
    expect(canClaimDaily(state, day2 + 1000, cfg)).toBe(false)
    expect(state.rewards.some((item) => item.kind === 'chest')).toBe(true)
  })
})
