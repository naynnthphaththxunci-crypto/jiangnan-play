import type { GameConfig, GameState, NormBox } from './types'
import { COLS, ROWS } from './types'
import { SLIDERS } from './tuner'
import { clamp } from './format'
import { guideSpot } from './logic/sim'
import orderLayoutJson from './data/orderLayout.json'

type PctBox = { x: number; y: number; w: number; h: number }
type DesignBox = { x: number; y: number; w: number; h: number }
const ORDER_LAYOUT = orderLayoutJson as {
  ordersPerScreen: number
  peekRatio: number
  boardMargin: number
  yBasis: 'height'
  orderArea: PctBox
  rewardEntry: PctBox
  group: {
    w: number
    h: number
    portrait: DesignBox
    complete: DesignBox
    plate: DesignBox
    reward: DesignBox
    icon: { w: number; h: number }
  }
  itemName: { h: number }
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SliderRow {
  index: number
  y: number
  h: number
  trackX: number
  trackW: number
}

export interface Frame {
  w: number
  h: number
  mode: 'story' | 'board' | 'house'
  hotspot: Rect
  skip: Rect
  hud: Rect
  orders: Rect[]
  completes: Rect[]
  orderPlates: Rect[]
  orderRewards: Rect[]
  orderGuests: Rect[]
  orderCharms: Rect[]
  orderIcons: { order: number; slot: number; rect: Rect }[]
  orderNames: { order: number; slot: number; rect: Rect }[]
  sellBtn: Rect
  chainBtn: Rect
  orderClip: Rect
  orderMaxScroll: number
  hint: Rect
  board: { x: number; y: number; cell: number }
  rewardTray: Rect
  dock: Rect
  pendingBtn: Rect
  houseBtn: Rect
  tuneBtn: Rect
  dailyBtn: Rect
  sheet: Rect
  sheetBtn: Rect
  sheetSkip: Rect
  map: Rect
  backBtn: Rect
  zoomIn: Rect
  zoomOut: Rect
  zoomReset: Rect
  taskPanel: Rect
  buildBtn: Rect
  choiceBtns: Rect[]
  tunerCard: Rect
  tunerClose: Rect
  tunerExport: Rect
  tunerReset: Rect
  tunerNewbie: Rect
  tunerWipe: Rect
  tunerView: Rect
  sliders: SliderRow[]
  tunerMaxScroll: number
  modalCard: Rect
  modalPrimary: Rect
  modalGhost: Rect
  helpCard: Rect
  helpOk: Rect
  enterBtn: Rect
  renovateBtn: Rect
  infoBar: Rect
  avatarSlot: Rect
  energySlot: Rect
  coinSlot: Rect
  gemSlot: Rect
  smileSlot: Rect
  showStorage: boolean
  storageHot: boolean
  showTuner: boolean
  showModal: boolean
  showHelp: boolean
  rushBtn: Rect
  adBtn: Rect
}

export interface LayoutInput {
  w: number
  h: number
  insetTop: number
  insetBottom: number
  mode: 'story' | 'board' | 'house'
  orderCount: number
  orderSlots: number[]
  orderScroll: number
  showHint: boolean
  showSheet: boolean
  showSkip: boolean
  showDaily: boolean
  showHouseBtn: boolean
  showStorage: boolean
  storageHot?: boolean
  showSmile: boolean
  showRush?: boolean
  choiceCount: number
  tuner: boolean
  tunerScroll: number
  modal: boolean
  help: boolean
  showEnter: boolean
  showInfo: boolean
}

const Z: Rect = { x: 0, y: 0, w: 0, h: 0 }

export function contains(r: Rect, x: number, y: number): boolean {
  return r.w > 0 && r.h > 0 && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h
}

export function hudAnchors(frame: Frame): { coin: { x: number; y: number }; level: { x: number; y: number }; energy: { x: number; y: number } } {
  const mid = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
  return { coin: mid(frame.coinSlot), level: mid(frame.avatarSlot), energy: mid(frame.energySlot) }
}

export function portraitLayout(
  anchor: Rect,
  plateTop: number,
  content: NormBox,
  face: NormBox,
  aspect = 1,
): { image: Rect; face: Rect; content: Rect } {
  const targetH = Math.max(8, plateTop + 14 - (anchor.y + 1))
  const imageH = targetH / Math.max(0.05, content.h)
  const imageW = imageH * (aspect > 0 ? aspect : 1)
  const image: Rect = {
    x: anchor.x + anchor.w / 2 - (content.x + content.w / 2) * imageW,
    y: anchor.y + 1 - content.y * imageH,
    w: imageW,
    h: imageH,
  }
  const contentRect: Rect = {
    x: image.x + content.x * imageW,
    y: image.y + content.y * imageH,
    w: content.w * imageW,
    h: content.h * imageH,
  }
  return {
    image,
    content: contentRect,
    face: {
      x: contentRect.x + face.x * contentRect.w,
      y: contentRect.y + face.y * contentRect.h,
      w: face.w * contentRect.w,
      h: face.h * contentRect.h,
    },
  }
}

export function guestFaceBox(guest: Rect, face: NormBox): Rect {
  return {
    x: guest.x + face.x * guest.w,
    y: guest.y + face.y * guest.h,
    w: face.w * guest.w,
    h: face.h * guest.h,
  }
}

export function cellRect(frame: Frame, row: number, col: number): Rect {
  const { x, y, cell } = frame.board
  return { x: x + col * cell, y: y + row * cell, w: cell, h: cell }
}

export function cellCenter(frame: Frame, row: number, col: number): { x: number; y: number } {
  const rect = cellRect(frame, row, col)
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

export function guideHole(frame: Frame, state: GameState, cfg?: GameConfig): Rect | null {
  const spot = guideSpot(state, cfg)
  if (!spot) return null
  const live = (rect: Rect) => (rect.w > 0 && rect.h > 0 ? rect : null)
  if (spot === 'reward') return live(frame.rewardTray)
  if (spot === 'chest' && state.chestCell) return cellRect(frame, state.chestCell.row, state.chestCell.col)
  if (spot === 'producer') {
    for (let row = 0; row < state.board.length; row++) {
      for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'producer' && item.producerId === state.producerLesson) return cellRect(frame, row, col)
      }
    }
    return live(frame.rewardTray)
  }
  if (spot === 'build') return live(frame.houseBtn)
  if (spot === 'repair') return live(frame.buildBtn)
  if (spot === 'back') return live(frame.backBtn)
  if (spot === 'smile') return live(frame.smileSlot)
  if (spot === 'rush') return live(frame.rushBtn)
  return null
}

