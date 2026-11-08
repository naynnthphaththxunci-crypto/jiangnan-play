import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import { layout, type LayoutInput } from '../src/layout'
import {
  advanceDialogue,
  advanceStory,
  canSell,
  clearSale,
  createGame,
  currentTutorial,
  guardedDrop,
  lineChain,
  makeChest,
  makePotion,
  makeProducer,
  makeProduct,
  mulberry32,
  orderCardAction,
  orderMarks,
  orderSatisfied,
  orderStripAction,
  orderTakeCells,
  pickHint,
  sellItem,
  skipStory,
  storyLength,
  tutorialAllowsInspect,
  undoSale,
} from '../src/logic/sim'

function boot() {
  const cfg = defaultConfig()
  const state = createGame(1_700_000_000_000, cfg)
  state.phase = 'opening'
  return { cfg, state, rng: mulberry32(4) }
}

function frame(over: Partial<LayoutInput> = {}) {
  return layout({
    w: 390,
    h: 844,
    insetTop: 0,
    insetBottom: 0,
    mode: 'board',
    orderCount: 1,
    orderSlots: [1],
    orderScroll: 0,
    showHint: false,
    showSheet: false,
    showSkip: false,
    showDaily: false,
    showHouseBtn: true,
    showStorage: false,
    showSmile: false,
    choiceCount: 0,
    tuner: false,
    tunerScroll: 0,
    modal: false,
    help: false,
    showEnter: false,
    showInfo: false,
    ...over,
  })
}

