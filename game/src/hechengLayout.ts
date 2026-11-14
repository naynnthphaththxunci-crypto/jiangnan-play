import cells from './data/boardCells.json'
import { clamp } from './format'
import { KEEP_TOP } from './viewport'

export const DESIGN_W = 1080
export const DESIGN_H = 2340
export const BOARD_X = 7
export const BOARD_Y = 714

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

const CELL_TABLE = cells as number[][]

const PITCH = 313

/** 客人原画是 1024 的整张画布，按这个比例缩到 1080 宽的设计稿上。 */
export const GUEST_CANVAS = 1024
export const GUEST_SCALE = 0.29

/** 画布左上角。顶部对齐在 y≈305，水平落在各自托盘中间。 */
const GUEST_ANCHOR: { x: number; y: number }[] = [
  { x: 338, y: 307 },
  { x: 632, y: 303 },
  { x: 975, y: 303 },
]
const PLATES: Box[] = [
  { x: 354, y: 568, w: 294, h: 112 },
  { x: 667, y: 568, w: 294, h: 112 },
  { x: 980, y: 568, w: 294, h: 112 },
]
const REWARDS: Box[] = [
  { x: 568, y: 359, w: 107, h: 101 },
  { x: 902, y: 359, w: 107, h: 101 },
  { x: 1210, y: 359, w: 107, h: 101 },
]
const COMPLETES: Box[] = [
  { x: 403, y: 624, w: 182, h: 94 },
  { x: 716, y: 624, w: 182, h: 94 },
  { x: 1029, y: 624, w: 182, h: 94 },
]

/** 绿书和任务板从这一级起才出现。 */
export const SIDE_ICON_LEVEL = 5

const STORY_BTN: Box = { x: 29, y: 406, w: 113, h: 115 }
const CHEST_BTN: Box = { x: 29, y: 529, w: 113, h: 115 }
const TASK_BTN: Box = { x: 178, y: 463, w: 148, h: 184 }
const BOOK_ICON: Box = { x: 40, y: 421, w: 91, h: 85 }
const CHEST_ICON: Box = { x: 43, y: 548, w: 85, h: 81 }
const TASK_ICON: Box = { x: 206, y: 482, w: 89, h: 103 }
const BADGE_STORY: Box = { x: 114, y: 399, w: 36, h: 36 }
const BADGE_CHEST: Box = { x: 114, y: 521, w: 36, h: 36 }
const BADGE_TASK: Box = { x: 292, y: 452, w: 44, h: 45 }
const ZERO_BOX: Box = { x: 0, y: 0, w: 0, h: 0 }

export interface HechengInput {
  w: number
  h: number
  insetTop: number
  insetBottom: number
  orderCount: number
  orderSlots: number[]
  orderScroll: number
  showRush?: boolean
  /** 1024 画布相对设计稿宽度的缩放，默认 0.29。 */
  guestCanvasScale?: number
  /** 缺省为显示，方便旧调用。合成页会按等级和奖励显式关掉。 */
  showStory?: boolean
  showTask?: boolean
  showChest?: boolean
}

export interface HechengScene {
  scale: number
  top: number
  orderClip: Box
  orders: Box[]
  completes: Box[]
  orderPlates: Box[]
  orderRewards: Box[]
  orderGuests: Box[]
  orderIcons: { order: number; slot: number; rect: Box }[]
  orderMaxScroll: number
  board: { x: number; y: number; cell: number }
  rewardTray: Box
  dock: Box
  pendingBtn: Box
  houseBtn: Box
  infoBar: Box
  avatarSlot: Box
  energySlot: Box
  coinSlot: Box
  gemSlot: Box
  smileSlot: Box
  multBtn: Box
  shopBtn: Box
  sellBtn: Box
  chainBtn: Box
  rushBtn: Box
  adBtn: Box
  energyPlus: Box
  chestBtn: Box
  storyBtn: Box
  taskBtn: Box
  hud: Box
  counter: Box
  boardArt: Box
  taskIcon: Box
  bookIcon: Box
  chestIcon: Box
  badgeStory: Box
  badgeChest: Box
  badgeTask: Box
  badgeShop: Box
}

function childOf(button: Box, designButton: Box, designChild: Box): Box {
  if (button.w <= 0 || button.h <= 0) return ZERO_BOX
  const sx = button.w / designButton.w
  const sy = button.h / designButton.h
  return {
    x: button.x + (designChild.x - designButton.x) * sx,
    y: button.y + (designChild.y - designButton.y) * sy,
    w: designChild.w * sx,
    h: designChild.h * sy,
  }
}

function slotAt(list: Box[], index: number): Box {
  if (index < list.length) return list[index]!
  const last = list[list.length - 1]!
  return { ...last, x: last.x + (index - (list.length - 1)) * PITCH }
}

