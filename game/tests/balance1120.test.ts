import { describe, expect, it } from 'vitest'
import { BALANCE, earlyOrder, energyOfPieceLevel, parseRewardText, storyDef } from '../src/balance1120'
import { defaultConfig } from '../src/config'
import {
  buildTask,
  claimGiftModal,
  claimLevelModal,
  completeOrder,
  createGame,
  dropItem,
  fillOrders,
  hydrate,
  lockAt,
  makeProducer,
  makeProduct,
  maybeOfferStory,
  mulberry32,
  nextTask,
  openStoryCard,
  resolveGuides,
  serialize,
  syncEarlyOrders,
} from '../src/logic/sim'

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
    expect(parseRewardText('老鼠玩具1 ×1')[0]).toMatchObject({ id: 'product', line: 'toy', pieceLevel: 1 })
    expect(parseRewardText('狗2 ×1')[0]).toMatchObject({ id: 'product', line: 'dog', pieceLevel: 2 })
    expect(parseRewardText('红色宝箱 ×1')[0]?.id).toBe('red')
    expect(parseRewardText('欢迎礼盒 ×1')[0]?.id).toBe('welcome')
    expect(parseRewardText('存钱罐（金猪）×1')[0]?.id).toBe('piggy')
  })

  it('开局教学盘沿用旧版：b4、b5 是 1 级，c5 半遮 2 级，d5 封着 3 级', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    const at = (row: number, col: number) => ({
      item: state.board[row]?.[col],
      lock: state.locks.find((lock) => lock.row === row && lock.col === col),
    })
    const b4 = at(3, 1)
    const b5 = at(4, 1)
    const c5 = at(4, 2)
    const d5 = at(4, 3)
    expect(b4.lock).toBeUndefined()
    expect(b4.item?.kind === 'producer' && b4.item.level).toBe(1)
    expect(b5.item?.kind === 'producer' && b5.item.level).toBe(1)
    expect(c5.lock?.veil).toBe('half')
    expect(c5.lock?.buried).toMatchObject({ kind: 'producer', id: 'food', level: 2 })
    expect(d5.lock?.veil).toBe('full')
    expect(d5.lock?.buried).toMatchObject({ kind: 'producer', id: 'food', level: 3 })
    expect(state.orders).toEqual([])
  })

  it('前期订单按编号出，线没开也不跳号', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.lesson = 'free'
    state.phase = 'play'
    state.board[3][1] = makeProducer(state, 'food', cfg, 4)
    state.orderSeq = 5
    syncEarlyOrders(state, cfg)
    expect(state.heldOrders).toEqual([])
    expect(state.orders.map((order) => order.earlyNo)).toEqual([5, 6])
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

  it('剧情 15 经验按级清零，奖励只在升到那一级时发，开局没有饮料母棋', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    expect(state.board.flat().some((item) => item?.kind === 'producer' && item.producerId === 'bev')).toBe(false)
    expect(state.locks.some((lock) => lock.buried.kind === 'producer' && lock.buried.id === 'bev')).toBe(false)
    state.lesson = 'free'
    state.phase = 'play'
    state.coins = 100_000
    const rng = mulberry32(4)
    const log: { level: number; xp: number; rewards: string[] }[] = []
    for (let i = 0; i < 9; i++) {
      const task = nextTask(state, cfg)
      expect(task?.id).toBe(`s${i + 1}`)
      expect(buildTask(state, task!.id, null, cfg, rng, i).ok).toBe(true)
      const rewards: string[] = []
      while (state.levelModal) {
        rewards.push(...state.levelModal.rewards.map((reward) => `${reward.id}:${reward.producerLevel ?? ''}`))
        claimLevelModal(state, cfg, rng)
      }
      log.push({ level: state.level, xp: state.xp, rewards })
    }
    expect(log[0]).toEqual({ level: 1, xp: 15, rewards: [] })
    expect(log[1]).toMatchObject({ level: 2, xp: 0 })
    expect(log[1]?.rewards).toEqual(expect.arrayContaining(['chest:', 'welcome:', 'food:4', 'gift:']))
    expect(log[1]?.rewards.some((reward) => reward.startsWith('bev'))).toBe(false)
    expect(log[2]).toEqual({ level: 2, xp: 15, rewards: [] })
    expect(log[3]).toEqual({ level: 2, xp: 30, rewards: [] })
    expect(log[4]?.level).toBe(3)
    expect(log[4]?.xp).toBe(0)
    expect(log[4]?.rewards).toContain('bev:1')
    expect(log[5]).toEqual({ level: 3, xp: 15, rewards: [] })
    expect(log[8]).toEqual({ level: 4, xp: 0, rewards: expect.arrayContaining(['chest:']) })
    expect(log[8]?.rewards.some((reward) => reward.startsWith('bev'))).toBe(false)
    const owned = [...state.board.flat(), ...state.rewards, ...state.pending]
    expect(owned.some((item) => item?.kind === 'product' && item.line === 'toy' && item.level === 1)).toBe(true)
    expect(owned.some((item) => item?.kind === 'producer' && item.producerId === 'piggy')).toBe(true)
    expect(owned.some((item) => item?.kind === 'chest' && item.box === 'red')).toBe(true)
    const bev = owned.find((item) => item?.kind === 'producer' && item.producerId === 'bev')
    expect(bev?.kind === 'producer' && bev.level).toBe(1)
    const before = state.xp
    state.locks = state.locks.filter((lock) => lock.row !== 0 || lock.col !== 0)
    state.board[0][0] = makeProduct(state, 'food', 3)
    state.orders = [{ id: 'pay', customerId: 'xiaotao', big: false, slots: [{ line: 'food', level: 3, filled: false }], payCoins: 2 }]
    expect(completeOrder(state, 'pay', cfg, rng, 9).ok).toBe(true)
    expect(state.xp).toBe(before)
    expect(state.level).toBe(4)
  })

  it('做到剧情 14 升到 5 级，子棋和红色宝箱都在', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.lesson = 'free'
    state.phase = 'play'
    state.coins = 100_000
    const rng = mulberry32(8)
    const log: { level: number; xp: number }[] = []
    for (let i = 0; i < 14; i++) {
      const task = nextTask(state, cfg)
      expect(buildTask(state, task!.id, null, cfg, rng, i).ok).toBe(true)
      while (state.levelModal) claimLevelModal(state, cfg, rng)
      while (state.giftModal) claimGiftModal(state, cfg, rng)
      log.push({ level: state.level, xp: state.xp })
    }
    expect(log.map((row) => row.level)).toEqual([1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5])
    expect(log[13]).toEqual({ level: 5, xp: 0 })
    const owned = [...state.board.flat(), ...state.rewards, ...state.pending]
    expect(owned.some((item) => item?.kind === 'product' && item.line === 'mint' && item.level === 3)).toBe(true)
    expect(owned.some((item) => item?.kind === 'product' && item.line === 'toy' && item.level === 1)).toBe(true)
    expect(owned.some((item) => item?.kind === 'chest' && item.box === 'red')).toBe(true)
    expect(owned.some((item) => item?.kind === 'producer' && item.producerId === 'piggy')).toBe(true)
    expect(state.bubbleDue).toBe(true)
  })

  it('剧情 6 弹窗同时列钻石和体力，领取前不发', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.lesson = 'free'
    state.phase = 'play'
    state.coins = 100_000
    const rng = mulberry32(6)
    for (let i = 0; i < 5; i++) {
      const task = nextTask(state, cfg)
      expect(buildTask(state, task!.id, null, cfg, rng, i).ok).toBe(true)
      while (state.levelModal) claimLevelModal(state, cfg, rng)
      while (state.giftModal) claimGiftModal(state, cfg, rng)
    }
    const energy = state.energy
    const gems = state.gems
    const task = nextTask(state, cfg)
    expect(task?.id).toBe('s6')
    expect(buildTask(state, task!.id, null, cfg, rng, 6).ok).toBe(true)
    expect(state.giftModal?.mode).toBe('claim')
    const names = state.giftModal?.rewards.map((reward) => reward.name) ?? []
    expect(names.some((name) => name.includes('钻石') && name.includes('10'))).toBe(true)
    expect(names.some((name) => name.includes('体力') && name.includes('50'))).toBe(true)
    expect(state.energy).toBe(energy)
    expect(state.gems).toBe(gems)
    claimGiftModal(state, cfg, rng)
    expect(state.energy).toBe(energy + 50)
    expect(state.gems).toBe(gems + 10)
    expect(state.giftModal?.mode === 'claim').toBe(false)
  })

  it('4 级笑脸教学等礼包弹窗关掉再出现', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.lesson = 'free'
    state.phase = 'play'
    state.coins = 100_000
    const rng = mulberry32(9)
    for (let i = 0; i < 8; i++) {
      const task = nextTask(state, cfg)
      expect(buildTask(state, task!.id, null, cfg, rng, i).ok).toBe(true)
      while (state.levelModal) claimLevelModal(state, cfg, rng)
      while (state.giftModal) claimGiftModal(state, cfg, rng)
    }
    const task = nextTask(state, cfg)
    expect(buildTask(state, task!.id, null, cfg, rng, 9).ok).toBe(true)
    while (state.levelModal) claimLevelModal(state, cfg, rng)
    expect(state.level).toBe(4)
    expect(state.smileLesson).toBe('wait')
    expect(state.giftModal).toBeTruthy()
    while (state.giftModal) claimGiftModal(state, cfg, rng)
    expect(state.giftModal).toBeNull()
    expect(state.smileLesson).toBe('order')
  })

  it('教学合出订单要的猫粮就进入交单，旧档带不回 4 级饮料母棋', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'opening'
    state.openingStep = cfg.copy.tutorial.length
    state.lesson = 'focus'
    state.orders = [{ id: 'e1', customerId: 'xiaotao', big: false, scripted: true, slots: [{ line: 'food', level: 3, filled: false }], payCoins: 2 }]
    state.locks = state.locks.filter((lock) => lock.row !== 0 || lock.col !== 0)
    state.board[0][0] = makeProduct(state, 'food', 2)
    state.locks = state.locks.filter((lock) => lock.row !== 0 || lock.col !== 1)
    state.locks.push({ row: 0, col: 1, cover: 'sand', veil: 'half', buried: { kind: 'product', line: 'food', level: 2 } })
    expect(dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 }, cfg).ok).toBe(true)
    expect(lockAt(state, 0, 1)).toBeUndefined()
    expect(state.lesson).toBe('deliver')
    state.lesson = 'focus'
    state.board[0][1] = makeProduct(state, 'food', 3)
    resolveGuides(state, cfg)
    expect(state.lesson).toBe('deliver')

    const stale = createGame(2, cfg)
    stale.level = 4
    stale.xp = 30
    stale.tasksDone = ['s1', 's2']
    stale.board[1][1] = { uid: 'tea', kind: 'producer', producerId: 'bev', line: 'bev', level: 4, charges: 9, cooldownUntil: 0 }
    const raw = JSON.parse(serialize(stale, cfg)) as { curve?: string; economy: typeof cfg.economy }
    delete raw.curve
    raw.economy = {
      ...cfg.economy,
      levelTaskThresholds: [10, 10, 10],
      levelRewards: [{ level: 4, rewards: [{ id: 'bev', name: '4级饮料母棋', producerLevel: 4 }] }],
    }
    const next = defaultConfig()
    const loaded = hydrate(JSON.stringify(raw), next)
    expect(loaded?.level).toBe(2)
    expect(loaded?.xp).toBe(0)
    expect(next.economy.levelTaskThresholds[0]).toBe(30)
    expect(next.economy.levelRewards.find((entry) => entry.level === 4)?.rewards.some((reward) => reward.id === 'bev')).toBe(false)
  })
})
