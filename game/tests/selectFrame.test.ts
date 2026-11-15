import { describe, expect, it } from 'vitest'
import { SELECT_CONTENT, SELECT_FRAME_SIZE, selectBreathScale, selectFrameRect } from '../src/selectFrame'
import economy from '../src/data/economy.json'

describe('选中框', () => {
  it('选中框默认大约比格子大 16%，居中且不变形', () => {
    const cell = { x: 40, y: 80, w: 50, h: 50 }
    const frame = selectFrameRect(cell)
    const scale = frame.w / SELECT_FRAME_SIZE
    expect(economy.selectFrameScale).toBeCloseTo(1.16, 5)
    expect(frame.w).toBeCloseTo(frame.h, 5)
    expect(SELECT_CONTENT.w * scale).toBeCloseTo(cell.w * 1.16, 4)
    const contentX = frame.x + SELECT_CONTENT.x * scale
    const contentY = frame.y + SELECT_CONTENT.y * scale
    expect(contentX + (SELECT_CONTENT.w * scale) / 2).toBeCloseTo(cell.x + cell.w / 2, 4)
    expect(contentY + (SELECT_CONTENT.h * scale) / 2).toBeCloseTo(cell.y + cell.h / 2, 4)
  })

  it('点中后呼吸两次就停在原大', () => {
    expect(economy.selectBreath).toBeCloseTo(0.06, 5)
    expect(economy.selectBreathMs).toBe(1000)
    expect(economy.selectBreathTimes).toBe(2)
    expect(selectBreathScale(0, 0.06, 1000, 2)).toBeCloseTo(1, 5)
    expect(selectBreathScale(250, 0.06, 1000, 2)).toBeCloseTo(1.06, 5)
    expect(selectBreathScale(1250, 0.06, 1000, 2)).toBeCloseTo(1.06, 5)
    expect(selectBreathScale(2000, 0.06, 1000, 2)).toBeCloseTo(1, 5)
    expect(selectBreathScale(2250, 0.06, 1000, 2)).toBeCloseTo(1, 5)
    expect(selectBreathScale(250, 0, 1000, 2)).toBe(1)
    expect(selectBreathScale(250, 0.06, 1000, 0)).toBe(1)
  })
})