/** 整张 1024 画布的设计坐标。默认比例下左上角就是锚点；改比例时绕画布中心缩放。 */
export function guestCanvasBox(index: number, guestScale = GUEST_SCALE): Box {
  const anchor = index < GUEST_ANCHOR.length
    ? GUEST_ANCHOR[index]!
    : { x: GUEST_ANCHOR[2]!.x + (index - 2) * PITCH, y: GUEST_ANCHOR[2]!.y }
  const nominal = GUEST_CANVAS * GUEST_SCALE
  const size = GUEST_CANVAS * guestScale
  return { x: anchor.x + nominal / 2 - size / 2, y: anchor.y, w: size, h: size }
}

export function designCell(row: number, col: number): Box | null {
  const entry = CELL_TABLE[row * 7 + col]
  if (!entry) return null
  return { x: entry[0]!, y: entry[1]!, w: entry[2]!, h: entry[3]! }
}

/** 棋盘图左上角在屏幕上的位置。格子跟着这张图走。 */
/** 用棋盘图左上角和底栏上沿反推设计坐标。底栏锚在屏幕底部，棋盘锚在顶部。 */
export function designToScreen(
  frame: { w: number; board: { x: number; y: number }; dock: { y: number } },
  box: Box,
  anchor: 'top' | 'bottom' = 'top',
): Box {
  const scale = frame.w / DESIGN_W
  const top = frame.board.y - BOARD_Y * scale
  const extra = frame.dock.y - top - 2112 * scale
  return {
    x: box.x * scale,
    y: top + box.y * scale + (anchor === 'bottom' ? extra : 0),
    w: box.w * scale,
    h: box.h * scale,
  }
}

export function cellOnBoard(board: { x: number; y: number }, scale: number, row: number, col: number): Box {
  const spec = designCell(row, col) ?? { x: BOARD_X + 43 + col * 141, y: BOARD_Y + 42 + row * 143, w: 139, h: 140 }
  const side = spec.w * scale
  return {
    x: board.x + (spec.x - BOARD_X) * scale,
    y: board.y + (spec.y - BOARD_Y) * scale + (spec.h * scale - side) / 2,
    w: side,
    h: side,
  }
}

