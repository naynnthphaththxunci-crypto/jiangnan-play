import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import {
  completeOrder,
  createGame,
  generateOrder,
  makeProduct,
  mulberry32,
  orderPayout,
  orderReward,
  orderSatisfied,
  skipOpening,
  taskPrice,
  allTasks,
} from '../src/logic/sim'

function boot() {
  const cfg = defaultConfig()
  const state = createGame(1_700_000_000_000, cfg)
  return { cfg, state, rng: mulberry32(7) }
}

describe('订单', () => {
  it('开局只有小桃的包子单，报酬等于第一件修缮', () => {
    const { state, cfg } = boot()
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].scripted).toBe(true)
    expect(state.orders[0].slots).toEqual([{ line: 'food', level: 3, filled: false }])
    expect(orderReward(state.orders[0], cfg)).toBe(taskPrice(allTasks(cfg)[0], cfg))
    expect(orderReward(state.orders[0], cfg)).toBe(8)
  })

  it('没齐不能点完成，齐了一次扣掉棋盘上的物品', () => {
    const { state, cfg, rng } = boot()
    state.locks = []
    state.phase = 'play'
    const food = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (food?.kind === 'producer') food.level = 4
    state.orders = [
      {
        id: 'mix',
        customerId: 'teaGuest',
        big: false,
        slots: [
          { line: 'food', level: 3, filled: false },
          { line: 'bev', level: 3, filled: false },
        ],
      },
    ]
    state.board[0][0] = makeProduct(state, 'food', 3)
    expect(orderSatisfied(state, state.orders[0])).toBe(false)
    const early = completeOrder(state, 'mix', cfg, rng, 1)
    expect(early.reason).toBe('short')
    expect(state.board[0][0]?.kind).toBe('product')
    expect(state.coins).toBe(0)
    state.board[0][1] = makeProduct(state, 'bev', 3)
    expect(orderSatisfied(state, state.orders[0])).toBe(true)
    const done = completeOrder(state, 'mix', cfg, rng, 2)
    expect(done.events[0]).toMatchObject({ type: 'deliver', coins: 16, smiles: 1, xp: 6 })
    expect(state.board[0][0]).toBeNull()
    expect(state.board[0][1]).toBeNull()
    expect(state.energy).toBe(100)
    expect(state.orders).toHaveLength(3)
    expect(state.orders.some((order) => order.id === 'mix')).toBe(false)
  })

  it('大单金边报酬是三级单的十倍，并带街坊台词', () => {
    const { state, cfg, rng } = boot()
    state.phase = 'play'
    state.hasProducer.food = true
    const food = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (food?.kind === 'producer') food.level = 4
    state.orders = [
      {
        id: 'big',
        customerId: 'squire',
        big: true,
        slots: [{ line: 'food', level: 6, filled: false }],
      },
    ]
    expect(orderReward(state.orders[0], cfg)).toBe(80)
    expect(orderPayout(state.orders[0], cfg).smiles).toBe(2)
    state.locks = []
    state.board[0][0] = makeProduct(state, 'food', 6)
    const result = completeOrder(state, 'big', cfg, rng, 3)
    expect(result.events[0]).toMatchObject({
      big: true,
      coins: 80,
      smiles: 2,
      dialogue: '这一桌，员外我包下了。',
    })
    expect(state.coins).toBe(80)
    expect(state.orders).toHaveLength(3)
  })

  it('报酬倍率立刻作用在还没交的订单上', () => {
    const { state, cfg } = boot()
    cfg.economy.orderRewardScale = 2
    expect(orderReward(state.orders[0], cfg)).toBe(16)
  })

  it('没有的产线不会被点单；没合出四级以前不点四级', () => {
    const { state, cfg } = boot()
    state.board = state.board.map((row) =>
      row.map((item) => (item?.kind === 'producer' && item.producerId !== 'food' ? null : item)),
    )
    state.rewards = []
    state.pending = state.pending.filter((item) => !(item.kind === 'producer' && item.producerId !== 'food'))
    state.unlocked.food = 0
    const starter = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (starter?.kind === 'producer') starter.level = 4
    for (let i = 0; i < 24; i++) {
      const order = generateOrder(state, cfg, mulberry32(i + 3))
      if (!order) throw new Error('order')
      expect(order.big).toBe(false)
      for (const slot of order.slots) expect(slot.line).toBe('food')
      if (order.slots.length === 1) expect(order.slots[0]?.level).toBe(cfg.economy.earlyOrderALevel)
      else {
        expect(order.slots).toHaveLength(2)
        for (const slot of order.slots) {
          expect(slot.level).toBeGreaterThanOrEqual(cfg.economy.earlyOrderBMin)
          expect(slot.level).toBeLessThanOrEqual(cfg.economy.earlyOrderBMax)
        }
      }
    }
    state.level = 4
    state.unlocked.food = 4
    const food = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (food?.kind === 'producer') food.level = 4
    cfg.orders.twoSlotChance = 0
    cfg.orders.bigChance = 0
    const higher = generateOrder(state, cfg, () => 0.99)
    expect(higher?.slots).toEqual([{ line: 'food', level: 4, filled: false }])
    state.unlocked.food = 6
    cfg.orders.bigChance = 1
    const big = generateOrder(state, cfg, () => 0)
    expect(big?.big).toBe(true)
    expect(big?.slots[0].level).toBe(6)
  })

  it('六位客人轮流下单，同时在场不重复', () => {
    const { state, cfg } = boot()
    state.phase = 'play'
    state.level = 5
    const starter = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (starter?.kind === 'producer') starter.level = 4
    cfg.economy.chestOrderChance = 0
    state.orders = []
    const seen = new Set<string>()
    const roster = ['boatman', 'embroider', 'fisherman', 'squire', 'scholar', 'teaGuest']
    for (let turn = 0; turn < 8; turn++) {
      const ids = state.orders.map((order) => order.customerId)
      expect(new Set(ids).size, ids.join(',')).toBe(ids.length)
      for (const id of ids) {
        expect(roster).toContain(id)
        seen.add(id)
      }
      state.orders.shift()
      const order = generateOrder(state, cfg, mulberry32(turn + 2))
      if (!order) throw new Error('order')
      state.orders.push(order)
    }
    for (const id of roster) expect(seen.has(id), id).toBe(true)
  })

  it('跳过开局后直接三张订单，棋盘上仍有蒸笼', () => {
    const { state, cfg, rng } = boot()
    skipOpening(state, cfg, rng)
    expect(state.phase).toBe('play')
    expect(state.orders).toHaveLength(3)
    expect(state.showHelp).toBe(true)
    expect(state.board.some((row) => row.some((item) => item?.kind === 'producer'))).toBe(true)
  })

  it('开局单在第四步完成时给出购物袋，不补满三张', () => {
    const { state, cfg, rng } = boot()
    state.phase = 'opening'
    const deliver = cfg.copy.tutorial.findIndex((step) => step.id === 'deliver')
    state.openingStep = deliver
    state.locks = state.locks.filter((lock) => !(lock.row === 4 && lock.col === 4))
    state.board[4][4] = makeProduct(state, 'food', 3)
    const result = completeOrder(state, 'tutorial', cfg, rng, 20)
    expect(result.ok).toBe(true)
    expect(state.coins).toBe(8)
    expect(state.smiles).toBe(1)
    expect(state.energy).toBe(100)
    expect(state.openingStep).toBe(deliver + 1)
    expect(state.orders).toHaveLength(0)
    const onBoard = state.board.some((row) => row.some((item) => item?.kind === 'product' && item.tag === 'bag'))
    const inPending = state.pending.some((item) => item.kind === 'product' && item.tag === 'bag')
    expect(onBoard || inPending).toBe(true)
  })
})
