import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import {
  applyAdRefill,
  completeOrder,
  createGame,
  dropItem,
  lockAt,
  makeProduct,
  mulberry32,
  openSmilePrize,
  orderPayout,
  unlockGift,
} from '../src/logic/sim'
import { COLS, ROWS } from '../src/types'

function boot() {
  const cfg = defaultConfig()
  const state = createGame(1_700_000_000_000, cfg)
  return { cfg, state, rng: mulberry32(4) }
}

describe('锁格与笑脸', () => {
  it('棋盘是七列九行，开局大约六格，其余盖着锁', () => {
    const { state, cfg } = boot()
    expect(ROWS).toBe(9)
    expect(COLS).toBe(7)
    expect(state.board).toHaveLength(9)
    expect(state.board[0]).toHaveLength(7)
    expect(cfg.board.open).toHaveLength(2)
    expect(state.locks.length).toBe(63 - 2)
    expect(state.locks.filter((lock) => lock.veil === 'half')).toHaveLength(1)
  })

  it('只有把同级同种拖到埋着的物品上才解锁，旁边合成不行', () => {
    const { state, cfg } = boot()
    const unlock = { row: 4, col: 2 }
    expect(lockAt(state, unlock.row, unlock.col)?.buried).toMatchObject({ kind: 'producer', id: 'food', level: 2 })
    expect(lockAt(state, unlock.row, unlock.col)?.veil).toBe('half')
    state.phase = 'opening'
    state.openingStep = 1
    dropItem(state, { row: 3, col: 1 }, { row: 4, col: 1 }, cfg)
    expect(lockAt(state, unlock.row, unlock.col)?.veil).toBe('half')
    const merged = state.board[4][1]
    expect(merged?.kind === 'producer' && merged.level).toBe(2)
    const wrong = dropItem(state, { row: 4, col: 1 }, { row: 0, col: 0 }, cfg)
    expect(wrong.reason).toBe('lock')
    expect(lockAt(state, 0, 0)?.veil).toBe('full')
    state.openingStep = 2
    const opened = dropItem(state, { row: 4, col: 1 }, unlock, cfg)
    expect(opened.ok).toBe(true)
    expect(opened.events.some((event) => event.type === 'unlock')).toBe(true)
    expect(lockAt(state, unlock.row, unlock.col)).toBeUndefined()
    const result = state.board[4][2]
    expect(result?.kind === 'producer' && result.level).toBe(3)
    expect(state.openingStep).toBe(3)
  })

  it('礼物点解锁就揭开，不要求等待', () => {
    const { state } = boot()
    const gift = { row: 5, col: 4 }
    state.locks = state.locks.filter((lock) => lock.row !== gift.row || lock.col !== gift.col)
    state.board[gift.row][gift.col] = null
    state.locks.push({ row: gift.row, col: gift.col, cover: 'gift', veil: 'half', buried: { kind: 'product', line: 'food', level: 1 } })
    expect(lockAt(state, gift.row, gift.col)?.cover).toBe('gift')
    expect(unlockGift(state, gift).ok).toBe(true)
    expect(lockAt(state, gift.row, gift.col)).toBeUndefined()
    expect(state.board[5][4]?.kind).toBe('product')
  })

  it('笑脸满十二开出七到十二个当前缺的子棋', () => {
    const { state, cfg, rng } = boot()
    state.phase = 'play'
    state.orders = [
      {
        id: 'need',
        customerId: 'xiaotao',
        big: false,
        slots: [{ line: 'food', level: 4, filled: false }],
      },
    ]
    state.smiles = cfg.economy.smileGoal - 1
    expect(openSmilePrize(state, cfg, rng).ok).toBe(false)
    state.smiles = cfg.economy.smileGoal
    const opened = openSmilePrize(state, cfg, rng)
    expect(opened.ok).toBe(true)
    expect(state.smiles).toBe(0)
    const names = state.smileModal?.names ?? []
    expect(names.length).toBe(cfg.economy.smilePrizeCount)
    const placed = [...state.board.flat(), ...state.pending, ...state.rewards].filter(
      (item) => item?.kind === 'product' && item.line === 'food' && item.level >= 2 && item.level <= 3,
    )
    expect(placed.length).toBe(names.length)
  })

  it('抱宝箱单三项里铜钱和经验约三点五倍，并多给六个所缺子棋', () => {
    const { state, cfg, rng } = boot()
    state.locks = []
    state.phase = 'play'
    state.hasProducer.food = true
    state.orders = [
      {
        id: 'box',
        customerId: 'raccoon',
        big: false,
        chest: true,
        slots: [{ line: 'food', level: 3, filled: false }],
      },
    ]
    const pay = orderPayout(state.orders[0], cfg)
    expect(pay.smiles).toBe(2)
    expect(pay.coins).toBe(Math.round(8 * 3.5))
    expect(pay.xp).toBe(Math.round(6 * 3.5))
    state.board[0][0] = makeProduct(state, 'food', 3)
    completeOrder(state, 'box', cfg, rng, 1)
    const bonus = [...state.board.flat(), ...state.pending, ...state.rewards].filter((item) => item?.kind === 'product' && item.level >= 3)
    expect(bonus.length).toBeGreaterThanOrEqual(6)
  })

  it('看广告补体力每天最多五次，过了零点重新计数', () => {
    const { state, cfg } = boot()
    const day = Date.parse('2026-11-05T12:00:00')
    state.freeRefillUsed = true
    for (let i = 0; i < 5; i++) expect(applyAdRefill(state, cfg, day).ok).toBe(true)
    expect(applyAdRefill(state, cfg, day).reason).toBe('ad-limit')
    expect(state.adUsedToday).toBe(5)
    const next = Date.parse('2026-11-06T00:10:00')
    expect(applyAdRefill(state, cfg, next).ok).toBe(true)
    expect(state.adUsedToday).toBe(1)
  })
})
