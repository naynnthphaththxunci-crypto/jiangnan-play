import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import {
  canMerge,
  createGame,
  dropItem,
  makeChest,
  makePotion,
  makeProduct,
} from '../src/logic/sim'
import type { GameState, Item } from '../src/types'

function boot() {
  const cfg = defaultConfig()
  const state = createGame(1_700_000_000_000, cfg)
  state.locks = []
  state.phase = 'play'
  return { cfg, state }
}

function at(state: GameState, row: number, col: number): Item {
  const item = state.board[row][col]
  if (!item) throw new Error(`empty ${row},${col}`)
  return item
}

describe('合成', () => {
  it('两个一级合成二级，源格清空，并记下解锁', () => {
    const { state } = boot()
    state.board[0][0] = makeProduct(state, 'food', 1)
    state.board[0][1] = makeProduct(state, 'food', 1)
    const result = dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 })
    expect(result.ok).toBe(true)
    expect(result.events[0]).toMatchObject({ type: 'merge', level: 2, line: 'food', kind: 'product' })
    expect(state.board[0][0]).toBeNull()
    const item = at(state, 0, 1)
    expect(item.kind).toBe('product')
    if (item.kind === 'product') expect(item.level).toBe(2)
    expect(state.unlocked.food).toBe(2)
  })

  it('四级面粉链能合成出包子', () => {
    const { state } = boot()
    for (let col = 0; col < 4; col++) state.board[0][col] = makeProduct(state, 'food', 1)
    dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 })
    dropItem(state, { row: 0, col: 2 }, { row: 0, col: 3 })
    dropItem(state, { row: 0, col: 1 }, { row: 0, col: 3 })
    const item = at(state, 0, 3)
    expect(item.kind).toBe('product')
    if (item.kind === 'product') expect(item.level).toBe(3)
    expect(state.unlocked.food).toBe(3)
  })

  it('十一级不能再合成，松手变成交换', () => {
    const { state } = boot()
    const a = makeProduct(state, 'food', 11)
    const b = makeProduct(state, 'toy', 11)
    const c = makeProduct(state, 'food', 11)
    state.board[0][0] = a
    state.board[0][1] = c
    expect(canMerge(a, c)).toBe(false)
    dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 })
    expect(state.board[0][0]).toBe(c)
    expect(state.board[0][1]).toBe(a)
    state.board[1][0] = b
    dropItem(state, { row: 0, col: 1 }, { row: 1, col: 0 })
    expect(state.board[0][1]).toBe(b)
    expect(state.board[1][0]).toBe(a)
  })

  it('不同等级或空格：交换、移动，原地放下不变', () => {
    const { state } = boot()
    const low = makeProduct(state, 'food', 1)
    const high = makeProduct(state, 'food', 2)
    state.board[2][0] = low
    state.board[2][1] = high
    dropItem(state, { row: 2, col: 0 }, { row: 2, col: 1 })
    expect(state.board[2][0]).toBe(high)
    expect(state.board[2][1]).toBe(low)
    const moved = dropItem(state, { row: 2, col: 1 }, { row: 2, col: 4 })
    expect(moved.events[0]).toMatchObject({ type: 'move', toRow: 2, toCol: 4 })
    expect(state.board[2][1]).toBeNull()
    expect(state.board[2][4]).toBe(low)
    const same = dropItem(state, { row: 2, col: 4 }, { row: 2, col: 4 })
    expect(same.ok).toBe(true)
    expect(same.events).toHaveLength(0)
    expect(state.board[2][4]).toBe(low)
  })

  it('体力瓶按 5→10→20→40→100 合成，一百点不能再合', () => {
    const { state, cfg } = boot()
    const energies = [5, 10, 20, 40, 100]
    state.board[0][0] = makePotion(state, 1)
    for (let tier = 1; tier < 5; tier++) {
      state.board[0][1] = makePotion(state, tier)
      dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 })
      const item = at(state, 0, 1)
      expect(item.kind).toBe('potion')
      if (item.kind === 'potion') {
        expect(item.tier).toBe(tier + 1)
        expect(cfg.items.potions.find((p) => p.tier === item.tier)?.energy).toBe(energies[tier])
      }
      state.board[0][0] = state.board[0][1]
      state.board[0][1] = null
    }
    const left = makePotion(state, 5)
    const right = makePotion(state, 5)
    state.board[0][0] = left
    state.board[0][1] = right
    expect(canMerge(left, right)).toBe(false)
    dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 })
    expect(state.board[0][0]).toBe(right)
    expect(state.board[0][1]).toBe(left)
  })

  it('宝箱不能互相合成', () => {
    const { state } = boot()
    const a = makeChest(state)
    const b = makeChest(state)
    state.board[0][0] = a
    state.board[0][1] = b
    expect(canMerge(a, b)).toBe(false)
    dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 })
    expect(state.board[0][0]).toBe(b)
    expect(state.board[0][1]).toBe(a)
  })
})
