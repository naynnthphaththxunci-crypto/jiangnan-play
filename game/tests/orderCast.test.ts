import { describe, expect, it } from 'vitest'
import { orderGuestFrame, orderGuestRect, pickOrderCast } from '../src/orderCast'

describe('订单角色', () => {
  it('先播出场，再循环待机', () => {
    const enter = orderGuestFrame('xiaotao', 0, 0)
    expect(enter).toEqual({ anim: '出场', index: 0 })
    const later = orderGuestFrame('xiaotao', 49 * (1000 / 15) + 40, 0)
    expect(later?.anim).toBe('待机')
    expect(later?.index).toBe(0)
  })

  it('按柜台宽把原画布换到盘子上', () => {
    const plate = { x: 100, y: 400, w: 147, h: 56 }
    const rect = orderGuestRect('xiaotao', plate, '待机')
    expect(rect).toBeTruthy()
    const k = plate.w / 294
    expect(rect!.y).toBeLessThan(plate.y)
    expect(rect!.w).toBeGreaterThan(40 * k)
    expect(rect!.h).toBeGreaterThan(40 * k)
    expect(pickOrderCast(0)).toBe('ghost')
    expect(pickOrderCast(0.99)).toBe('ajiang')
  })
})
