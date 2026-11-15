import { describe, expect, it } from 'vitest'
import { SELECT_CONTENT, SELECT_FRAME_SIZE, selectBreathScale, selectFrameRect } from '../src/selectFrame'
import economy from '../src/data/economy.json'

describe('选中框', () => {
  it('内容范围的左右贴住格子，整图保持正方形', () => {
    const cell = { x: 40, y: 80, w: 50, h: 50 }
    const frame = selectFrameRect(cell)
    const scale = frame.w / SELECT_FRAME_SIZE
    expect(frame.w).toBeCloseTo(frame.h, 5)
    expect(frame.x + SELECT_CONTENT.x * scale).toBeCloseTo(cell.x, 5)
    expect(SELECT_CONTENT.w * scale).toBeCloseTo(cell.w, 5)
    const contentTop = frame.y + SELECT_CONTENT.y * scale
    expect(contentTop + SELECT_CONTENT.h * scale / 2).toBeCloseTo(cell.y + cell.h / 2, 5)
  })

  it('呼吸默认大约 6% 和 1000 毫秒，幅度为 0 时不动', () => {
    expect(economy.selectBreath).toBeCloseTo(0.06, 5)
    expect(economy.selectBreathMs).toBe(1000)
    expect(selectBreathScale(0, 0, 1000)).toBe(1)
    expect(selectBreathScale(250, 0.06, 1000)).toBeCloseTo(1.06, 5)
    expect(selectBreathScale(750, 0.06, 1000)).toBeCloseTo(0.94, 5)
  })
})
