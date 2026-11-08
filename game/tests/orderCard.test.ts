import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import orderLayout from '../src/data/orderLayout.json'
import { guestFaceBox, layout, type LayoutInput, type Rect } from '../src/layout'
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

function bodyOf(slot: Rect, content: NormBox): Rect {
  return {
    x: slot.x + content.x * slot.w,
    y: slot.y + content.y * slot.h,
    w: content.w * slot.w,
    h: content.h * slot.h,
  }
}

function faceOf(slot: Rect, content: NormBox, face: NormBox): Rect {
  const body = bodyOf(slot, content)
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

function inside(inner: Rect, outer: Rect): boolean {
  return inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.w <= outer.x + outer.w + 0.5 && inner.y + inner.h <= outer.y + outer.h + 0.5
}

describe('订单卡', () => {
  it('物品、奖励和完成按钮互不重叠，也不挡住棋盘', () => {
    const view = frame()
    expect(view.orderClip.y + view.orderClip.h).toBeLessThanOrEqual(view.board.y)
    expect(view.orders).toHaveLength(3)
    for (const plate of view.orderPlates) {
      expect(plate.x).toBeGreaterThanOrEqual(-1)
      expect(plate.x + plate.w).toBeLessThanOrEqual(view.w + 1)
    }
    expect(view.rewardTray.x + view.rewardTray.w).toBeLessThanOrEqual(view.orders[0]!.x)
    for (let i = 0; i < view.orders.length; i++) {
      const card = view.orders[i]!
      const plate = view.orderPlates[i]!
      const pay = view.orderRewards[i]!
      const button = view.completes[i]!
      const icons = view.orderIcons.filter((entry) => entry.order === i).map((entry) => entry.rect)
      expect(inside(card, view.orderClip)).toBe(true)
      expect(inside(plate, card)).toBe(true)
      expect(button.y).toBeLessThan(plate.y)
      expect(button.y + button.h - plate.y).toBeLessThanOrEqual(view.w * 0.01 + 1)
      expect(overlaps(pay, plate)).toBe(false)
      expect(overlaps(pay, button)).toBe(false)
      expect(pay.w).toBeLessThan(48)
      expect(pay.h).toBeLessThan(70)
      for (const icon of icons) {
        expect(inside(icon, plate)).toBe(true)
        expect(overlaps(icon, pay)).toBe(false)
      }
      for (let a = 0; a < icons.length; a++) {
        for (let b = a + 1; b < icons.length; b++) expect(overlaps(icons[a]!, icons[b]!)).toBe(false)
      }
    }
    const wide = frame({ w: 1280, h: 900, orderCount: 4, orderSlots: [1, 1, 1, 1] })
    expect(wide.orderMaxScroll).toBeGreaterThan(0)
    expect(wide.orderClip.y + wide.orderClip.h).toBeLessThanOrEqual(wide.board.y)
  })

  it('奖励、完成按钮和台面都不盖住脸', () => {
    const cfg = defaultConfig()
    const view = frame({ orderCount: 1, orderSlots: [2] })
    const guest = view.orderGuests[0]!
    const pay = view.orderRewards[0]!
    const button = view.completes[0]!
    const plate = view.orderPlates[0]!
    for (const person of cfg.characters) {
      if (!person.portrait && !person.face) continue
      const face = person.portrait
        ? faceOf(view.orderGuests[0]!, portraitConfig(person.portrait).content, portraitConfig(person.portrait).face)
        : guestFaceBox(guest, person.face!)
      expect(overlaps(face, pay), person.id).toBe(false)
      expect(overlaps(face, button), person.id).toBe(false)
      expect(overlaps(face, plate), person.id).toBe(false)
    }
    const row = frame({ orderCount: 3, orderSlots: [1, 1, 1] })
    for (let i = 0; i < row.orders.length; i++) {
      const badge = row.orderRewards[i]!
      for (const id of ['teaGuest', 'scholar', 'embroider']) {
        const spec = portraitConfig(id)
        const face = faceOf(row.orderGuests[i]!, spec.content, spec.face)
        expect(overlaps(face, badge), `${id}-${i}`).toBe(false)
      }
    }
  })

  it('奖励框在屏幕内，最右客人完整可见', () => {
    const view = frame({ orderCount: 3, orderSlots: [1, 1, 1] })
    for (const pay of view.orderRewards) {
      expect(pay.x).toBeGreaterThanOrEqual(0)
      expect(pay.x + pay.w).toBeLessThanOrEqual(view.w)
    }
    const last = view.orderGuests.at(-1)!
    for (const id of ['teaGuest', 'scholar', 'embroider']) {
      const body = bodyOf(last, portraitConfig(id).content)
      expect(body.x + body.w, id).toBeLessThanOrEqual(view.w + view.w * 0.02)
    }
  })

  it('客人只露上半身，大小一致，各自待在自己那一栏', () => {
    const ids = ['teaGuest', 'scholar', 'embroider', 'boatman', 'squire', 'fisherman']
    const view = frame({ w: 393, h: 852, orderCount: 3, orderSlots: [1, 1, 1] })
    const guest = view.orderGuests[0]!
    const plate = view.orderPlates[0]!
    expect(Math.abs(guest.w - guest.h)).toBeLessThanOrEqual(0.5)
    const heights = ids.map((id) => bodyOf(guest, portraitConfig(id).content).h)
    const mean = heights.reduce((sum, value) => sum + value, 0) / heights.length
    const pitch = view.orderPlates[1]!.x - plate.x
    for (const id of ids) {
      const body = bodyOf(guest, portraitConfig(id).content)
      expect(body.y - view.orderClip.y, id).toBeGreaterThanOrEqual(0)
      expect(body.y - view.orderClip.y, id).toBeLessThanOrEqual(70)
      expect(Math.abs(body.h - mean) / mean, id).toBeLessThan(0.04)
      expect(body.h, id).toBeGreaterThan(guest.h * 0.5)
      expect(body.h, id).toBeLessThan(guest.h * 0.75)
      const covered = (body.y + body.h - plate.y) / body.h
      expect(covered, id).toBeGreaterThan(0.12)
      expect(covered, id).toBeLessThan(0.24)
      expect(body.x, id).toBeGreaterThanOrEqual(plate.x - 1)
      expect(body.x + body.w, id).toBeLessThanOrEqual(plate.x + pitch + 1)
    }
    for (let i = 0; i < view.orderGuests.length - 1; i++) {
      for (const left of ids) {
        for (const right of ids) {
          const a = bodyOf(view.orderGuests[i]!, portraitConfig(left).content)
          const b = bodyOf(view.orderGuests[i + 1]!, portraitConfig(right).content)
          expect(a.x + a.w, `${left}->${right}`).toBeLessThanOrEqual(b.x + 1)
        }
      }
    }
  })

  it('393 宽竖屏完整露出 3 个订单，第 4 个只露一截，棋盘左右边距很小', () => {
    const width = 393
    const height = 852
    const view = frame({ w: width, h: height, orderCount: 4, orderSlots: [1, 1, 1, 1] })
    expect(orderLayout.ordersPerScreen).toBe(3)
    expect(orderLayout.peekRatio).toBeGreaterThan(0)
    expect(orderLayout.peekRatio).toBeLessThan(0.4)
    for (let i = 0; i < orderLayout.ordersPerScreen; i++) {
      const plate = view.orderPlates[i]!
      const guest = view.orderGuests[i]!
      expect(plate.x, `plate ${i}`).toBeGreaterThanOrEqual(-1)
      expect(plate.x + plate.w, `plate ${i}`).toBeLessThanOrEqual(width + 1)
      expect(Math.abs(guest.w - guest.h), `guest ${i}`).toBeLessThanOrEqual(0.5)
      for (const id of ['teaGuest', 'scholar', 'embroider']) {
        const face = faceOf(guest, portraitConfig(id).content, portraitConfig(id).face)
        expect(face.x, `${id} face ${i}`).toBeGreaterThanOrEqual(-1)
        expect(face.x + face.w, `${id} face ${i}`).toBeLessThanOrEqual(width + 1)
      }
    }
    const fourth = view.orderPlates[3]!
    expect(fourth.x).toBeLessThan(width)
    expect(fourth.x + fourth.w).toBeGreaterThan(width)
    const visible = (width - fourth.x) / fourth.w
    expect(visible).toBeGreaterThan(0.08)
    expect(visible).toBeLessThan(0.4)
    expect(Math.abs(visible - orderLayout.peekRatio)).toBeLessThanOrEqual(0.04)
    const gridW = view.board.cell * 7
    const margin = (width - gridW) / 2
    expect(margin).toBeLessThanOrEqual(8)
    expect(view.board.y).toBeGreaterThanOrEqual(view.orderClip.y + view.orderClip.h - 1)
    expect(view.board.y + view.board.cell * 9).toBeLessThanOrEqual(view.dock.y)
    const scale = view.orderGuests[0]!.w / orderLayout.group.portrait.w
    const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(width * 0.01)
    near(view.orderPlates[0]!.w, orderLayout.group.plate.w * scale)
    near(view.completes[0]!.w, orderLayout.group.complete.w * scale)
    near(view.orderRewards[0]!.h, orderLayout.group.reward.h * scale)
  })

  it('木质托盘按比例铺在订单栏里，物品色块落在桌面上', () => {
    const view = frame({ w: 393, h: 852, orderCount: 2, orderSlots: [2, 1] })
    const top = orderLayout.group.tabletop
    const aspect = orderLayout.group.plate.w / orderLayout.group.plate.h
    expect(Math.abs(aspect - 809 / 279)).toBeLessThan(0.02)
    const pitch = view.orderPlates[1]!.x - view.orderPlates[0]!.x
    view.orderPlates.forEach((plate, index) => {
      expect(plate.w).toBeLessThanOrEqual(pitch + 0.5)
      const surface = {
        x: plate.x + top.x * plate.w,
        y: plate.y + top.y * plate.h,
        w: top.w * plate.w,
        h: top.h * plate.h,
      }
      const icons = view.orderIcons.filter((entry) => entry.order === index)
      expect(icons.length).toBeGreaterThan(0)
      for (const icon of icons) expect(inside(icon.rect, surface)).toBe(true)
    })
  })

  it('托盘上每件物品的名字独立、不重叠，手机上看得清', () => {
    const view = frame({ w: 393, h: 852, orderCount: 2, orderSlots: [2, 1] })
    expect(view.orderNames.length).toBeGreaterThan(0)
    for (const name of view.orderNames) {
      const plate = view.orderPlates[name.order]!
      const icon = view.orderIcons.find((entry) => entry.order === name.order && entry.slot === name.slot)!.rect
      expect(inside(name.rect, plate)).toBe(true)
      expect(name.rect.y).toBeGreaterThanOrEqual(icon.y + icon.h - 0.5)
      expect(name.rect.h).toBeGreaterThanOrEqual(16)
      expect(name.rect.h / view.w).toBeGreaterThanOrEqual(0.04)
    }
    const paired = view.orderNames.filter((entry) => entry.order === 0)
    expect(paired).toHaveLength(2)
    const [left, right] = paired
    expect(left!.rect.x + left!.rect.w).toBeLessThanOrEqual(right!.rect.x - 4)
    expect(overlaps(left!.rect, right!.rect)).toBe(false)
    for (const icon of view.orderIcons) expect(icon.rect.w).toBeGreaterThan(10)
  })

  it('六位客人有抠好的立绘，浣熊仍是占位，棋盘颜色在配置里', () => {
    const cfg = defaultConfig()
    for (const id of ['teaGuest', 'scholar', 'embroider', 'boatman', 'squire', 'fisherman']) {
      expect(cfg.characters.find((entry) => entry.id === id)?.portrait).toBe(id)
      expect(PORTRAITS[id]).toContain(id)
    }
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