export function cellAt(frame: Frame, x: number, y: number): { row: number; col: number } | null {
  const b = frame.board
  if (b.cell <= 0) return null
  if (x < b.x || y < b.y || x >= b.x + b.cell * COLS || y >= b.y + b.cell * ROWS) return null
  return {
    col: Math.min(COLS - 1, Math.floor((x - b.x) / b.cell)),
    row: Math.min(ROWS - 1, Math.floor((y - b.y) / b.cell)),
  }
}

export type Hit =
  | { kind: 'skip' }
  | { kind: 'hotspot' }
  | { kind: 'story' }
  | { kind: 'cell'; row: number; col: number }
  | { kind: 'order'; index: number }
  | { kind: 'orderIcon'; order: number; slot: number }
  | { kind: 'orderStrip' }
  | { kind: 'sell' }
  | { kind: 'rush' }
  | { kind: 'adRush' }
  | { kind: 'undoSale' }
  | { kind: 'chain' }
  | { kind: 'pending' }
  | { kind: 'reward' }
  | { kind: 'house' }
  | { kind: 'tune' }
  | { kind: 'daily' }
  | { kind: 'sheet' }
  | { kind: 'back' }
  | { kind: 'zoom'; dir: 1 | -1 | 0 }
  | { kind: 'build' }
  | { kind: 'choice'; index: number }
  | { kind: 'map' }
  | { kind: 'slider'; index: number }
  | { kind: 'tunerClose' }
  | { kind: 'tunerExport' }
  | { kind: 'tunerReset' }
  | { kind: 'tunerNewbie' }
  | { kind: 'tunerWipe' }
  | { kind: 'tunerScroll' }
  | { kind: 'modalPrimary' }
  | { kind: 'modalGhost' }
  | { kind: 'modalClose' }
  | { kind: 'helpOk' }
  | { kind: 'enter' }
  | { kind: 'renovate' }
  | { kind: 'complete'; index: number }
  | { kind: 'swallow' }

