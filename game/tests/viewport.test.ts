import { describe, expect, it } from 'vitest'
import { cellRect, layout, type LayoutInput } from '../src/layout'
import { canvasFit, KEEP_TOP, PAGE_W } from '../src/viewport'

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
  it('够高按宽度铺满，太矮或宽屏左右留黑边', () => {
    expect(canvasFit(390, 844)).toMatchObject({ x: 0, y: 0, w: 390, h: 844, wide: false })
    const short = canvasFit(390, 664)
    expect(short.wide).toBe(true)
    expect(short.h).toBe(664)
    expect(short.w).toBeLessThan(390)
    expect(short.x).toBeGreaterThan(0)
    expect(short.w / PAGE_W).toBeCloseTo(664 / (2340 - KEEP_TOP), 3)
    const pro = canvasFit(440, 790)
    expect(pro.wide).toBe(true)
    expect(pro.w).toBeLessThan(440)
    const ipad = canvasFit(768, 1024)
    expect(ipad.wide).toBe(true)
    expect(ipad.x).toBeGreaterThan(0)
    expect(ipad.w).toBeLessThan(768)
  })

  it('必显区域里客人不压棋盘，格子是正方形，底栏留在屏内', () => {
    const views = [
      canvasFit(440, 790),
      canvasFit(390, 664),
      canvasFit(390, 844),
      canvasFit(768, 1024),
    ]
    for (const box of views) {
      const view = board(box.w, box.h)
      const cell = cellRect(view, 3, 4)
      const guest = view.orderGuests[0]!
      expect(cell.w).toBeCloseTo(cell.h, 3)
      expect(guest.y).toBeGreaterThanOrEqual(-1)
      expect(guest.y + guest.h).toBeLessThanOrEqual(view.board.y + 1)
      expect(view.avatarSlot.y).toBeGreaterThanOrEqual(-1)
      expect(view.houseBtn.y + view.houseBtn.h).toBeLessThanOrEqual(box.h + 1)
      expect(view.pendingBtn.y + view.pendingBtn.h).toBeLessThanOrEqual(box.h + 1)
    }
  })
})
