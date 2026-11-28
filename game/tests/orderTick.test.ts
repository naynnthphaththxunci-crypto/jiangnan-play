import { describe, expect, it } from 'vitest'
import { orderTickPlace, TICK_CELL, TICK_H, TICK_OX, TICK_OY, TICK_W } from '../src/orderTick'

describe('订单打勾位置', () => {
  it('140 的格子上，勾是 68×56，左上角在 (78, 91)，略伸出格子', () => {
    const cell = { x: 332, y: 1184, w: 140, h: 140 }
    const place = orderTickPlace(cell)
    expect(place.box.x).toBeCloseTo(cell.x + TICK_OX, 5)
    expect(place.box.y).toBeCloseTo(cell.y + TICK_OY, 5)
    expect(place.box.w).toBeCloseTo(TICK_W, 5)
    expect(place.box.h).toBeCloseTo(TICK_H, 5)
    expect(place.box.x + place.box.w - (cell.x + cell.w)).toBeCloseTo(6, 5)
    expect(place.box.y + place.box.h - (cell.y + cell.h)).toBeCloseTo(7, 5)
    expect(TICK_CELL).toBe(140)
  })

  it('格子变小后宽高和偏移按同一比例换算', () => {
    const cell = { x: 10, y: 20, w: 70, h: 70 }
    const place = orderTickPlace(cell, 1, 78, 91)
    expect(place.box.w).toBeCloseTo(34, 5)
    expect(place.box.h).toBeCloseTo(28, 5)
    expect(place.box.x).toBeCloseTo(10 + 39, 5)
    expect(place.box.y).toBeCloseTo(20 + 45.5, 5)
  })
})