export function layout(input: LayoutInput): Frame {
  const { w, h } = input
  const top = Math.max(0, input.insetTop)
  const bottomInset = Math.max(0, input.insetBottom)
  const unit = Math.max(0.72, w / 390)
  const boardMode = input.mode === 'board'
  const spec = ORDER_LAYOUT
  const orderClip: Rect = boardMode
    ? {
        x: spec.orderArea.x * w,
        y: top + spec.orderArea.y * h,
        w: spec.orderArea.w * w,
        h: spec.orderArea.h * h,
      }
    : Z
  const hudH = boardMode ? Math.max(32, Math.round(orderClip.y - top)) : Math.round(48 * unit)
  const dockH = boardMode ? Math.round(74 * unit) : 0
  const hud: Rect = { x: 0, y: top, w, h: hudH }
  const dock: Rect = boardMode ? { x: 0, y: h - bottomInset - dockH, w, h: dockH } : Z
  const side = Math.round(58 * unit)
  const gap = Math.round(8 * unit)
  const infoH = Math.round(50 * unit)
  const storageSlot: Rect = boardMode
    ? { x: 8, y: dock.y + (dockH - side) / 2, w: side, h: side }
    : Z
  const houseBtn: Rect = boardMode
    ? { x: w - 8 - side, y: dock.y + (dockH - side) / 2, w: side, h: side }
    : Z
  const infoBar: Rect = boardMode
    ? {
        x: storageSlot.x + storageSlot.w + gap,
        y: dock.y + (dockH - infoH) / 2,
        w: houseBtn.x - gap - (storageSlot.x + storageSlot.w + gap),
        h: infoH,
      }
    : Z
  const pendingBtn = storageSlot

  let board = { x: 0, y: 0, cell: 0 }
  if (boardMode) {
    const margin = Math.max(3, Math.round(spec.boardMargin * w))
    const boardTop = orderClip.y + orderClip.h + Math.round(2 * unit)
    const boardBottom = dock.y - Math.round(2 * unit)
    const availH = Math.max(40, boardBottom - boardTop)
    const cellByW = Math.floor((w - margin * 2) / COLS)
    const cellByH = Math.floor(availH / ROWS)
    const cell = Math.max(8, Math.min(cellByW, cellByH))
    const gridW = cell * COLS
    const gridH = cell * ROWS
    board = {
      x: Math.floor((w - gridW) / 2),
      y: boardTop + Math.max(0, Math.floor((availH - gridH) / 2)),
      cell,
    }
  }

  const n = boardMode ? input.orderCount : 0
  const rewardTray: Rect = boardMode
    ? {
        x: spec.rewardEntry.x * w,
        y: top + spec.rewardEntry.y * h,
        w: spec.rewardEntry.w * w,
        h: spec.rewardEntry.h * h,
      }
    : Z
  const origin = rewardTray.w > 0 ? rewardTray.x + rewardTray.w + Math.max(2, w * 0.008) : 8
  const pitch = (w - origin) / Math.max(1, spec.ordersPerScreen + spec.peekRatio)
  const group = spec.group
  let scale = pitch / group.w
  const maxScale = orderClip.h > 0 ? orderClip.h / group.h : scale
  if (scale > maxScale) scale = maxScale
  const placed = (box: DesignBox, i: number, scrollX: number): Rect => ({
    x: origin + i * pitch + box.x * scale - scrollX,
    y: orderClip.y + box.y * scale,
    w: box.w * scale,
    h: box.h * scale,
  })
  const span = Math.max(
    group.plate.x + group.plate.w,
    group.portrait.x + group.portrait.w,
    group.reward.x + group.reward.w,
  ) * scale
  const contentRight = n ? origin + (n - 1) * pitch + span : 0
  const orderMaxScroll = Math.max(0, contentRight - w)
  const scroll = clamp(input.orderScroll, 0, orderMaxScroll)
  const orders: Rect[] = []
  const completes: Rect[] = []
  const orderPlates: Rect[] = []
  const orderRewards: Rect[] = []
  const orderGuests: Rect[] = []
  const orderCharms: Rect[] = []
  const orderIcons: { order: number; slot: number; rect: Rect }[] = []
  const orderNames: { order: number; slot: number; rect: Rect }[] = []
  for (let i = 0; i < n; i++) {
    const plate = placed(group.plate, i, scroll)
    const guest = placed(group.portrait, i, scroll)
    const reward = placed(group.reward, i, scroll)
    orders.push(plate)
    orderPlates.push(plate)
    orderGuests.push(guest)
    orderRewards.push(reward)
    orderCharms.push(reward)
    completes.push(placed(group.complete, i, scroll))
    const slots = Math.max(1, input.orderSlots[i] ?? 1)
    const nameH = spec.itemName.h * w
    const padX = Math.max(3, plate.w * 0.04)
    const padY = Math.max(2, plate.h * 0.05)
    const gap = Math.max(4, plate.w * 0.04)
    const maxIconW = (plate.w - padX * 2 - gap * (slots - 1)) / slots
    const maxIconH = plate.h - padY * 2 - nameH - 2
    const iconSize = Math.max(8, Math.min(group.icon.w * scale, group.icon.h * scale, maxIconW, maxIconH))
    for (let slot = 0; slot < slots; slot++) {
      const x = slots === 1
        ? plate.x + (plate.w - iconSize) / 2
        : plate.x + padX + slot * (iconSize + gap + Math.max(0, (maxIconW - iconSize)))
      const icon = { x, y: plate.y + padY, w: iconSize, h: iconSize }
      orderIcons.push({ order: i, slot, rect: icon })
      const nameW = Math.max(8, Math.min(plate.w - 4, slots === 1 ? plate.w - 6 : maxIconW + gap * 0.5))
      let nameX = icon.x + icon.w / 2 - nameW / 2
      nameX = Math.max(plate.x + 1, Math.min(nameX, plate.x + plate.w - nameW - 1))
      orderNames.push({
        order: i,
        slot,
        rect: { x: nameX, y: icon.y + icon.h + 2, w: nameW, h: nameH },
      })
    }
  }
  const sellW = Math.round(54 * unit)
  const rushW = input.showRush ? Math.round(58 * unit) : 0
  const adW = input.showRush ? Math.round(44 * unit) : 0
  const rushBtn: Rect = infoBar.w > 0 && rushW > 0
    ? { x: infoBar.x + infoBar.w - rushW - adW - 10, y: infoBar.y + 6, w: rushW, h: infoBar.h - 12 }
    : Z
  const adBtn: Rect = rushBtn.w > 0
    ? { x: rushBtn.x + rushBtn.w + 4, y: rushBtn.y, w: adW, h: rushBtn.h }
    : Z
  const sellBtn: Rect = infoBar.w > 0 && rushW === 0
    ? { x: infoBar.x + infoBar.w - sellW - 6, y: infoBar.y + 6, w: sellW, h: infoBar.h - 12 }
    : Z
  const chainBtn: Rect = infoBar.w > 0
    ? { x: (sellBtn.w > 0 ? sellBtn.x : rushBtn.w > 0 ? rushBtn.x : infoBar.x + infoBar.w) - Math.round(26 * unit), y: infoBar.y + 4, w: Math.round(22 * unit), h: Math.round(22 * unit) }
    : Z

  const tuneS = Math.max(22, Math.round(26 * unit))
  const tuneBtn: Rect = { x: w - tuneS - 6, y: top + 4, w: tuneS, h: tuneS }
  const skipW = Math.round(56 * unit)
  const skip: Rect = input.showSkip
    ? { x: tuneBtn.x - 8 - skipW, y: top + 6, w: skipW, h: Math.round(30 * unit) }
    : Z
  const dailyBtn: Rect = input.showDaily
    ? { x: tuneBtn.x, y: tuneBtn.y + tuneS + 4, w: tuneS, h: tuneS }
    : Z

  const avatarSize = boardMode ? Math.max(36, Math.min(w * 0.145, hudH - 8)) : 0
  const avatarSlot: Rect = boardMode
    ? { x: w * 0.02, y: top + (hudH - avatarSize) / 2, w: avatarSize, h: avatarSize }
    : input.mode === 'house'
      ? { x: 8, y: hud.y + 6, w: Math.round(46 * unit), h: hudH - 12 }
      : Z
  const pillGap = boardMode ? Math.max(4, w * 0.012) : 4
  const pillH = boardMode ? Math.min(hudH * 0.62, w * 0.095) : Math.round(34 * unit)
  const cursor0 = avatarSlot.w > 0 ? avatarSlot.x + avatarSlot.w + pillGap : 8
  const pillRoom = boardMode ? Math.max(40, tuneBtn.x - 8 - cursor0) : Math.round(64 * unit) * 3
  const pillW = boardMode ? Math.min(w * 0.22, (pillRoom - pillGap * 2) / 3) : Math.round(64 * unit)
  const pillY = boardMode ? top + (hudH - pillH) / 2 : hud.y + (hudH - pillH) / 2
  let cursor = cursor0
  const energySlot: Rect = avatarSlot.w > 0 ? { x: cursor, y: pillY, w: pillW, h: pillH } : Z
  cursor += avatarSlot.w > 0 ? pillW + pillGap : 0
  const coinSlot: Rect = avatarSlot.w > 0 ? { x: cursor, y: pillY, w: pillW, h: pillH } : Z
  cursor += avatarSlot.w > 0 ? pillW + pillGap : 0
  const gemSlot: Rect = avatarSlot.w > 0 ? { x: cursor, y: pillY, w: pillW, h: pillH } : Z
  const smileSlot: Rect = boardMode && rewardTray.w > 0
    ? { x: rewardTray.x + rewardTray.w * 0.12, y: rewardTray.y + rewardTray.h * 0.68, w: rewardTray.w * 0.76, h: rewardTray.h * 0.22 }
    : Z

  const sheetH = input.showSheet ? Math.min(220, Math.round(h * 0.3)) : 0
  const housePanelH = input.mode === 'house' ? (input.choiceCount > 0 ? 176 : 138) : 0
  const sheet: Rect = input.showSheet ? { x: 12, y: h - sheetH - bottomInset - 8, w: w - 24, h: sheetH } : Z
  const sheetBtn: Rect = input.showSheet
    ? { x: sheet.x + 18, y: sheet.y + sheet.h - 58, w: sheet.w - 36, h: 42 }
    : Z
  const sheetSkip: Rect = input.showSheet ? { x: sheet.x + sheet.w - 78, y: sheet.y + 8, w: 64, h: 26 } : Z
  const map: Rect =
    input.mode === 'house' ? { x: 0, y: hud.y + hud.h, w, h: h - (hud.y + hud.h) - housePanelH - bottomInset } : Z
  const taskPanel: Rect = input.mode === 'house' ? { x: 10, y: map.y + map.h, w: w - 20, h: housePanelH } : Z
  const backBtn: Rect = input.mode === 'house' ? { x: 12, y: map.y + 10, w: 72, h: 34 } : Z
  const zoomSize = 34
  const zoomIn: Rect = input.mode === 'house' ? { x: w - 12 - zoomSize, y: map.y + 10, w: zoomSize, h: zoomSize } : Z
  const zoomOut: Rect = input.mode === 'house' ? { x: w - 12 - zoomSize, y: map.y + 48, w: zoomSize, h: zoomSize } : Z
  const zoomReset: Rect = input.mode === 'house' ? { x: w - 12 - zoomSize, y: map.y + 86, w: zoomSize, h: zoomSize } : Z
  let buildBtn = Z
  const choiceBtns: Rect[] = []
  if (input.mode === 'house') {
    if (input.choiceCount > 0) {
      const choiceGap = 8
      const bw = (taskPanel.w - 24 - choiceGap * (input.choiceCount - 1)) / input.choiceCount
      for (let i = 0; i < input.choiceCount; i++) {
        choiceBtns.push({
          x: taskPanel.x + 12 + i * (bw + choiceGap),
          y: taskPanel.y + taskPanel.h - 52,
          w: bw,
          h: 38,
        })
      }
    } else {
      buildBtn = { x: taskPanel.x + 12, y: taskPanel.y + taskPanel.h - 52, w: taskPanel.w - 24, h: 38 }
    }
  }

  const tunerCard: Rect = input.tuner ? { x: 10, y: 10, w: w - 20, h: h - 20 } : Z
  const tunerClose: Rect = input.tuner ? { x: tunerCard.x + tunerCard.w - 76, y: tunerCard.y + 10, w: 64, h: 32 } : Z
  const tunerView: Rect = input.tuner
    ? { x: tunerCard.x + 8, y: tunerCard.y + 50, w: tunerCard.w - 16, h: tunerCard.h - 50 - 128 }
    : Z
  const rowH = 40
  const contentH = SLIDERS.length * rowH + 86
  const tunerMaxScroll = Math.max(0, contentH - tunerView.h)
  const tunerScroll = clamp(input.tunerScroll, 0, tunerMaxScroll)
  const sliders: SliderRow[] = input.tuner
    ? SLIDERS.map((_, index) => ({
        index,
        y: tunerView.y + index * rowH - tunerScroll,
        h: rowH,
        trackX: tunerView.x + 118,
        trackW: Math.max(40, tunerView.w - 136),
      }))
    : []
  const tunerExport: Rect = input.tuner
    ? { x: tunerCard.x + 12, y: tunerCard.y + tunerCard.h - 84, w: (tunerCard.w - 32) / 2, h: 32 }
    : Z
  const tunerReset: Rect = input.tuner
    ? { x: tunerExport.x + tunerExport.w + 8, y: tunerExport.y, w: tunerExport.w, h: 32 }
    : Z
  const tunerNewbie: Rect = input.tuner
    ? { x: tunerCard.x + 12, y: tunerCard.y + tunerCard.h - 78, w: tunerCard.w - 24, h: 28 }
    : Z
  const tunerWipe: Rect = input.tuner
    ? { x: tunerCard.x + 12, y: tunerCard.y + tunerCard.h - 44, w: tunerCard.w - 24, h: 30 }
    : Z
  const mw = Math.min(320, w - 36)
  const modalCard: Rect = input.modal ? { x: (w - mw) / 2, y: (h - 240) / 2, w: mw, h: 240 } : Z
  const modalPrimary: Rect = input.modal
    ? { x: modalCard.x + 18, y: modalCard.y + 150, w: modalCard.w - 36, h: 38 }
    : Z
  const modalGhost: Rect = input.modal
    ? { x: modalCard.x + 18, y: modalCard.y + 194, w: modalCard.w - 36, h: 32 }
    : Z
  const helpW = Math.min(320, w - 36)
  const helpCard: Rect = input.help ? { x: (w - helpW) / 2, y: (h - 250) / 2, w: helpW, h: 250 } : Z
  const helpOk: Rect = input.help
    ? { x: helpCard.x + 18, y: helpCard.y + helpCard.h - 52, w: helpCard.w - 36, h: 36 }
    : Z
  const enterBtn: Rect = input.showEnter ? { x: (w - Math.round(168 * unit)) / 2, y: h * 0.42, w: Math.round(168 * unit), h: Math.round(56 * unit) } : Z

  return {
    w,
    h,
    mode: input.mode,
    hotspot:
      input.mode === 'story'
        ? { x: (w - Math.round(180 * unit)) / 2, y: h * 0.36, w: Math.round(180 * unit), h: Math.round(120 * unit) }
        : Z,
    skip,
    hud,
    orders,
    completes,
    orderPlates,
    orderRewards,
    orderGuests,
    orderCharms,
    orderIcons,
    orderNames,
    sellBtn,
    chainBtn,
    orderClip,
    orderMaxScroll,
    hint: Z,
    board,
    rewardTray,
    dock,
    pendingBtn,
    houseBtn,
    tuneBtn,
    dailyBtn,
    sheet,
    sheetBtn,
    sheetSkip,
    map,
    backBtn,
    zoomIn,
    zoomOut,
    zoomReset,
    taskPanel,
    buildBtn,
    choiceBtns,
    tunerCard,
    tunerClose,
    tunerExport,
    tunerReset,
    tunerNewbie,
    tunerWipe,
    tunerView,
    sliders,
    tunerMaxScroll,
    modalCard,
    modalPrimary,
    modalGhost,
    helpCard,
    helpOk,
    rushBtn,
    adBtn,
    enterBtn,
    renovateBtn: Z,
    infoBar,
    avatarSlot,
    energySlot,
    coinSlot,
    gemSlot,
    smileSlot,
    showStorage: input.showStorage,
    storageHot: input.storageHot ?? input.showStorage,
    showTuner: input.tuner,
    showModal: input.modal,
    showHelp: input.help,
  }
}

