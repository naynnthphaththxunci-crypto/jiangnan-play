import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import { createGame } from '../src/logic/sim'
import { BOARD_X, BOARD_Y, MERGE_BOARD } from '../src/hechengLayout'
import { chainMaker, hitChainPopup, layoutChainPopup, producerOutputs } from '../src/chainPopup'

const frame = {
  w: 1080,
  board: { x: BOARD_X, y: BOARD_Y, cell: MERGE_BOARD.h / 9 },
  dock: { y: 0 },
}

describe('合成链弹窗', () => {
  const cfg = defaultConfig()

  it('4 级灶台现在只出 1 级，更高等级才多出 2、3、4 级和肉', () => {
    const groups = producerOutputs(cfg, 'food', 4)
    expect(groups.now.map((piece) => [piece.line, piece.level])).toEqual([['food', 1]])
    expect(groups.later.map((piece) => [piece.line, piece.level])).toEqual([
      ['food', 2],
      ['food', 3],
      ['food', 4],
      ['meat', 1],
    ])
  })

  it('超过 8 级用长框，8 级以内用短框，点母棋格能跳', () => {
    const state = createGame(1, cfg)
    const food = layoutChainPopup(frame, cfg, state, { line: 'food', level: 6, source: 'order' })
    const meat = layoutChainPopup(frame, cfg, state, { line: 'meat', level: 2, source: 'order' })
    expect(food.cells).toHaveLength(15)
    expect(meat.cells).toHaveLength(7)
    expect(food.card.h).toBeGreaterThan(meat.card.h)
    expect(food.source?.producerId).toBe('food')
    expect(meat.source?.producerId).toBe('food')
    expect(hitChainPopup(food, food.close.x + 4, food.close.y + 4)).toBe('close')
    expect(hitChainPopup(food, food.source!.rect.x + 8, food.source!.rect.y + 8)).toBe('source')
    expect(hitChainPopup(food, food.card.x + 20, food.card.y + 80)).toBe('swallow')
    expect(hitChainPopup(food, 4, 4)).toBe('outside')
  })

  it('母棋弹窗的产出格不提供跳转', () => {
    const state = createGame(1, cfg)
    const popup = layoutChainPopup(frame, cfg, state, { line: 'food', level: 4, source: 'producer', producerId: 'food' })
    expect(popup.source).toBeNull()
    expect(popup.now).toHaveLength(1)
    expect(popup.later.length).toBeGreaterThan(0)
    expect(chainMaker(cfg, 'meat')?.from).toBe(5)
    const spot = popup.now[0]!
    expect(hitChainPopup(popup, spot.rect.x + 8, spot.rect.y + 8)).toBe('swallow')
  })
})
