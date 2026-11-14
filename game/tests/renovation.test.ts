import { describe, expect, it } from 'vitest'
import { defaultConfig, hostessCostume } from '../src/config'
import {
  allTasks,
  buildTask,
  claimLevelModal,
  confirmDecor,
  completeOrder,
  createGame,
  findProducer,
  hydrate,
  levelForTaskCount,
  makeProduct,
  mulberry32,
  nextTask,
  previewDecor,
  reopenDecor,
  serialize,
  taskPrice,
} from '../src/logic/sim'
import type { GameState } from '../src/types'

function boot() {
  const cfg = defaultConfig()
  const state = createGame(1_700_000_000_000, cfg)
  const rng = mulberry32(11)
  return { cfg, state, rng }
}

function finish(state: GameState, cfg: ReturnType<typeof defaultConfig>, n: number) {
  const rng = mulberry32(3)
  state.coins = 100_000
  for (let i = 0; i < n; i++) {
    const task = nextTask(state, cfg)
    if (!task) throw new Error('no task')
    const choice = task.choices?.[0]?.id ?? null
    const result = buildTask(state, task.id, choice, cfg, rng, 1_000 + i)
    if (!result.ok) throw new Error(result.reason ?? 'build failed')
    if (state.decorate) confirmDecor(state, cfg)
    while (state.levelModal) claimLevelModal(state, cfg, rng)
  }
}