export function hitTest(frame: Frame, x: number, y: number): Hit | null {
  if (frame.showTuner) {
    if (contains(frame.tunerClose, x, y)) return { kind: 'tunerClose' }
    if (contains(frame.tunerExport, x, y)) return { kind: 'tunerExport' }
    if (contains(frame.tunerReset, x, y)) return { kind: 'tunerReset' }
    if (contains(frame.tunerNewbie, x, y)) return { kind: 'tunerNewbie' }
    if (contains(frame.tunerWipe, x, y)) return { kind: 'tunerWipe' }
    if (contains(frame.tunerView, x, y)) {
      for (const row of frame.sliders) {
        const visible = row.y + 4 < frame.tunerView.y + frame.tunerView.h && row.y + row.h - 4 > frame.tunerView.y
        if (visible && y >= row.y && y < row.y + row.h) return { kind: 'slider', index: row.index }
      }
      return { kind: 'tunerScroll' }
    }
    if (contains(frame.tunerCard, x, y)) return { kind: 'swallow' }
    return { kind: 'tunerClose' }
  }
  if (frame.showModal) {
    if (contains(frame.modalPrimary, x, y)) return { kind: 'modalPrimary' }
    if (contains(frame.modalGhost, x, y)) return { kind: 'modalGhost' }
    if (!contains(frame.modalCard, x, y)) return { kind: 'modalClose' }
    return { kind: 'swallow' }
  }
  if (frame.showHelp) {
    if (contains(frame.helpOk, x, y)) return { kind: 'helpOk' }
    return { kind: 'swallow' }
  }
  if (contains(frame.skip, x, y)) return { kind: 'skip' }
  if (contains(frame.tuneBtn, x, y)) return { kind: 'tune' }
  if (frame.mode === 'story') {
    if (contains(frame.hotspot, x, y)) return { kind: 'hotspot' }
    return { kind: 'swallow' }
  }
  if (contains(frame.sheetSkip, x, y)) return { kind: 'skip' }
  if (contains(frame.sheetBtn, x, y)) return { kind: 'sheet' }
  if (contains(frame.sheet, x, y)) return { kind: 'swallow' }
  if (contains(frame.enterBtn, x, y)) return { kind: 'enter' }
  if (contains(frame.dailyBtn, x, y)) return { kind: 'daily' }
  if (frame.mode === 'house') {
    if (contains(frame.backBtn, x, y)) return { kind: 'back' }
    if (contains(frame.zoomIn, x, y)) return { kind: 'zoom', dir: 1 }
    if (contains(frame.zoomOut, x, y)) return { kind: 'zoom', dir: -1 }
    if (contains(frame.zoomReset, x, y)) return { kind: 'zoom', dir: 0 }
    if (contains(frame.buildBtn, x, y)) return { kind: 'build' }
    for (let i = 0; i < frame.choiceBtns.length; i++) {
      if (contains(frame.choiceBtns[i], x, y)) return { kind: 'choice', index: i }
    }
    if (contains(frame.map, x, y)) return { kind: 'map' }
    return { kind: 'swallow' }
  }
  if ((frame.showStorage || frame.storageHot) && contains(frame.pendingBtn, x, y)) return { kind: 'pending' }
  if (frame.rewardTray.w > 0 && contains(frame.rewardTray, x, y)) return { kind: 'reward' }
  if (contains(frame.houseBtn, x, y)) return { kind: 'house' }
  if (contains(frame.sellBtn, x, y)) return { kind: 'sell' }
  if (frame.rushBtn.w > 0 && contains(frame.rushBtn, x, y)) return { kind: 'rush' }
  if (frame.adBtn.w > 0 && contains(frame.adBtn, x, y)) return { kind: 'adRush' }
  if (contains(frame.chainBtn, x, y)) return { kind: 'chain' }
  if (contains(frame.orderClip, x, y)) {
    for (let i = 0; i < frame.completes.length; i++) {
      if (contains(frame.completes[i], x, y)) return { kind: 'complete', index: i }
    }
    for (const icon of frame.orderIcons) {
      if (contains(icon.rect, x, y)) return { kind: 'orderIcon', order: icon.order, slot: icon.slot }
    }
    for (let i = 0; i < frame.orders.length; i++) {
      if (contains(frame.orders[i], x, y)) return { kind: 'order', index: i }
    }
    return { kind: 'orderStrip' }
  }
  const cell = cellAt(frame, x, y)
  if (cell) return { kind: 'cell', ...cell }
  return null
}

