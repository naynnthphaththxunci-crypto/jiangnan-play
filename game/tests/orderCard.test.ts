import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import { cellRect, hitTest, layout, type LayoutInput, type Rect } from '../src/layout'
import { designCell } from '../src/hechengLayout'
import { scrollOrders } from '../src/logic/sim'
import type { NormBox } from '../src/types'
import { PORTRAITS, portraitConfig } from '../src/portraits'

function frame(over: Partial<LayoutInput> = {}) {
  return layout({
    w: 390,
    h: 844,
    insetTop: 0,
    insetBottom: 0,
    mode: 'board',
    orderCount: 3,
    orderSlots: [2, 1, 2],
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
    ...over,
  })
}

function faceOf(slot: Rect, content: NormBox, face: NormBox): Rect {
  const body = {
    x: slot.x + content.x * slot.w,
    y: slot.y + content.y * slot.h,
    w: content.w * slot.w,
    h: content.h * slot.h,
  }
  return {
    x: body.x + face.x * body.w,
    y: body.y + face.y * body.h,
    w: face.w * body.w,
    h: face.h * body.h,
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5
}

describe('订单卡', () => {
  it('没有左侧按钮时订单从最左边排', () => {
    const bare = { showStory: false, showTask: false, showChest: false }
    const view = frame({ ...bare, orderCount: 1, orderSlots: [1] })
    expect(view.orderPlates[0]!.x).toBeLessThan(view.w * 0.12)
    expect(view.storyBtn.w).toBe(0)
    expect(view.taskBtn.w).toBe(0)
    expect(view.chestBtn.w).toBe(0)
    expect(view.tableSlots).toHaveLength(1)
    const chest = frame({ showStory: false, showTask: false, showChest: true, orderCount: 1, orderSlots: [1] })
    expect(chest.chestBtn.w).toBeGreaterThan(0)
    expect(chest.orderPlates[0]!.x).toBeGreaterThan(chest.chestBtn.x + chest.chestBtn.w)
  })

  it('滑动时桌子不动，客人吸附到桌位，最右的奖励能拉进屏幕', () => {
    const view = frame({ orderCount: 4, orderSlots: [1, 1, 1, 1] })
    expect(view.orderMaxScroll).toBeGreaterThan(view.orderPitch * 0.5)
    const mid = frame({ orderCount: 4, orderSlots: [1, 1, 1, 1], orderScroll: view.orderPitch * 0.5 })
    expect(mid.tableSlots).toHaveLength(4)
    expect(view.orderGuests[0]!.x - mid.orderGuests[0]!.x).toBeCloseTo(view.tableSlots[0]!.x - mid.tableSlots[0]!.x, 1)
    expect(mid.orderGuests[0]!.x).toBeLessThan(view.orderGuests[0]!.x - 10)
    const scrolled = frame({ orderCount: 4, orderSlots: [1, 1, 1, 1], orderScroll: view.orderMaxScroll })
    const pay = scrolled.orderRewards[3]!
    const guest = scrolled.orderGuests[3]!
    expect(pay.x).toBeGreaterThanOrEqual(-1)
    expect(pay.x + pay.w).toBeLessThanOrEqual(view.w + 1)
    expect(guest.x + guest.w).toBeLessThanOrEqual(view.w + 1)
    const edge = Math.max(pay.x + pay.w, guest.x + guest.w, scrolled.tableSlots[3]!.x + scrolled.tableSlots[3]!.w)
    expect(edge).toBeCloseTo(view.w, 0)
    expect(scrollOrders(0, -40, view.orderMaxScroll)).toBeGreaterThan(0)
    const pulled = scrollOrders(0, -9999, view.orderMaxScroll, 120)
    expect(pulled).toBeGreaterThan(view.orderMaxScroll)
    expect(pulled).toBeLessThan(view.orderMaxScroll + 120)
  })

  it('托盘上等距，物品落在自己的托盘上且互不重叠', () => {
    const view = frame({ orderSlots: [2, 2, 1] })
    const pitch = view.orderPlates[1]!.x - view.orderPlates[0]!.x
    expect(Math.abs(view.orderPlates[2]!.x - view.orderPlates[1]!.x - pitch)).toBeLessThan(1)
    expect(pitch).toBeGreaterThan(view.w * 0.25)
    for (let i = 0; i < view.orderPlates.length; i++) {
      const plate = view.orderPlates[i]!
      const icons = view.orderIcons.filter((entry) => entry.order === i).map((entry) => entry.rect)
      expect(icons.length).toBeGreaterThan(0)
      for (const icon of icons) {
        expect(icon.x).toBeGreaterThanOrEqual(plate.x - 1)
        expect(icon.x + icon.w).toBeLessThanOrEqual(plate.x + plate.w + 1)
        expect(icon.y + icon.h).toBeGreaterThan(plate.y)
        expect(icon.y).toBeLessThan(plate.y + plate.h)
      }
      for (let a = 0; a < icons.length; a++) {
        for (let b = a + 1; b < icons.length; b++) expect(overlaps(icons[a]!, icons[b]!)).toBe(false)
      }
    }
  })

  it('奖励气泡和托盘不盖住客人的脸', () => {
    const view = frame({ orderCount: 2, orderSlots: [1, 1] })
    for (const id of ['scholar', 'squire', 'fisherman']) {
      const spec = portraitConfig(id)
      for (let i = 0; i < view.orderGuests.length; i++) {
        const face = faceOf(view.orderGuests[i]!, spec.content, spec.face)
        expect(overlaps(face, view.orderRewards[i]!), `${id}-${i} reward`).toBe(false)
        expect(overlaps(face, view.orderPlates[i]!), `${id}-${i} plate`).toBe(false)
      }
    }
  })

  it('5 级按钮和订单一起滑，没宝箱时绿书下移，桌子留在槽位上', () => {
    const full = frame({ w: 1080, h: 2340, showStory: true, showTask: true, showChest: true, orderCount: 1, orderSlots: [1] })
    expect(full.storyBtn.y).toBeLessThan(full.chestBtn.y)
    expect(full.taskBtn.x).toBeGreaterThan(full.chestBtn.x + full.chestBtn.w)
    expect(full.orderPlates[0]!.x).toBeGreaterThan(full.taskBtn.x + full.taskBtn.w - 2)
    const noChest = frame({ w: 1080, h: 2340, showStory: true, showTask: true, showChest: false, orderCount: 1, orderSlots: [1] })
    expect(noChest.chestBtn.w).toBe(0)
    expect(noChest.storyBtn.y).toBeCloseTo(full.chestBtn.y, 0)
    const scrolled = frame({
      w: 1080,
      h: 2340,
      showStory: true,
      showTask: true,
      showChest: true,
      orderCount: 4,
      orderSlots: [1, 1, 1, 1],
      orderScroll: 80,
    })
    expect(scrolled.storyBtn.x).toBeCloseTo(full.storyBtn.x - 80, 0)
    expect(scrolled.taskBtn.x).toBeCloseTo(full.taskBtn.x - 80, 0)
    expect(full.orderGuests[0]!.x - scrolled.orderGuests[0]!.x).toBeCloseTo(full.tableSlots[0]!.x - scrolled.tableSlots[0]!.x, 1)
    expect(scrolled.orderGuests[0]!.x).toBeLessThan(full.orderGuests[0]!.x - 70)
  })

  it('棋盘格子用排版表的坐标，点在格子中心能点中', () => {
    const view = frame()
    const scale = view.w / 1080
    const spec = designCell(3, 4)!
    const box = cellRect(view, 3, 4)
    expect(box.w).toBeCloseTo(spec.w * scale, 3)
    expect(box.h).toBeCloseTo(box.w, 3)
    expect(box.x + box.w / 2).toBeCloseTo(view.board.x + (spec.x + spec.w / 2 - 7) * scale, 3)
    expect(box.y + box.h / 2).toBeCloseTo(view.board.y + (spec.y + spec.h / 2 - 714) * scale, 3)
    expect(hitTest(view, box.x + box.w / 2, box.y + box.h / 2)).toMatchObject({ kind: 'cell', row: 3, col: 4 })
  })

  it('六位客人有抠好的立绘，浣熊仍是占位，棋盘颜色在配置里', () => {
    const cfg = defaultConfig()
    for (const id of ['scholar', 'boatman', 'squire', 'fisherman', 'siamese', 'bossDaughter']) {
      expect(cfg.characters.find((entry) => entry.id === id)?.portrait).toBe(id)
      expect(PORTRAITS[id]).toContain(id)
    }
    expect(cfg.characters.find((entry) => entry.id === 'embroider')?.name).toBe('晴娘')
    expect(cfg.characters.find((entry) => entry.id === 'embroider')?.portrait).toBe('embroider')
    expect(PORTRAITS.embroider).toBe(PORTRAITS.bossDaughter)
    expect(cfg.characters.find((entry) => entry.id === 'raccoon')?.portrait).toBeUndefined()
    expect(PORTRAITS.ruyue).toContain('ruyue')
    expect(PORTRAITS.xiaotao).toContain('xiaotao')
    expect(PORTRAITS.zhao).toContain('zhao')
    expect(PORTRAITS.liu).toContain('liu')
    expect(cfg.boardTheme.cellLight).not.toBe(cfg.boardTheme.cellDark)
    expect(cfg.boardTheme.covered).not.toBe(cfg.boardTheme.cellLight)
    expect(cfg.boardTheme.half).not.toBe(cfg.boardTheme.covered)
    expect(cfg.boardTheme.mat).not.toBe(cfg.boardTheme.cellLight)
  })
})
