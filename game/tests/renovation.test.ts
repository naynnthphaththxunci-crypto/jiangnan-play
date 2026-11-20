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
  serialize,
  syncEarlyOrders,
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
      'dog',
      'catch',
    ])
    expect(cfg.items.lines.find((line) => line.id === 'food')?.levels).toHaveLength(15)
    expect(cfg.items.lines.find((line) => line.id === 'bed')?.levels).toHaveLength(12)
    expect(cfg.items.lines.find((line) => line.id === 'plant')?.levels).toHaveLength(7)
    expect(allTasks(cfg)).toHaveLength(171)
    expect(cfg.buildings.steps[0]?.tasks[0]?.id).toBe('s1')
    expect(hostessCostume(cfg)).toBe('布衣')
    expect(cfg.economy.levelTaskThresholds.slice(0, 5)).toEqual([30, 45, 60, 75, 75])
    expect(cfg.economy.xpPerTask).toBe(15)
    expect(levelForTaskCount(2, cfg)).toBe(2)
    expect(levelForTaskCount(5, cfg)).toBe(3)
  })

  it('铜钱不够、跳着做、重复做都不算', () => {
    const { state, cfg, rng } = boot()
    const denied = buildTask(state, 's1', null, cfg, rng, 1)
    expect(denied.reason).toBe('coins')
    expect(state.tasksDone).toEqual([])
    expect(state.xp).toBe(0)
    state.coins = 26
    expect(buildTask(state, 's2', null, cfg, rng, 2).reason).toBe('locked')
    expect(buildTask(state, 's1', null, cfg, rng, 3).ok).toBe(true)
    expect(state.coins).toBe(0)
    expect(state.xp).toBe(15)
    expect(buildTask(state, 's1', null, cfg, rng, 4).reason).toBe('locked')
    expect(state.tasksDone).toEqual(['s1'])
  })

  it('价格倍率立刻改要价', () => {
    const { state, cfg, rng } = boot()
    cfg.economy.buildPriceScale = 2
    state.coins = 51
    expect(taskPrice(allTasks(cfg)[0], cfg)).toBe(52)
    expect(buildTask(state, 's1', null, cfg, rng, 1).reason).toBe('coins')
    state.coins = 52
    expect(buildTask(state, 's1', null, cfg, rng, 2).ok).toBe(true)
    expect(state.coins).toBe(0)
  })

  it('从开局交单到做完第一件，然后进入自由经营', () => {
    const { state, cfg, rng } = boot()
    state.phase = 'opening'
    state.locks = []
    const food = state.board.flat().find((item) => item?.kind === 'producer' && item.producerId === 'food')
    if (food?.kind === 'producer') food.level = 4
    state.lesson = 'free'
    state.board[0][0] = makeProduct(state, 'food', 3)
    syncEarlyOrders(state, cfg)
    const sold = completeOrder(state, state.orders[0]?.id ?? '', cfg, rng, 10)
    expect(sold.ok).toBe(true)
    expect(state.coins).toBe(2)
    expect(state.energy).toBe(100)
    state.coins = 26
    const built = buildTask(state, 's1', null, cfg, rng, 11)
    expect(built.ok).toBe(true)
    expect(built.events[0]).toMatchObject({ type: 'build', taskId: 's1' })
    expect(state.xp).toBe(15)
    expect(state.tasksDone).toEqual(['s1'])
  })

  it('按件数升级：二级宝箱、四级茶炉、五件竹编篓，装饰必须三选一', () => {
    const { state, cfg } = boot()
    finish(state, cfg, 2)
    expect(state.level).toBe(2)
    expect(state.xp).toBe(0)
    const owned = [...state.board.flat(), ...state.rewards, ...state.pending]
    expect(owned.some((item) => item?.kind === 'producer' && item.producerId === 'food' && item.level === 4)).toBe(true)
    expect(owned.some((item) => item?.kind === 'chest')).toBe(true)
    expect(findProducer(state, 'bev')).toBeNull()

    finish(state, cfg, 3)
    expect(state.tasksDone).toHaveLength(5)
    expect(state.level).toBe(3)
    expect(
      findProducer(state, 'bev') ||
        state.rewards.some((item) => item.kind === 'producer' && item.producerId === 'bev'),
    ).toBeTruthy()

    expect(state.xp).toBe(0)
    expect(state.level).toBe(3)
    expect(nextTask(state, cfg)?.id).toBe('s6')
  })

  it('调低门槛会立刻升级发奖，存档能带回体力和门槛', () => {
    const { state, cfg, rng } = boot()
    cfg.economy.levelTaskThresholds = [10, 100, 100, 100]
    state.coins = 26
    buildTask(state, 's1', null, cfg, rng, 1)
    expect(state.level).toBe(2)
    expect(state.levelModal?.rewards.map((reward) => reward.id)).toContain('food')
    claimLevelModal(state, cfg, rng)
    expect(state.gems).toBe(50)
    const raw = serialize(state, cfg)
    const next = defaultConfig()
    next.economy.energyMax = 50
    const loaded = hydrate(raw, next)
    expect(loaded?.level).toBe(2)
    expect(loaded?.tasksDone).toEqual(['s1'])
    expect(next.economy.levelTaskThresholds).toEqual([10, 100, 100, 100])
    expect(next.economy.energyMax).toBe(100)
    expect(hydrate('{', next)).toBeNull()
  })
})
