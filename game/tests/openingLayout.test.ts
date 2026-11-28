import { describe, expect, it } from 'vitest'
import { BTN_RESTART, TAP_TEXT, doorHotspot, filmFit, hitBox, openingHandPose, tapPromptHand, toFilm } from '../src/openingLayout'

describe('开场视频铺满', () => {
  it('宽屏按宽铺满，矮屏从顶部裁', () => {
    const tall = filmFit(390, 844)
    expect(tall.x).toBe(0)
    expect(tall.y).toBe(0)
    expect(tall.w).toBe(390)
    expect(tall.h).toBeCloseTo(390 * (1920 / 1080), 4)
    expect(tall.h).toBeLessThan(844)

    const short = filmFit(440, 700)
    expect(short.w).toBe(440)
    expect(short.h).toBeGreaterThan(700)
    expect(short.y).toBeCloseTo(700 - short.h, 4)
    expect(short.w / short.h).toBeCloseTo(1080 / 1920, 4)
  })

  it('进门热区包住文字和手，重新开始只认按钮', () => {
    const hot = doorHotspot(160)
    expect(hitBox(hot, 352, 978)).toBe(true)
    expect(hitBox(hot, 340, 1031)).toBe(true)
    expect(hitBox(hot, 10, 10)).toBe(false)
    const fit = filmFit(390, 844)
    const door = toFilm(fit, 200, 400)
    expect(hitBox(hot, door.x, door.y)).toBe(true)
    expect(hitBox(BTN_RESTART, 327, 1416)).toBe(true)
    expect(hitBox(BTN_RESTART, 100, 1416)).toBe(false)
  })

  it('继续手按重新开始那组的中心偏移摆到文字上', () => {
    const hand = tapPromptHand()
    const buttonCenter = BTN_RESTART.x + BTN_RESTART.w / 2
    const textCenter = TAP_TEXT.x + TAP_TEXT.w / 2
    expect(hand.x - textCenter).toBeCloseTo(340 - buttonCenter, 4)
    expect(hand.y - (TAP_TEXT.y + TAP_TEXT.h / 2)).toBeCloseTo(1501 - (1416 + 169 / 2), 4)
    expect(hand.w).toBe(157)
    const nudged = tapPromptHand(6, -4)
    expect(nudged.x).toBeCloseTo(hand.x + 6, 4)
    expect(nudged.y).toBeCloseTo(hand.y - 4, 4)
  })

  it('手势按下时缩小，之后弹回', () => {
    const down = openingHandPose(100, 0)
    const back = openingHandPose(450, 0)
    expect(down.scale).toBeLessThan(1)
    expect(down.dy).toBeGreaterThan(0)
    expect(back.scale).toBeGreaterThan(down.scale)
  })
})
