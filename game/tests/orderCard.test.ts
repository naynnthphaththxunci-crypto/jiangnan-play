import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import orderLayout from '../src/data/orderLayout.json'
import { guestFaceBox, layout, type LayoutInput, type Rect } from '../src/layout'
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
    const third = view.w / 3
    expect(Math.abs(view.orderPlates[1]!.x - view.orderPlates[0]!.x - third)).toBeLessThanOrEqual(1)
    expect(overlaps(view.rewardTray, view.orderPlates[0]!)).toBe(false)
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
        expect(icon.x).toBeGreaterThanOrEqual(plate.x - 1)
        expect(icon.x + icon.w).toBeLessThanOrEqual(plate.x + plate.w + 1)
        expect(icon.y + icon.h).toBeGreaterThan(plate.y)
        expect(icon.y + icon.h).toBeLessThan(plate.y + plate.h)
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
    const ids = ['teaGuest', 'scholar', 'embroider', 'boatman', 'squire', 'fisherman', 'siamese', 'bossDaughter']
    const view = frame({ w: 393, h: 852, orderCount: 3, orderSlots: [1, 1, 1] })
    const guest = view.orderGuests[0]!
    const plate = view.orderPlates[0]!
    expect(Math.abs(guest.w - guest.h)).toBeLessThanOrEqual(0.5)
    const busts = ids.filter((id) => portraitConfig(id).content.h > 0.8)
    const heights = busts.map((id) => bodyOf(guest, portraitConfig(id).content).h)
    const mean = heights.reduce((sum, value) => sum + value, 0) / heights.length
    const pitch = view.orderPlates[1]!.x - plate.x
    for (const id of ids) {
      const body = bodyOf(guest, portraitConfig(id).content)
      expect(body.y - view.orderClip.y, id).toBeGreaterThanOrEqual(0)
      expect(body.y - view.orderClip.y, id).toBeLessThanOrEqual(70)
      if (busts.includes(id)) expect(Math.abs(body.h - mean) / mean, id).toBeLessThan(0.04)
      expect(body.h, id).toBeGreaterThan(guest.h * 0.5)
      expect(body.h, id).toBeLessThan(guest.h * 0.98)
      const covered = (body.y + body.h - plate.y) / body.h
      if (body.y + body.h > plate.y) expect(covered, id).toBeLessThan(0.5)
      expect(body.x, id).toBeGreaterThanOrEqual(-1)
      expect(body.x + body.w, id).toBeLessThanOrEqual(pitch + 1)
    }
    const chinGuests = ['teaGuest', 'siamese', 'bossDaughter', 'squire']
    for (const id of chinGuests) {
      const body = bodyOf(guest, portraitConfig(id).content)
      const chin = body.y + body.h * 0.7
      for (const icon of view.orderIcons) {
        expect(icon.rect.y, id).toBeGreaterThanOrEqual(chin - 1)
      }
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

  it('393 宽竖屏同时放下 3 位客人，每人正好三分之一宽', () => {
    const width = 393
    const height = 852
    const view = frame({ w: width, h: height, orderCount: 4, orderSlots: [1, 1, 1, 1] })
    expect(orderLayout.ordersPerScreen).toBe(3)
    expect(orderLayout.peekRatio).toBe(0)
    const pitch = width / 3
    expect(Math.abs(view.orderPlates[1]!.x - view.orderPlates[0]!.x - pitch)).toBeLessThanOrEqual(1)
    for (let i = 0; i < orderLayout.ordersPerScreen; i++) {
      const plate = view.orderPlates[i]!
      const guest = view.orderGuests[i]!
      expect(plate.x, `plate ${i}`).toBeGreaterThanOrEqual(i * pitch - 1)
      expect(plate.x + plate.w, `plate ${i}`).toBeLessThanOrEqual((i + 1) * pitch + 1)
      expect(Math.abs(guest.w - guest.h), `guest ${i}`).toBeLessThanOrEqual(0.5)
      for (const id of ['teaGuest', 'scholar', 'embroider']) {
        const face = faceOf(guest, portraitConfig(id).content, portraitConfig(id).face)
        expect(face.x, `${id} face ${i}`).toBeGreaterThanOrEqual(i * pitch - 1)
        expect(face.x + face.w, `${id} face ${i}`).toBeLessThanOrEqual((i + 1) * pitch + 1)
      }
    }
    const fourth = view.orderPlates[3]!
    expect(fourth.x).toBeGreaterThanOrEqual(width - 1)
    expect(view.orderMaxScroll).toBeGreaterThan(0)
    const scrolled = frame({ w: width, h: height, orderCount: 4, orderSlots: [1, 1, 1, 1], orderScroll: view.orderMaxScroll })
    const brought = scrolled.orderPlates[3]!
    const broughtReward = scrolled.orderRewards[3]!
    expect(brought.x).toBeGreaterThanOrEqual(-1)
    expect(brought.x + brought.w).toBeLessThanOrEqual(width + 1)
    expect(broughtReward.x).toBeGreaterThanOrEqual(-1)
    expect(broughtReward.x + broughtReward.w).toBeLessThanOrEqual(width + 1)
    expect(Math.abs(scrolled.orderPlates[1]!.x - scrolled.orderPlates[0]!.x - pitch)).toBeLessThanOrEqual(1)
    const three = frame({ w: width, h: height, orderCount: 3, orderSlots: [1, 1, 1] })
    expect(three.orderMaxScroll).toBe(0)
    expect(scrollOrders(0, -pitch, view.orderMaxScroll)).toBeGreaterThan(0)
    expect(scrollOrders(0, -pitch, view.orderMaxScroll)).toBeLessThanOrEqual(view.orderMaxScroll)
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

  it('木质托盘按比例铺在订单栏里，物品站在桌面上且接近一格大', () => {
    const view = frame({ w: 390, h: 844, orderCount: 2, orderSlots: [2, 1] })
    const aspect = orderLayout.group.plate.w / orderLayout.group.plate.h
    expect(Math.abs(aspect - 294 / 112)).toBeLessThan(0.02)
    expect(view.orderRewards[0]!.w / view.w).toBeGreaterThan(0.085)
    expect(view.orderRewards[0]!.w / view.w).toBeLessThan(0.1)
    const pitch = view.orderPlates[1]!.x - view.orderPlates[0]!.x
    view.orderPlates.forEach((plate, index) => {
      expect(plate.w).toBeLessThanOrEqual(pitch + 0.5)
      const icons = view.orderIcons.filter((entry) => entry.order === index)
      expect(icons.length).toBeGreaterThan(0)
      for (const icon of icons) {
        expect(icon.rect.w).toBeGreaterThanOrEqual(38)
        expect(icon.rect.w).toBeLessThanOrEqual(44)
        const stand = plate.y + plate.h - 1
        expect(Math.abs(icon.rect.y + icon.rect.h - stand)).toBeLessThan(1)
      }
    })
  })

  it('托盘下不再放名字牌子，奖励按钮完整落在订单区里', () => {
    const view = frame({ w: 390, h: 844, orderCount: 2, orderSlots: [2, 1] })
    expect(view.orderNames).toHaveLength(0)
    const clip = view.orderClip
    const chest = view.rewardTray
    expect(chest.y).toBeGreaterThanOrEqual(clip.y)
    expect(chest.y + chest.h).toBeLessThanOrEqual(clip.y + clip.h + 1)
    expect(chest.y + chest.h).toBeLessThanOrEqual(view.board.y)
    expect(chest.h).toBeGreaterThan(28)
    expect(overlaps(chest, view.orderPlates[0]!)).toBe(false)
    for (const icon of view.orderIcons) expect(icon.rect.w).toBeGreaterThanOrEqual(38)
  })

  it('六位客人有抠好的立绘，浣熊仍是占位，棋盘颜色在配置里', () => {
    const cfg = defaultConfig()
    for (const id of ['teaGuest', 'scholar', 'embroider', 'boatman', 'squire', 'fisherman', 'siamese', 'bossDaughter']) {
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
