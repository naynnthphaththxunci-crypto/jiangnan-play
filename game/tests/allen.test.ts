import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import {
  completeOrder,
  createGame,
  dropItem,
  lockAt,
  makeProducer,
  makeProduct,
  mulberry32,
  producerChain,
  reconcileLevel,
  storeItem,
  takeFromStorage,
  tapProducer,
  tryAdvanceStory,
} from '../src/logic/sim'

function boot() {
  const cfg = defaultConfig()
  const state = createGame(1_700_000_000_000, cfg)
  state.phase = 'play'
  state.locks = []
  return { cfg, state, rng: mulberry32(2) }
}

describe('Allen 11-06 母棋、剧情和暂存', () => {
  it('六条链的母棋都能两两合成，最高到链尾，开局猫粮是 6 级', () => {
    const { state, cfg } = boot()
    const starter = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    expect(starter && starter.kind === 'producer' && starter.level).toBe(1)
    expect(state.board.flat().some((item) => item?.kind === 'producer' && item.producerId !== 'food')).toBe(false)
    for (const id of ['food', 'toy', 'bev'] as const) {
      state.board[0][0] = makeProducer(state, id, cfg, 1)
      state.board[0][1] = makeProducer(state, id, cfg, 1)
      expect(dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 }, cfg).ok).toBe(true)
      const merged = state.board[0][1]
      expect(merged?.kind === 'producer' && merged.level).toBe(2)
      state.board[0][0] = makeProducer(state, id, cfg, 2)
      expect(dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 }, cfg).ok).toBe(true)
      const third = state.board[0][1]
      expect(third?.kind === 'producer' && third.level).toBe(3)
      state.board[0][0] = makeProducer(state, id, cfg, 10)
      state.board[0][1] = makeProducer(state, id, cfg, 10)
      dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 }, cfg)
      expect(state.board[0][0]?.kind).toBe('producer')
      expect(state.board[0][1]?.kind).toBe('producer')
    }
  })

  it('3 级点了不出子，也不扣体力；4 级才产出', () => {
    const { state, cfg } = boot()
    state.locks = []
    const spot = { row: 3, col: 1 }
    const item = state.board[spot.row]?.[spot.col]
    expect(item?.kind).toBe('producer')
    if (item?.kind === 'producer') item.level = 3
    const before = state.energy
    const low = tapProducer(state, spot, cfg, () => 0, 10)
    expect(low.ok).toBe(false)
    expect(low.events.some((event) => event.type === 'toast' && event.text.includes('4 级'))).toBe(true)
    expect(state.energy).toBe(before)
    if (item?.kind === 'producer') item.level = 4
    expect(tapProducer(state, spot, cfg, () => 0.9, 12).ok).toBe(true)
    expect(state.energy).toBe(before - 1)
    expect(state.board.flat().some((cell) => cell?.kind === 'product')).toBe(true)
  })

  it('母棋图鉴列出整条链，没见过的是问号，6 级起才能产出', () => {
    const { state, cfg } = boot()
    state.producerSeen.food = [4]
    const chain = producerChain(state, 'food', 4, cfg.economy.producerMaxLevel)
    expect(chain.map((slot) => slot.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(chain[3]?.label).toBe('4')
    expect(chain[3]?.current).toBe(true)
    expect(chain[0]?.label).toBe('?')
    expect(3 >= cfg.economy.producerOutputLevel).toBe(false)
    state.producerSeen.food = [1, 2, 4]
    const later = producerChain(state, 'food', 4, 10)
    expect(later.find((slot) => slot.level === 4)?.label).toBe('4')
    expect(later.find((slot) => slot.level === 7)?.label).toBe('?')
    expect(4 >= cfg.economy.producerOutputLevel).toBe(true)
    expect(cfg.copy.producerExtra.length).toBeGreaterThan(0)
  })

  it('剧情只有点热点才下一步，跳过之外的空白不算', () => {
    const cfg = defaultConfig()
    const state = createGame(1_700_000_000_000, cfg)
    expect(tryAdvanceStory(state, cfg, false)).toBe(false)
    expect(state.storyStep).toBe(0)
    expect(tryAdvanceStory(state, cfg, true)).toBe(true)
    expect(state.storyStep).toBe(1)
    expect(state.phase).toBe('story')
  })

  it('交完第一单不开暂存，升到 5 级才开并进入教学', () => {
    const { state, cfg, rng } = boot()
    state.orders = [
      { id: 'one', customerId: 'xiaotao', big: false, slots: [{ line: 'food', level: 3, filled: false }] },
    ]
    state.board[0][0] = makeProduct(state, 'food', 3)
    expect(completeOrder(state, 'one', cfg, rng, 20).ok).toBe(true)
    expect(state.storageOpen).toBe(false)
    expect(state.storageLesson).toBe(0)
    state.xp = cfg.economy.levelTaskThresholds[3] * cfg.economy.xpPerTask
    reconcileLevel(state, cfg, rng)
    expect(state.level).toBe(5)
    expect(state.storageOpen).toBe(true)
    expect(state.storageLesson).toBe(1)
    state.storageLesson = 2
    state.board[2][2] = makeProduct(state, 'tea', 1)
    expect(storeItem(state, cfg, { row: 2, col: 2 }).ok).toBe(true)
    expect(state.storageLesson).toBe(3)
    expect(takeFromStorage(state, cfg, { row: 2, col: 2 }, 0).ok).toBe(true)
    expect(state.storageLesson).toBe(4)
  })

  it('开局教学只带玩家把猫粮母棋合成到 4 级', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    expect(cfg.copy.tutorial.map((step) => step.id)).toEqual(['merge', 'mergeC', 'mergeD'])
    state.phase = 'opening'
    state.openingStep = 0
    expect(dropItem(state, { row: 3, col: 1 }, { row: 4, col: 1 }, cfg).ok).toBe(true)
    expect(state.openingStep).toBe(1)
    expect(dropItem(state, { row: 4, col: 1 }, { row: 4, col: 2 }, cfg).ok).toBe(true)
    expect(lockAt(state, 3, 3)?.veil).toBe('half')
    expect(lockAt(state, 5, 3)?.veil).toBe('half')
    expect(lockAt(state, 4, 4)?.veil).toBe('half')
    expect(state.openingStep).toBe(2)
    expect(dropItem(state, { row: 4, col: 2 }, { row: 4, col: 3 }, cfg).ok).toBe(true)
    expect(state.phase).toBe('play')
    expect(state.board[4][3]?.kind === 'producer' && state.board[4][3].level).toBe(4)
  })

  it('开局不再弹出进厨房', () => {
    const cfg = defaultConfig()
    expect(cfg.copy.tutorial.some((step) => step.id === 'enter' || step.id === 'build')).toBe(false)
    expect(cfg.copy.tutorial[0]?.text).toContain('猫粮母棋')
  })
})
