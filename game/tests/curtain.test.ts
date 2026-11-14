import { describe, expect, it } from 'vitest'
import { curtainDrop, curtainPlace, CURTAIN_H, CURTAIN_W } from '../src/curtain'
import economy from '../src/data/economy.json'

describe('竹帘切换', () => {
  it('默认下拉加停留不到半秒', () => {
    expect(economy.curtainPullMs).toBe(300)
    expect(economy.curtainHoldMs).toBe(0)
    expect(economy.curtainPullMs + economy.curtainHoldMs).toBeLessThan(500)
    expect(economy.curtainBounce).toBeGreaterThan(0)
  })

  it('按宽度铺满时从顶部裁，铺不满就按高度盖满且不拉伸', () => {
    const tall = curtainPlace(390, 844)
    expect(tall.y).toBe(0)
    expect(tall.h).toBeCloseTo(844, 4)
    expect(tall.w).toBeGreaterThan(390)
    expect(tall.w / tall.h).toBeCloseTo(CURTAIN_W / CURTAIN_H, 4)
    expect(tall.x + tall.w).toBeGreaterThanOrEqual(390)
    expect(tall.y + tall.h).toBeGreaterThanOrEqual(844)

    const ipad = curtainPlace(503, 1024)
    expect(ipad.h).toBeCloseTo(1024, 4)
    expect(ipad.w / ipad.h).toBeCloseTo(CURTAIN_W / CURTAIN_H, 4)
    expect(ipad.x).toBeLessThan(0)

    const short = curtainPlace(800, 600)
    expect(short.w).toBeCloseTo(800, 4)
    expect(short.y).toBeLessThan(0)
    expect(short.y + short.h).toBeCloseTo(600, 4)
    expect(short.w / short.h).toBeCloseTo(CURTAIN_W / CURTAIN_H, 4)
  })

  it('下拉到底会轻轻超出再回到盖满', () => {
    const travel = 844
    expect(curtainDrop(0, travel, 16)).toBeCloseTo(-travel, 4)
    expect(curtainDrop(1, travel, 16)).toBeCloseTo(0, 4)
    expect(curtainDrop(0.78, travel, 16)).toBeGreaterThan(0)
    let below = true
    for (let i = 0; i <= 10; i++) {
      if (curtainDrop(i / 10, travel, 0) > 0.01) below = false
    }
    expect(below).toBe(true)
  })
})
