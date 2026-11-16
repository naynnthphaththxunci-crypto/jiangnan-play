import { describe, expect, it } from 'vitest'
import { homeFit, homePlaces } from '../src/homeLayout'

describe('主场景适配', () => {
  it('高手机按宽铺满，矮手机从顶部裁，宽屏左右留黑', () => {
    const phone = homeFit(390, 844)
    expect(phone.x).toBe(0)
    expect(phone.scale).toBeCloseTo(390 / 1080, 4)
    expect(phone.y).toBeLessThanOrEqual(0)

    const short = homeFit(390, 700)
    expect(short.x).toBe(0)
    expect(short.y).toBeLessThan(0)
    expect(700 - short.y).toBeCloseTo(2340 * short.scale, 3)

    const pad = homeFit(768, 1024)
    expect(pad.y).toBe(0)
    expect(pad.x).toBeGreaterThan(0)
    expect(pad.scale).toBeCloseTo(1024 / 2340, 4)
  })

  it('底部建筑按钮跟着场景底，顶部设置贴着可见区', () => {
    const places = homePlaces(390, 700)
    expect(places.fit.y + 2340 * places.fit.scale).toBeCloseTo(700, 2)
    expect(places.build.y).toBeCloseTo(places.fit.y + 2112 * places.fit.scale, 2)
    expect(places.settings.y).toBeCloseTo(248 * places.fit.scale, 2)
    expect(places.dialog.y).toBeCloseTo(places.fit.y + 819 * places.fit.scale, 2)
  })
})
