import { describe, expect, it } from 'vitest'
import { curtainBambooPlace, curtainDrop, curtainPlace, CURTAIN_BOUNCE_MAX, CURTAIN_H, CURTAIN_W } from '../src/curtain'
import { canvasFit } from '../src/viewport'
import economy from '../src/data/economy.json'

describe('竹帘切换', () => {
  it('默认 500 毫秒 ease-out，不回弹', () => {
    expect(economy.curtainPullMs).toBe(500)
    expect(economy.curtainHoldMs).toBe(0)
    expect(economy.curtainBounce).toBe(0)
    const travel = 844
    expect(curtainDrop(0, travel, 0)).toBeCloseTo(-travel, 4)
    expect(curtainDrop(1, travel, 0)).toBeCloseTo(0, 4)
    expect(curtainDrop(0.5, travel, 0)).toBeGreaterThan(-travel * 0.5)
    for (let i = 0; i <= 20; i++) expect(curtainDrop(i / 20, travel, 0)).toBeLessThanOrEqual(0.01)
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

  it('竹帘顶部余量大于最大回弹，前景不跟着放大', () => {
    const views = [
      [390, 844],
      [canvasFit(390, 664).w, canvasFit(390, 664).h],
      [canvasFit(768, 1024).w, canvasFit(768, 1024).h],
    ] as const
    for (const [w, h] of views) {
      const front = curtainPlace(w, h)
      const bamboo = curtainBambooPlace(w, h)
      const maxBounce = h * CURTAIN_BOUNCE_MAX
      const drop = curtainDrop(0.78, Math.max(0, bamboo.y + bamboo.h), maxBounce)
      expect(bamboo.w / bamboo.h).toBeCloseTo(CURTAIN_W / CURTAIN_H, 4)
      expect(front.w / front.h).toBeCloseTo(CURTAIN_W / CURTAIN_H, 4)
      expect(bamboo.h).toBeGreaterThan(front.h)
      expect(bamboo.y + drop).toBeLessThan(0)
      expect(bamboo.y + bamboo.h + drop).toBeGreaterThanOrEqual(h - 0.5)
      expect(front.y).toBeGreaterThanOrEqual(bamboo.y)
    }
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
