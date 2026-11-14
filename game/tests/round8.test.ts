import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import board from '../src/data/board.json'
import copy from '../src/data/copy.json'
import economy from '../src/data/economy.json'
import items from '../src/data/items.json'
import opening from '../src/data/opening.json'
import orders from '../src/data/orders.json'
import producers from '../src/data/producers.json'
import {
  createGame,
  dropItem,
  enterKitchen,
  findEmpty,
  findProducer,
  mulberry32,
  orderCraftable,
  skipOpening,
  tapProducer,
  tryAdvanceStory,
} from '../src/logic/sim'

describe('第八轮猫猫合成', () => {
  it('6 级母棋按配置掉落，并进入对应冷却', () => {
    const cfg = defaultConfig()
    const state = createGame(1_700_000_000_000, cfg)
    state.phase = 'play'
    state.locks = []
    state.playedMs = cfg.economy.producerGraceMs + 1
    const spot = findProducer(state, 'food')
    expect(spot).toBeTruthy()
    if (!spot || spot.item.kind !== 'producer') return
    spot.item.level = 4
    spot.item.charges = 200
    const now = 5_000
    const first = tapProducer(state, spot, cfg, () => 0.9, now)
    expect(first.ok).toBe(true)
    const spawned = state.board.flat().find((item) => item?.kind === 'product' && item.line === 'food' && item.level === 2)
    expect(spawned).toBeTruthy()
    const producer = state.board[spot.row]?.[spot.col]
    expect(producer?.kind === 'producer' && producer.cooldownUntil).toBe(0)
    expect(producer?.kind === 'producer' && producer.charges).toBeLessThan(200)
    if (producer?.kind === 'producer') {
      producer.level = 4
      producer.charges = 1
    }
    const blocked = tapProducer(state, spot, cfg, () => 0, now + 1)
    expect(blocked.ok).toBe(true)
    expect(producer?.kind === 'producer' && producer.cooldownUntil).toBe(now + 1 + cfg.economy.producerRoundCooldownMs)
    const cooling = tapProducer(state, spot, cfg, () => 0, now + 2)
    expect(cooling.reason).toBe('cooldown')
  })

  it('两条 5 级合成出 6 级母棋', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.locks = []
    state.board[0][0] = { uid: 'a', kind: 'product', line: 'food', level: 5 }
    state.board[0][1] = { uid: 'b', kind: 'product', line: 'food', level: 5 }
    expect(dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 }, cfg).ok).toBe(true)
    expect(state.board[0][1]).toMatchObject({ kind: 'product', line: 'food', level: 6 })
  })

  it('配置里不再有蒸笼、旧茶炉、竹编篓', () => {
    const ids = defaultConfig().items.lines.map((line) => line.id)
    expect(ids).toContain('food')
    expect(ids).toContain('bed')
    expect(ids.find((id) => id === 'bed') && defaultConfig().items.lines.find((line) => line.id === 'bed')?.levels).toHaveLength(10)
    const banned = ['"steamer"', '"bamboo"']
    const blob = JSON.stringify({ items, producers, orders, economy, board, copy, opening })
    for (const word of banned) expect(blob.includes(word), word).toBe(false)
  })

  it('开出来的订单都做得了，教学能进入正式玩', () => {
    const cfg = defaultConfig()
    const state = createGame(1_700_000_000_000, cfg)
    while (state.phase === 'story') tryAdvanceStory(state, cfg, true)
    enterKitchen(state, cfg)
    dropItem(state, { row: 3, col: 1 }, { row: 4, col: 1 }, cfg)
    dropItem(state, { row: 4, col: 1 }, { row: 4, col: 2 }, cfg)
    dropItem(state, { row: 4, col: 2 }, { row: 4, col: 3 }, cfg)
    const producer = findProducer(state, 'food')
    expect(producer).toBeTruthy()
    if (producer) {
      for (let i = 0; i < 6; i++) tapProducer(state, producer, cfg, () => 0, 2_000 + i)
    }
    const pair = () => {
      const found: { row: number; col: number; level: number }[] = []
      state.board.forEach((row, r) => row.forEach((item, c) => {
        if (item?.kind === 'product' && item.line === 'food') found.push({ row: r, col: c, level: item.level })
      }))
      found.sort((a, b) => a.level - b.level)
      const match = found.find((cell, index) => found.slice(index + 1).some((other) => other.level === cell.level))
      const other = found.find((cell) => match && cell !== match && cell.level === match.level)
      return match && other ? [match, other] as const : null
    }
    for (let i = 0; i < 12; i++) {
      const twins = pair()
      if (!twins) break
      dropItem(state, twins[0], twins[1], cfg)
    }
    expect(state.orders.every((order) => order.slots.every((slot) => orderCraftable(state, cfg, slot.line, slot.level)))).toBe(true)
    if (state.phase !== 'play') skipOpening(state, cfg, mulberry32(1))
    expect(state.phase).toBe('play')
    expect(findEmpty(state).length).toBeGreaterThan(0)
  })
})
