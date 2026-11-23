import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import {
  completeOrder,
  createGame,
  generateOrder,
  makeProduct,
  syncEarlyOrders,
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
  it('教学走到出货后才有小桃的第一单，金币照表是 2', () => {
    const { state, cfg } = boot()
    state.lesson = 'free'
    const producer = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (producer?.kind === 'producer') producer.level = 4
    syncEarlyOrders(state, cfg)
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0].scripted).toBe(true)
    expect(state.orders[0].slots).toEqual([{ line: 'food', level: 3, filled: false }])
    expect(state.orders[0].payCoins).toBe(2)
    expect(taskPrice(allTasks(cfg)[0], cfg)).toBe(26)
  })

  it('没齐不能点完成，齐了一次扣掉棋盘上的物品', () => {
    const { state, cfg, rng } = boot()
    state.locks = []
    state.phase = 'play'
    state.lesson = 'free'
    const food = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (food?.kind === 'producer') food.level = 4
    state.orders = [
      {
        id: 'mix',
        customerId: 'scholar',
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
    expect(done.events[0]).toMatchObject({ type: 'deliver', coins: 4, smiles: 0, xp: 0 })
    expect(state.board[0][0]).toBeNull()
    expect(state.board[0][1]).toBeNull()
    expect(state.energy).toBe(100)
    state.lesson = 'free'
    expect(state.orders.length).toBeGreaterThan(0)
    expect(state.orders.some((order) => order.id === 'mix')).toBe(false)
  })

  it('大单金边报酬是三级单的十倍，并带街坊台词', () => {
    const { state, cfg, rng } = boot()
    state.phase = 'play'
    state.lesson = 'free'
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
    expect(orderPayout(state.orders[0], cfg).smiles).toBe(0)
    expect(orderPayout(state.orders[0], cfg).xp).toBe(0)
    state.locks = []
    state.board[0][0] = makeProduct(state, 'food', 6)
    const result = completeOrder(state, 'big', cfg, rng, 3)
    expect(result.events[0]).toMatchObject({
      big: true,
      coins: 80,
      smiles: 0,
      dialogue: '这一桌，员外我包下了。',
    })
    expect(state.coins).toBe(80)
    expect(state.orders.length).toBeGreaterThan(0)
  })

  it('报酬倍率立刻作用在还没交的订单上', () => {
    const { state, cfg } = boot()
    state.lesson = 'free'
    const producer = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (producer?.kind === 'producer') producer.level = 4
    syncEarlyOrders(state, cfg)
    cfg.economy.orderRewardScale = 2
    expect(orderPayout(state.orders[0], cfg).coins).toBe(2)
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

  it('新订单从七个新角色里挑', () => {
    const { state, cfg } = boot()
    state.phase = 'play'
    state.level = 5
    const starter = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (starter?.kind === 'producer') starter.level = 4
    cfg.economy.chestOrderChance = 0
    state.orders = []
    const roster = ['ghost', 'mengpo', 'xiaotao', 'liuyan', 'jin', 'zhongkui', 'ajiang']
    const seen = new Set<string>()
    for (let turn = 0; turn < 20; turn++) {
      const order = generateOrder(state, cfg, mulberry32(turn + 2))
      if (!order) throw new Error('order')
      expect(roster).toContain(order.customerId)
      seen.add(order.customerId)
      state.orders = [order]
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('跳过开局后直接三张订单，棋盘上仍有蒸笼', () => {
    const { state, cfg, rng } = boot()
    skipOpening(state, cfg, rng)
    expect(state.phase).toBe('play')
    expect(state.lesson).toBe('free')
    expect(state.orders).toHaveLength(0)
    const granted = state.rewards.find((item) => item.kind === 'producer' && item.producerId === 'food')
    expect(granted?.kind === 'producer' && granted.level).toBeGreaterThanOrEqual(4)
    if (granted) {
      state.board[0][0] = granted
      state.rewards = state.rewards.filter((item) => item !== granted)
    }
    syncEarlyOrders(state, cfg)
    expect(state.orders).toHaveLength(1)
    expect(state.orders[0]?.earlyNo).toBe(1)
    expect(state.showHelp).toBe(true)
    expect(state.board.some((row) => row.some((item) => item?.kind === 'producer'))).toBe(true)
  })

  it('开局教学没结束前交单不补满三张', () => {
    const { state, cfg } = boot()
    state.phase = 'opening'
    state.lesson = 'merge'
    state.openingStep = 0
    syncEarlyOrders(state, cfg)
    expect(state.orders).toHaveLength(0)
  })
})