export function chainCardRect(frame: Frame): Rect {
  const w = Math.min(340, frame.w - 32)
  const h = Math.min(480, frame.h - 72)
  return { x: (frame.w - w) / 2, y: (frame.h - h) / 2, w, h }
}

export function chainCloseRect(frame: Frame): Rect {
  const card = chainCardRect(frame)
  return { x: card.x + card.w - 42, y: card.y + 12, w: 30, h: 30 }
}

export function chainPopRect(frame: Frame): { card: Rect; close: Rect } {
  const w = Math.min(340, frame.w - 24)
  const h = 210
  const card = { x: (frame.w - w) / 2, y: Math.max(8, frame.dock.y - h - 8), w, h }
  return { card, close: { x: card.x + card.w - 40, y: card.y + 8, w: 28, h: 28 } }
}

export function decorPopupRects(frame: Frame): { card: Rect; swatches: Rect[]; ok: Rect } {
  const w = Math.min(300, frame.w - 28)
  const h = 176
  const card = { x: (frame.w - w) / 2, y: frame.h - h - 18, w, h }
  const swatches = [0, 1, 2].map((index) => ({
    x: card.x + 22 + index * ((card.w - 44) / 3),
    y: card.y + 46,
    w: (card.w - 44) / 3 - 8,
    h: 52,
  }))
  return { card, swatches, ok: { x: card.x + 22, y: card.y + 112, w: card.w - 44, h: 44 } }
}

export function levelClaimRect(frame: Frame): Rect {
  return { x: frame.w / 2 - 90, y: frame.h / 2 + 78, w: 180, h: 40 }
}

export function talkRect(frame: Frame): { card: Rect; ok: Rect } {
  const w = Math.min(320, frame.w - 32)
  const card = { x: (frame.w - w) / 2, y: frame.h * 0.58, w, h: 148 }
  return { card, ok: { x: card.x + 20, y: card.y + 96, w: card.w - 40, h: 36 } }
}

export function smileDismissRect(frame: Frame): Rect {
  return { x: frame.w / 2 - 90, y: frame.h / 2 + 96, w: 180, h: 40 }
}

export function trackRatio(cfg: GameConfig, index: number): number {
  const spec = SLIDERS[index]
  if (!spec) return 0
  const value = spec.get(cfg)
  return clamp((value - spec.min) / (spec.max - spec.min || 1), 0, 1)
}
