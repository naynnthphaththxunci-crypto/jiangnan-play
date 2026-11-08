import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import { orderItemLabel } from '../src/format'
import {
  claimLevelModal,
  claimShopDaily,
  claimShopPack,
  collectBoardProduct,
  createGame,
  dropItem,
  enabledMults,
  lockAt,
  makeProduct,
  reconcileLevel,
  spawnTier,
  tapProducer,
} from '../src/logic/sim'

describe('第十轮开局和前期', () => {
  it('三步教学合成到 4 级，合完 C5 后 D4、D6、E5 半遮', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'opening'
    expect(dropItem(state, { row: 3, col: 1 }, { row: 4, col: 1 }, cfg).ok).toBe(true)
    expect(dropItem(state, { row: 4, col: 1 }, { row: 4, col: 2 }, cfg).ok).toBe(true)
    expect(lockAt(state, 3, 3)?.veil).toBe('half')
    expect(lockAt(state, 5, 3)?.veil).toBe('half')
    expect(lockAt(state, 4, 4)?.veil).toBe('half')
    expect(dropItem(state, { row: 4, col: 2 }, { row: 4, col: 3 }, cfg).ok).toBe(true)
    const made = state.board[4][3]
    expect(made?.kind === 'producer' && made.level).toBe(4)
    expect(state.phase).toBe('play')
  })

  it('订单写完整名字，8 倍默认关掉，1 到 4 级奖励和笑脸按新流程', () => {
    const cfg = defaultConfig()
    expect(orderItemLabel('混合粗粮团', 3, true)).toBe('混合粗粮团 3级')
    expect(enabledMults(cfg)).toEqual([1, 2, 4])
    expect(spawnTier(cfg, 8)?.enabled).toBe(false)
    expect(spawnTier(cfg, 4)?.weights.map((row) => row.p)).toEqual([0.35, 0.2, 0.2, 0.2, 0.05])
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.locks = []
    state.xp = cfg.economy.levelTaskThresholds[0] * cfg.economy.xpPerTask
    reconcileLevel(state, cfg, () => 0)
    expect(state.levelModal?.rewards.map((reward) => reward.id)).toEqual(['chest', 'food', 'pack'])
    claimLevelModal(state, cfg, () => 0)
    expect(state.gems).toBe(100)
    state.xp = cfg.economy.levelTaskThresholds[1] * cfg.economy.xpPerTask
    reconcileLevel(state, cfg, () => 0)
    claimLevelModal(state, cfg, () => 0)
    expect(state.shopOpen).toBe(true)
    expect(state.rewards.some((item) => item.kind === 'producer' && item.producerId === 'bev' && item.level === 1)).toBe(true)
    expect(claimShopDaily(state, cfg, 1).ok).toBe(true)
    expect(claimShopPack(state, cfg).ok).toBe(true)
    state.xp = cfg.economy.levelTaskThresholds[2] * cfg.economy.xpPerTask
    reconcileLevel(state, cfg, () => 0)
    expect(state.level).toBe(4)
    expect(cfg.economy.smileGoal).toBe(6)
    state.board[0][0] = makeProduct(state, 'coin', 5)
    expect(collectBoardProduct(state, { row: 0, col: 0 }, cfg).ok).toBe(true)
    expect(state.coins).toBe(50)
  })

  it('5 级饮料母棋打开猫薄荷强制教学', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.locks = []
    state.board[0][0] = { uid: 'a', kind: 'producer', producerId: 'bev', line: 'bev', level: 4, charges: 10, cooldownUntil: 0 }
    state.board[0][1] = { uid: 'b', kind: 'producer', producerId: 'bev', line: 'bev', level: 4, charges: 10, cooldownUntil: 0 }
    expect(dropItem(state, { row: 0, col: 0 }, { row: 0, col: 1 }, cfg).ok).toBe(true)
    expect(state.mintStep).toBe('talk')
    expect(state.orders.some((order) => order.slots.some((slot) => slot.line === 'mint'))).toBe(true)
    expect(state.detailLine).toBe('bev')
    state.mintStep = 'produce'
    state.board[2][2] = state.board[0][1]
    expect(tapProducer(state, { row: 2, col: 2 }, cfg, () => 0.99, 10).ok).toBe(true)
    expect(state.board.flat().some((item) => item?.kind === 'product' && item.line === 'mint' && item.level === 1)).toBe(true)
  })
})