export function hechengParts(input: HechengInput): HechengScene {
  const scale = input.w / DESIGN_W
  const availTop = Math.max(0, input.insetTop)
  const availBottom = input.h - Math.max(0, input.insetBottom)
  // 底对齐设计稿。再保证资源条不被裁出屏幕，只裁它上方的场景。
  const sceneTop = Math.max(availTop - KEEP_TOP * scale, availBottom - DESIGN_H * scale)
  const place = (box: Box, scroll = 0): Box => ({
    x: box.x * scale - scroll,
    y: sceneTop + box.y * scale,
    w: box.w * scale,
    h: box.h * scale,
  })
  const guestScale = input.guestCanvasScale && input.guestCanvasScale > 0 ? input.guestCanvasScale : GUEST_SCALE
  const n = Math.max(0, input.orderCount)
  let right = 0
  for (let i = 0; i < n; i++) {
    for (const box of [guestCanvasBox(i, guestScale), slotAt(PLATES, i), slotAt(REWARDS, i), slotAt(COMPLETES, i)]) {
      right = Math.max(right, (box.x + box.w) * scale)
    }
  }
  right += 16 * scale
  const orderMaxScroll = Math.max(0, right - input.w)
  const scroll = clamp(input.orderScroll, 0, orderMaxScroll)
  const orders: Box[] = []
  const completes: Box[] = []
  const orderPlates: Box[] = []
  const orderRewards: Box[] = []
  const orderGuests: Box[] = []
  const orderIcons: { order: number; slot: number; rect: Box }[] = []
  for (let i = 0; i < n; i++) {
    const plate = place(slotAt(PLATES, i), scroll)
    const guest = place(guestCanvasBox(i, guestScale), scroll)
    const reward = place(slotAt(REWARDS, i), scroll)
    const button = place(slotAt(COMPLETES, i), scroll)
    orders.push(plate)
    orderPlates.push(plate)
    orderGuests.push(guest)
    orderRewards.push(reward)
    completes.push(button)
    const slots = Math.max(1, input.orderSlots[i] ?? 1)
    const size = Math.min(plate.h * 0.92, (plate.w * 0.84) / slots)
    const gap = size * 0.08
    const total = slots * size + (slots - 1) * gap
    const x0 = plate.x + (plate.w - total) / 2
    const y = plate.y - size * 0.28
    for (let slot = 0; slot < slots; slot++) {
      orderIcons.push({
        order: i,
        slot,
        rect: { x: x0 + slot * (size + gap), y, w: size, h: size },
      })
    }
  }
  const boardArt = place({ x: BOARD_X, y: BOARD_Y, w: 1071, h: 1370 })
  const first = designCell(0, 0)
  const info = place({ x: 178, y: 2126, w: 723, h: 148 })
  const unit = Math.max(0.72, input.w / 390)
  const sellW = Math.round(54 * unit)
  const rushW = input.showRush ? Math.round(58 * unit) : 0
  const adW = input.showRush ? Math.round(44 * unit) : 0
  const rushBtn: Box = rushW > 0
    ? { x: info.x + info.w - rushW - adW - 10, y: info.y + info.h * 0.18, w: rushW, h: info.h * 0.64 }
    : { x: 0, y: 0, w: 0, h: 0 }
  const adBtn: Box = rushBtn.w > 0
    ? { x: rushBtn.x + rushBtn.w + 4, y: rushBtn.y, w: adW, h: rushBtn.h }
    : { x: 0, y: 0, w: 0, h: 0 }
  const sellBtn: Box = rushW === 0
    ? { x: info.x + info.w - sellW - 8, y: info.y + info.h * 0.16, w: sellW, h: info.h * 0.68 }
    : { x: 0, y: 0, w: 0, h: 0 }
  const chainBtn: Box = {
    x: (sellBtn.w > 0 ? sellBtn.x : rushBtn.w > 0 ? rushBtn.x : info.x + info.w) - Math.round(28 * unit),
    y: info.y + info.h * 0.22,
    w: Math.round(24 * unit),
    h: Math.round(24 * unit),
  }
  const build = place({ x: 912, y: 2112, w: 153, h: 163 })
  const dockTop = build.y
  const storyOn = input.showStory !== false
  const taskOn = input.showTask !== false
  const chestOn = input.showChest !== false
  // 只剩宝箱时收到绿书的位置，避免书藏起来后宝箱悬在半空。
  const chestDesign = chestOn ? (storyOn ? CHEST_BTN : STORY_BTN) : null
  const storyBtn = storyOn ? place(STORY_BTN, scroll) : ZERO_BOX
  const taskBtn = taskOn ? place(TASK_BTN, scroll) : ZERO_BOX
  const chestBtn = chestDesign ? place(chestDesign, scroll) : ZERO_BOX
  const orderClip = place({ x: 0, y: 300, w: DESIGN_W, h: 420 })
  const avatarSlot = place({ x: 29, y: 150, w: 149, h: 149 })
  const taskIcon = childOf(taskBtn, TASK_BTN, TASK_ICON)
  const bookIcon = childOf(storyBtn, STORY_BTN, BOOK_ICON)
  const chestIcon = childOf(chestBtn, CHEST_BTN, CHEST_ICON)
  const badgeStory = childOf(storyBtn, STORY_BTN, BADGE_STORY)
  const badgeChest = childOf(chestBtn, CHEST_BTN, BADGE_CHEST)
  const badgeTask = childOf(taskBtn, TASK_BTN, BADGE_TASK)
  return {
    scale,
    top: sceneTop,
    orderClip,
    orders,
    completes,
    orderPlates,
    orderRewards,
    orderGuests,
    orderIcons,
    orderMaxScroll,
    board: { x: boardArt.x, y: boardArt.y, cell: (first?.w ?? 139) * scale },
    rewardTray: chestBtn,
    dock: { x: 0, y: dockTop, w: input.w, h: Math.max(0, availBottom - dockTop) },
    pendingBtn: place({ x: 14, y: 2113, w: 143, h: 160 }),
    houseBtn: build,
    infoBar: info,
    avatarSlot,
    energySlot: place({ x: 178, y: 169, w: 204, h: 71 }),
    coinSlot: place({ x: 397, y: 169, w: 202, h: 71 }),
    gemSlot: place({ x: 613, y: 168, w: 206, h: 72 }),
    smileSlot: place({ x: 717, y: 260, w: 86, h: 86 }),
    multBtn: place({ x: 827, y: 265, w: 80, h: 78 }),
    shopBtn: place({ x: 918, y: 247, w: 124, h: 107 }),
    sellBtn,
    chainBtn,
    rushBtn,
    adBtn,
    energyPlus: place({ x: 342, y: 169, w: 40, h: 71 }),
    chestBtn,
    storyBtn,
    taskBtn,
    hud: place({ x: 0, y: 140, w: DESIGN_W, h: 220 }),
    counter: place({ x: 0, y: 598, w: DESIGN_W, h: 324 }, scroll),
    boardArt,
    taskIcon,
    bookIcon,
    chestIcon,
    badgeStory,
    badgeChest,
    badgeTask,
    badgeShop: place({ x: 1020, y: 246, w: 38, h: 38 }),
  }
}
