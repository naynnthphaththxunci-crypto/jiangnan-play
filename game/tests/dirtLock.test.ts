import { describe, expect, it } from 'vitest'
import { bubbleReward, soilKind } from '../src/boardCover'
import { defaultConfig } from '../src/config'
import { createGame, dropItem, lockAt, makeProduct } from '../src/logic/sim'

function clearCell(state: ReturnType<typeof createGame>, row: number, col: number) {
  state.locks = state.locks.filter((lock) => lock.row !== row || lock.col !== col)
  state.board[row][col] = null
}

describe('泥土锁格和气泡', () => {
  it('开局 b4 b5 可合，c5 半遮掩，气泡格都还锁着而且下面有棋子', () => {
    const state = createGame(1, defaultConfig())
    expect(state.board[3][1]?.kind).toBe('producer')
    expect(state.board[4][1]?.kind).toBe('producer')
    expect(lockAt(state, 4, 2)?.veil).toBe('half')
    const bubbles = [
      [0, 0],
      [0, 3],
      [0, 6],
      [3, 6],
      [6, 6],
      [7, 0],
      [7, 4],
      [8, 0],
      [8, 3],
      [8, 6],
    ]
    for (const [row, col] of bubbles) {
      const lock = lockAt(state, row!, col!)
      expect(lock?.veil).toBe('full')
      expect(lock?.buried.kind === 'product' || lock?.buried.kind === 'producer').toBe(true)
    }
    expect(soilKind(0, 0)).toBe('plain')
    expect(soilKind(0, 3)).toBe('stone')
    expect(soilKind(8, 3)).toBe('log')
    expect(bubbleReward(0, 6)).toEqual({ art: 'chestCatBlue', energy: 100 })
    expect(bubbleReward(6, 6)).toEqual({ art: 'gems', gems: 50 })
    expect(bubbleReward(4, 2)).toBeNull()
  })

  it('旁边合成后气泡发 100 体力或 50 钻石，格子变成半遮掩', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.lesson = 'free'
    clearCell(state, 1, 0)
    clearCell(state, 1, 1)
    state.board[1][0] = makeProduct(state, 'food', 1)
    state.board[1][1] = makeProduct(state, 'food', 1)
    const energy = state.energy
    expect(dropItem(state, { row: 1, col: 1 }, { row: 1, col: 0 }, cfg).ok).toBe(true)
    expect(state.energy).toBe(energy + 100)
    expect(lockAt(state, 0, 0)?.veil).toBe('half')
    expect(lockAt(state, 0, 0)?.buried).toMatchObject({ kind: 'producer', id: 'plant', level: 1 })
    expect(state.rewards.some((item) => item.kind === 'chest')).toBe(false)

    clearCell(state, 6, 5)
    clearCell(state, 5, 6)
    state.board[6][5] = makeProduct(state, 'food', 1)
    state.board[5][6] = makeProduct(state, 'food', 1)
    const gems = state.gems
    expect(dropItem(state, { row: 5, col: 6 }, { row: 6, col: 5 }, cfg).ok).toBe(true)
    expect(state.gems).toBe(gems + 50)
    expect(lockAt(state, 6, 6)?.veil).toBe('half')
  })
})
