import { describe, expect, it } from 'vitest'
import { BALANCE, cellPos, earlyOrder, energyOfPieceLevel, parseRewardText, storyDef } from '../src/balance1120'
import { defaultConfig } from '../src/config'
import { buildTask, createGame, fillOrders, makeProducer, maybeOfferStory, mulberry32, openStoryCard, syncEarlyOrders } from '../src/logic/sim'

describe('1120 数值表', () => {
  it('前期订单照抄，冲突单也不改金币', () => {
    expect(BALANCE.ordersEarly).toHaveLength(131)
    expect(earlyOrder(1)?.items.map((item) => `${item.line}${item.level}`)).toEqual(['food3'])
    expect(earlyOrder(1)?.coins).toBe(2)
    expect(earlyOrder(9)?.coins).toBe(32)
    expect(earlyOrder(11)?.coins).toBe(8)
    expect(earlyOrder(58)?.coins).toBe(38)
    expect(earlyOrder(98)?.items.map((item) => `${item.line}${item.level}`)).toEqual(['fish3', 'bev6'])
    expect(earlyOrder(110)?.items.map((item) => `${item.line}${item.level}`)).toEqual(['fish5', 'plant2'])
    for (const order of BALANCE.ordersEarly) {
      expect(order.no).toBeGreaterThan(0)
      expect(order.coins).toBeGreaterThan(0)
      expect(order.items.length).toBeGreaterThan(0)
    }
  })

  it('剧情经验固定 15，升级经验按表', () => {
    expect(BALANCE.storyXp).toBe(15)
    expect(BALANCE.stories[0]?.cost).toBe(26)
    expect(BALANCE.stories[1]?.cost).toBe(16)
    expect(BALANCE.levels.map((level) => level.xp).slice(0, 4)).toEqual([30, 45, 60, 75])
    const cfg = defaultConfig()
    expect(cfg.economy.xpPerTask).toBe(15)
    expect(cfg.economy.levelTaskThresholds[0]).toBe(30)
    expect(cfg.items.potions.map((potion) => potion.energy)).toEqual([2, 6, 15, 40, 100])
    expect(['体力4', '体力3', '体力2', '体力1', '体力1'].map(energyOfPieceLevel)).toEqual([40, 15, 6, 2, 2])
    expect(cfg.economy.newbieChest).toEqual([40, 15, 6, 2, 2])
    expect(parseRewardText('猫粮母棋4 ×1')[0]?.producerLevel).toBe(4)
    expect(parseRewardText('花盆母棋3 ×1')[0]?.producerLevel).toBe(3)
    expect(parseRewardText('饮料母棋1 ×1')[0]?.producerLevel).toBe(1)
    expect(parseRewardText('玩具母棋（原文未写等级，【推断】1级）×1')[0]?.producerLevel).toBe(1)
  })

  it('开局盘 b4、b5 是 2 级猫粮母棋，c5 半遮 3 级', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    const at = (cell: string) => {
      const pos = cellPos(cell)
      return { item: state.board[pos.row]?.[pos.col], lock: state.locks.find((lock) => lock.row === pos.row && lock.col === pos.col) }
    }
    const b4 = at('b4')
    const b5 = at('b5')
    const c5 = at('c5')
    expect(b4.lock).toBeUndefined()
    expect(b4.item?.kind === 'producer' && b4.item.level).toBe(2)
    expect(b5.item?.kind === 'producer' && b5.item.level).toBe(2)
    expect(c5.lock?.veil).toBe('half')
    expect(c5.lock?.buried).toMatchObject({ kind: 'producer', id: 'food', level: 3 })
    expect(state.orders).toEqual([])
  })

  it('挂起还不能做的单，解锁后优先出', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.lesson = 'free'
    state.phase = 'play'
    state.board[3][1] = makeProducer(state, 'food', cfg, 4)
    state.orderSeq = 5
    syncEarlyOrders(state, cfg)
    expect(state.heldOrders[0]).toBe(5)
    expect(state.orders.map((order) => order.earlyNo)).toEqual([9, 12])
    state.orders = []
    state.board[3][1] = makeProducer(state, 'food', cfg, 5)
    syncEarlyOrders(state, cfg)
    expect(state.orders[0]?.earlyNo).toBe(5)
    expect(state.orders[0]?.payCoins).toBe(14)
  })

  it('纯对话、没奖励、钱够才自动弹下一张任务', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.lesson = 'free'
    state.phase = 'play'
    state.coins = 100
    const rng = mulberry32(1)
    buildTask(state, 's1', null, cfg, rng, 1)
    expect(state.storyCard == null).toBe(true)
    expect(state.xp).toBe(15)
    buildTask(state, 's2', null, cfg, rng, 1)
    expect(state.storyCard?.no).toBe(3)
    state.coins = 0
    maybeOfferStory(state, cfg, 2)
    expect(state.storyCard == null).toBe(true)
    state.coins = 24
    openStoryCard(state, cfg)
    expect(state.storyCard?.no).toBe(3)
    expect(storyDef(11)?.cost).toBe(26)
    expect(storyDef(1)?.xp).toBe(15)
  })

  it('131 单之后不出没解锁的线，10 级前不卡关', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.lesson = 'free'
    state.phase = 'play'
    state.board[3][1] = makeProducer(state, 'food', cfg, 4)
    state.orderSeq = 132
    state.level = 4
    fillOrders(state, cfg, mulberry32(2))
    expect(state.orders.length).toBeGreaterThan(0)
    expect(state.orders.length).toBeLessThanOrEqual(6)
    expect(state.orders.every((order) => order.slots.every((slot) => slot.line === 'food'))).toBe(true)
    expect(state.orders.some((order) => order.blocker)).toBe(false)
    expect(state.orders.every((order) => order.slots.every((slot) => slot.level >= 3))).toBe(true)
  })
})