describe('修缮', () => {
  it('配置表是六条链、十二件小活，女掌柜有当前衣装', () => {
    const { cfg } = boot()
    expect(cfg.items.lines.map((line) => line.id)).toEqual([
      'food',
      'meat',
      'bev',
      'mint',
      'toy',
      'wand',
      'bed',
      'fish',
      'plant',
      'coin',
      'gemline',
    ])
    expect(cfg.items.lines.find((line) => line.id === 'food')?.levels).toHaveLength(10)
    expect(cfg.items.lines.find((line) => line.id === 'bed')?.levels).toHaveLength(10)
    expect(cfg.items.lines.find((line) => line.id === 'plant')?.levels).toHaveLength(7)
    expect(allTasks(cfg)).toHaveLength(12)
    expect(cfg.buildings.steps.map((step) => step.tasks.length)).toEqual([4, 4, 4])
    expect(hostessCostume(cfg)).toBe('布衣')
    expect(cfg.economy.levelTaskThresholds).toEqual([2, 4, 6, 8, 10, 11, 12])
    expect(cfg.economy.xpPerTask).toBe(15)
    expect(levelForTaskCount(12, cfg)).toBe(8)
  })

  it('铜钱不够、跳着做、重复做都不算', () => {
    const { state, cfg, rng } = boot()
    const denied = buildTask(state, 't1', null, cfg, rng, 1)
    expect(denied.reason).toBe('coins')
    expect(state.tasksDone).toEqual([])
    expect(state.xp).toBe(0)
    state.coins = 8
    expect(buildTask(state, 't2', null, cfg, rng, 2).reason).toBe('locked')
    expect(buildTask(state, 't1', null, cfg, rng, 3).ok).toBe(true)
    expect(state.coins).toBe(0)
    expect(state.xp).toBe(15)
    expect(buildTask(state, 't1', null, cfg, rng, 4).reason).toBe('locked')
    expect(state.tasksDone).toEqual(['t1'])
  })

  it('价格倍率立刻改要价', () => {
    const { state, cfg, rng } = boot()
    cfg.economy.buildPriceScale = 2
    state.coins = 15
    expect(taskPrice(allTasks(cfg)[0], cfg)).toBe(16)
    expect(buildTask(state, 't1', null, cfg, rng, 1).reason).toBe('coins')
    state.coins = 16
    expect(buildTask(state, 't1', null, cfg, rng, 2).ok).toBe(true)
    expect(state.coins).toBe(0)
  })

  it('从开局交单到做完第一件，然后进入自由经营', () => {
    const { state, cfg, rng } = boot()
    state.phase = 'opening'
    state.locks = []
    const food = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (food?.kind === 'producer') food.level = 4
    state.board[0][0] = makeProduct(state, 'food', 3)
    const sold = completeOrder(state, 'tutorial', cfg, rng, 10)
    expect(sold.ok).toBe(true)
    expect(state.coins).toBe(8)
    expect(state.energy).toBe(100)
    const built = buildTask(state, 't1', null, cfg, rng, 11)
    expect(built.ok).toBe(true)
    expect(built.events[0]).toMatchObject({ type: 'build', taskId: 't1' })
    expect(state.phase).toBe('play')
    expect(state.openingStep).toBe(cfg.copy.tutorial.length)
    expect(state.coins).toBe(0)
    expect(state.xp).toBe(21)
    expect(state.level).toBe(1)
    expect(state.orders).toHaveLength(3)
    expect(state.tasksDone).toEqual(['t1'])
  })

  it('按件数升级：二级宝箱、四级茶炉、五件竹编篓，装饰必须三选一', () => {
    const { state, cfg } = boot()
    finish(state, cfg, 2)
    expect(state.level).toBe(2)
    expect(state.xp).toBe(30)
    const owned = [...state.board.flat(), ...state.rewards, ...state.pending]
    expect(owned.some((item) => item?.kind === 'producer' && item.producerId === 'food' && item.level === 4)).toBe(true)
    expect(owned.some((item) => item?.kind === 'chest')).toBe(true)
    expect(findProducer(state, 'bev')).toBeNull()

    finish(state, cfg, 2)
    expect(state.tasksDone).toHaveLength(4)
    expect(state.level).toBe(3)
    expect(
      findProducer(state, 'bev') ||
        state.rewards.some((item) => item.kind === 'producer' && item.producerId === 'bev'),
    ).toBeTruthy()

    const decor = nextTask(state, cfg)
    expect(decor?.id).toBe('t5')
    finish(state, cfg, 1)
    expect(state.level).toBe(3)
    expect(state.xp).toBe(75)
    expect(
      findProducer(state, 'bev') ||
        state.rewards.some((item) => item.kind === 'producer' && item.producerId === 'bev'),
    ).toBeTruthy()

    const choiceTask = nextTask(state, cfg)
    expect(choiceTask?.id).toBe('t6')
    const rng = mulberry32(9)
    expect(state.decorate).toBeNull()
    expect(buildTask(state, 't6', null, cfg, rng, 51).ok).toBe(true)
    expect(state.decorate?.taskId).toBe('t6')
    expect(state.styles.t6).toBeUndefined()
    previewDecor(state, 2)
    expect(confirmDecor(state, cfg).ok).toBe(true)
    expect(state.decoration).toBe('lilac')
    expect(state.styles.t6).toBe('lilac')
    const coins = state.coins
    expect(reopenDecor(state, cfg, 't6')).toBe(true)
    previewDecor(state, 0)
    expect(confirmDecor(state, cfg).ok).toBe(true)
    expect(state.coins).toBe(coins)
    expect(state.styles.t6).toBe('amber')

    state.coins = 100_000
    while (nextTask(state, cfg)) {
      const task = nextTask(state, cfg)
      if (!task) break
      const choice = task.choices?.[0]?.id ?? null
      expect(buildTask(state, task.id, choice, cfg, rng, 80).ok).toBe(true)
      if (state.decorate) confirmDecor(state, cfg)
      while (state.levelModal) claimLevelModal(state, cfg, rng)
    }
    expect(state.tasksDone).toHaveLength(12)
    expect(state.level).toBe(8)
    expect(state.xp).toBe(180)
    expect(
      findProducer(state, 'bev') || state.rewards.some((item) => item.kind === 'producer' && item.producerId === 'bev'),
    ).toBeTruthy()
    expect(nextTask(state, cfg)).toBeNull()
  })

  it('调低门槛会立刻升级发奖，存档能带回体力和门槛', () => {
    const { state, cfg, rng } = boot()
    cfg.economy.levelTaskThresholds = [1, 5, 9, 12]
    state.coins = 8
    buildTask(state, 't1', null, cfg, rng, 1)
    expect(state.level).toBe(2)
    expect(state.levelModal?.rewards.map((reward) => reward.id)).toEqual(['chest', 'food', 'pack'])
    claimLevelModal(state, cfg, rng)
    expect(state.gems).toBe(100)
    const raw = serialize(state, cfg)
    const next = defaultConfig()
    next.economy.energyMax = 50
    const loaded = hydrate(raw, next)
    expect(loaded?.level).toBe(2)
    expect(loaded?.tasksDone).toEqual(['t1'])
    expect(next.economy.levelTaskThresholds).toEqual([1, 5, 9, 12])
    expect(next.economy.energyMax).toBe(100)
    expect(hydrate('{', next)).toBeNull()
  })
})
