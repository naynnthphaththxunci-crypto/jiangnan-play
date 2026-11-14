import { describe, expect, it } from 'vitest'
import { layout, type LayoutInput } from '../src/layout'
import { cellRect } from '../src/layout'
import { canvasFit } from '../src/viewport'

function board(w: number, h: number) {
  const input: LayoutInput = {
    w,
    h,
    insetTop: 0,
    insetBottom: 0,
    mode: 'board',
    orderCount: 1,
    orderSlots: [1],
    orderScroll: 0,
    showHint: false,
    showSheet: false,
    showSkip: false,
    showDaily: false,
    showHouseBtn: true,
    showStorage: false,
    showSmile: true,
    choiceCount: 0,
    tuner: false,
    tunerScroll: 0,
    modal: false,
    help: false,
    showEnter: false,
    showInfo: true,
    showStory: false,
    showTask: false,
    showChest: false,
  }
  return layout(input)
}

describe('屏幕适配', () => {
  it('窄屏铺满宽度，宽屏按设计稿等比并居中', () => {
    expect(canvasFit(440, 790)).toMatchObject({ x: 0, y: 0, w: 440, h: 790, wide: false })
    expect(canvasFit(390, 664)).toMatchObject({ x: 0, y: 0, w: 390, h: 664, wide: false })
    expect(canvasFit(390, 844)).toMatchObject({ x: 0, y: 0, w: 390, h: 844, wide: false })
    const ipad = canvasFit(768, 1024)
    expect(ipad.wide).toBe(true)
    expect(ipad.w / ipad.h).toBeCloseTo(1080 / 2340, 3)
    expect(ipad.x).toBeGreaterThan(0)
    expect(ipad.y).toBeCloseTo(0, 3)
    expect(ipad.w).toBeLessThan(768)
  })

  it('矮屏格子是正方形，底栏和头像都留在屏幕里', () => {
    for (const [w, h] of [
      [440, 790],
      [390, 664],
      [390, 844],
      [472, 1024],
    ] as const) {
      const view = board(w, h)
      const cell = cellRect(view, 3, 4)
      expect(cell.w).toBeCloseTo(cell.h, 3)
      expect(view.avatarSlot.y).toBeGreaterThanOrEqual(-0.5)
      expect(view.houseBtn.y + view.houseBtn.h).toBeLessThanOrEqual(h + 0.5)
      expect(view.pendingBtn.y + view.pendingBtn.h).toBeLessThanOrEqual(h + 0.5)
      expect(view.board.y).toBeLessThan(view.houseBtn.y)
    }
  })
})
