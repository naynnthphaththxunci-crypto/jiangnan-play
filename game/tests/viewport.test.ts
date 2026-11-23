import { describe, expect, it } from 'vitest'
import { cellRect, layout, type LayoutInput } from '../src/layout'
import { COUNTER_BAND, COUNTER_TABLE, MERGE_BOARD } from '../src/hechengLayout'
import { canvasFit, coverCanvas } from '../src/viewport'

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
  it('画布从屏幕顶端盖住可见区，不留顶上的缝', () => {
    const phone = coverCanvas(canvasFit(390, 844), 0, 0, 844)
    expect(phone.top).toBe(0)
    expect(phone.h).toBeGreaterThanOrEqual(844)
    expect(phone.w).toBeGreaterThanOrEqual(390)
    const pushed = coverCanvas({ x: 0, y: 0, w: 390, h: 744, wide: false }, 0, 40, 844)
    expect(pushed.top).toBe(0)
    expect(pushed.h).toBeGreaterThanOrEqual(844)
    const fractional = coverCanvas({ x: 0, y: 0, w: 390, h: 843.2, wide: false }, 0, 0.4, 844)
    expect(fractional.top).toBe(0)
    expect(fractional.h).toBeGreaterThanOrEqual(844)
  })

  it('画布铺满屏幕，不留左右黑边', () => {
    expect(canvasFit(390, 844)).toMatchObject({ x: 0, y: 0, w: 390, h: 844, wide: false })
    expect(canvasFit(1080, 1920)).toMatchObject({ x: 0, y: 0, w: 1080, h: 1920, wide: false })
    expect(canvasFit(390, 664)).toMatchObject({ x: 0, y: 0, w: 390, h: 664, wide: false })
    expect(canvasFit(768, 1024)).toMatchObject({ x: 0, y: 0, w: 768, h: 1024, wide: false })
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
      expect(view.board.y + view.board.cell * 9).toBeLessThanOrEqual(view.pendingBtn.y + 1)
    }
  })

  it('柜台底边在棋盘上沿之上，矮屏内容居中且格子仍是正方形', () => {
    expect(COUNTER_TABLE.y + COUNTER_TABLE.h).toBeLessThanOrEqual(MERGE_BOARD.y)
    expect(COUNTER_BAND.y + COUNTER_BAND.h).toBeLessThanOrEqual(MERGE_BOARD.y)
    expect(MERGE_BOARD.w / 7).toBeCloseTo(MERGE_BOARD.h / 9, 5)
    const short = board(1080, 1920)
    const gridW = short.board.cell * 7
    const gridH = short.board.cell * 9
    expect(short.board.cell).toBeGreaterThan(0)
    expect(short.board.x).toBeGreaterThan(8)
    expect(short.board.x + gridW).toBeLessThan(1080 - 8)
    expect(short.board.y).toBeGreaterThan(0)
    expect(short.board.y + gridH).toBeLessThanOrEqual(short.pendingBtn.y + 0.5)
    const many = layout({
      ...{
        w: 1080,
        h: 2340,
        insetTop: 0,
        insetBottom: 0,
        mode: 'board' as const,
        orderCount: 3,
        orderSlots: [1, 2, 1],
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
      },
    })
    expect(many.orderGuests).toHaveLength(3)
    expect(many.tableSlots).toHaveLength(3)
  })
})