describe('第三轮教学、订单和布局', () => {
  it('新存档先进入剧情，剧情结束后进入教学', () => {
    const cfg = defaultConfig()
    const state = createGame(1_700_000_000_000, cfg)
    expect(state.phase).toBe('story')
    expect(state.storyStep).toBe(0)
    expect(cfg.opening[storyLength(cfg) - 1]?.scene.includes('小铺')).toBe(true)
    for (let i = 0; i < storyLength(cfg); i++) advanceStory(state, cfg)
    expect(state.phase).toBe('opening')
    expect(state.storySeen).toBe(true)
    expect(currentTutorial(cfg, state)?.id).toBe('merge')
    const skipped = createGame(1_700_000_000_000, cfg)
    skipStory(skipped)
    expect(skipped.phase).toBe('opening')
    expect(skipped.openingStep).toBe(0)
  })

  it('对话步点任意处能过，操作步点错不过也不给说明', () => {
    const { state, cfg } = boot()
    state.openingStep = cfg.copy.tutorial.findIndex((step) => step.id === 'merge')
    expect(advanceDialogue(state, cfg)).toBe(false)
    expect(advanceDialogue(state, cfg)).toBe(false)
    expect(tutorialAllowsInspect(state)).toBe(false)
    const step = state.openingStep
    const wrong = guardedDrop(state, { row: 3, col: 1 }, { row: 0, col: 0 }, cfg)
    expect(wrong.ok).toBe(false)
    expect(wrong.events).toEqual([])
    expect(state.openingStep).toBe(step)
    expect(state.board[3]?.[1]?.kind).toBe('producer')
  })

  it('玩家能看到的文字里没有面包', () => {
    const banned = '面' + '包'
    const cfg = defaultConfig()
    expect(JSON.stringify(cfg).includes(banned)).toBe(false)
    expect(cfg.copy.tutorial[0]?.text).toContain('猫粮母棋')
  })

  it('点订单空白处不交单，只有完成按钮能交', () => {
    const { state } = boot()
    const order = state.orders[0]
    if (!order) throw new Error('missing order')
    const button = { x: 10, y: 80, w: 40, h: 24 }
    expect(orderCardAction(state, order, 12, 20, button)).toBe('none')
    state.locks = state.locks.filter((lock) => !(lock.row === 4 && lock.col === 4))
    state.board[4][4] = makeProduct(state, 'food', 3)
    expect(orderSatisfied(state, order)).toBe(true)
    expect(orderCardAction(state, order, 12, 20, button)).toBe('none')
    expect(orderCardAction(state, order, 20, 90, button)).toBe('complete')
  })

  it('滑动订单栏不触发交单，也不误开图鉴', () => {
    expect(orderStripAction({ moved: true, dx: -48, onComplete: true, onIcon: true })).toBe('scroll')
    expect(orderStripAction({ moved: false, dx: 2, onComplete: true, onIcon: true })).toBe('complete')
    expect(orderStripAction({ moved: false, dx: 0, onComplete: false, onIcon: true })).toBe('icon')
    expect(orderStripAction({ moved: false, dx: 0, onComplete: false, onIcon: false })).toBe('none')
    const wide = frame({ orderCount: 4, orderSlots: [1, 1, 1, 1] })
    expect(wide.orders[0]?.x).toBeGreaterThan(40)
    expect(wide.orderMaxScroll).toBeGreaterThan(0)
    expect(wide.orderIcons[0]?.rect.w).toBeGreaterThan(10)
  })

  it('状态切换不改变棋盘和说明栏', () => {
    const base = frame()
    const changed = frame({
      orderCount: 3,
      orderSlots: [2, 1, 2],
      orderScroll: 40,
      showInfo: true,
      showStorage: true,
      showSmile: true,
      showSkip: true,
      showEnter: true,
      modal: true,
      help: true,
      tuner: true,
      showDaily: true,
    })
    expect(changed.board).toEqual(base.board)
    expect(changed.infoBar).toEqual(base.infoBar)
    expect(changed.infoBar.x).toBeGreaterThan(base.pendingBtn.x + base.pendingBtn.w - 1)
    expect(changed.infoBar.x + changed.infoBar.w).toBeLessThanOrEqual(base.houseBtn.x + 1)
    expect(frame({ w: 360, h: 780 }).board).not.toEqual(base.board)
  })

  it('部分凑齐只打勾，凑齐的格子和交单扣除是同一批', () => {
    const { state } = boot()
    state.phase = 'play'
    state.locks = []
    state.board = state.board.map((row) => row.map(() => null))
    state.board[1][0] = makeProduct(state, 'food', 3)
    state.board[1][2] = makeProduct(state, 'food', 3)
    state.board[2][0] = makeProduct(state, 'tea', 3)
    state.orders = [
      { id: 'full', customerId: 'xiaotao', big: false, slots: [{ line: 'food', level: 3, filled: false }] },
      {
        id: 'part',
        customerId: 'teaGuest',
        big: false,
        slots: [
          { line: 'tea', level: 3, filled: false },
          { line: 'tea', level: 3, filled: false },
        ],
      },
    ]
    const full = state.orders[0]
    const part = state.orders[1]
    if (!full || !part) throw new Error('orders')
    const taken = orderTakeCells(state, full)
    expect(taken).toEqual([{ row: 1, col: 0 }])
    expect(orderTakeCells(state, part)).toEqual([])
    expect(orderSatisfied(state, part)).toBe(false)
    const marks = orderMarks(state)
    expect(marks.ready).toEqual(['1,0'])
    expect(marks.check).toEqual(expect.arrayContaining(['1,0', '1,2', '2,0']))
    expect(marks.ready).not.toContain('1,2')
    expect(marks.ready).not.toContain('2,0')
    state.pending.push(makeProduct(state, 'tea', 3))
    expect(orderSatisfied(state, part)).toBe(false)
  })

  it('软提示按交单、解锁、合并、母棋的顺序', () => {
    const { state, cfg } = boot()
    state.phase = 'play'
    state.locks = [{ row: 1, col: 1, cover: 'sand', buried: { kind: 'product', line: 'tea', level: 1 } }]
    state.board[1][1] = null
    state.board[0][0] = makeProduct(state, 'tea', 1)
    state.board[0][1] = makeProduct(state, 'tea', 1)
    state.board[2][0] = makeProduct(state, 'food', 3)
    state.orders = [{ id: 'o', customerId: 'xiaotao', big: false, slots: [{ line: 'food', level: 3, filled: false }] }]
    expect(pickHint(state, 0)?.type).toBe('complete')
    state.orders = []
    expect(pickHint(state, 0)?.type).toBe('unlock')
    state.locks = []
    expect(pickHint(state, 0)?.type).toBe('merge')
    state.board[0][0] = null
    state.board[0][1] = null
    state.board[3][2] = null
    state.board[3][3] = null
    state.board.forEach((row) => {
      row.forEach((item, c) => {
        if (item?.kind === 'producer') row[c] = null
      })
    })
    state.board[3][1] = makeProducer(state, 'food', cfg, 4)
    expect(pickHint(state, 0)?.type).toBe('produce')
    void cfg
  })

  it('卖出会加铜钱，撤回还原，其他操作后不能撤回，不能卖的没有按钮', () => {
    const { state, cfg } = boot()
    state.phase = 'play'
    state.locks = []
    state.board[0][0] = makeProduct(state, 'food', 1)
    state.coins = 0
    expect(sellItem(state, cfg, { row: 0, col: 0 }).ok).toBe(true)
    expect(state.coins).toBe(1)
    expect(state.board[0]?.[0]).toBeNull()
    expect(undoSale(state).ok).toBe(true)
    expect(state.coins).toBe(0)
    expect(state.board[0]?.[0]?.kind).toBe('product')
    expect(sellItem(state, cfg, { row: 0, col: 0 }).ok).toBe(true)
    clearSale(state)
    expect(undoSale(state).ok).toBe(false)
    expect(state.board[0]?.[0]).toBeNull()
    state.board[0][1] = makeProducer(state, 'food', cfg)
    state.board[0][2] = makePotion(state, 1)
    state.board[0][3] = makeChest(state)
    expect(canSell(state, state.board[0]?.[1] ?? null)).toBe(false)
    expect(canSell(state, state.board[0]?.[2] ?? null)).toBe(false)
    expect(canSell(state, state.board[0]?.[3] ?? null)).toBe(false)
    state.phase = 'opening'
    state.board[1][0] = makeProduct(state, 'food', 3)
    expect(canSell(state, state.board[1]?.[0] ?? null)).toBe(false)
  })

  it('已见过的等级显示名字，没见过的显示问号', () => {
    const { state, cfg } = boot()
    state.seen.food = [1]
    const chain = lineChain(cfg, state, 'food', 3)
    expect(chain.find((slot) => slot.level === 1)?.label).toBe('饱满麦粒')
    expect(chain.find((slot) => slot.level === 2)?.label).toBe('?')
    expect(chain.find((slot) => slot.level === 3)?.current).toBe(true)
    expect(chain.find((slot) => slot.level === 3)?.label).toBe('?')
    state.seen.food = [1, 3]
    const seen = lineChain(cfg, state, 'food', 3)
    expect(seen.find((slot) => slot.level === 3)?.label).toBe('混合粗粮团')
    expect(seen.find((slot) => slot.level === 4)?.label).toBe('?')
  })
})
