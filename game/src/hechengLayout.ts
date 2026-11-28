export const DESIGN_W = 1080
export const DESIGN_H = 2340
/** 苹果 16 稿。大图背景相对这块画面的偏移是 (234, 935)。 */
export const BIG_ANCHOR = { x: 234, y: 935 }
export const BG_BOX = { x: -234, y: -935, w: 1608, h: 2889 }
export const DESK_BOX = { x: -287, y: 653, w: 1661, h: 1687 }
export const COUNTER_TABLE = { x: -153, y: 609, w: 1430, h: 115 }

/** 稿里棋盘外框 13,690–1068,2038。格子缩在圆角框里面。 */
export const BOARD_FRAME = { x: 13, y: 690, w: 1055, h: 1348 }
const FRAME_INSET = 16
export const MERGE_BOARD = {
  x: BOARD_FRAME.x + FRAME_INSET,
  y: BOARD_FRAME.y + FRAME_INSET,
  w: BOARD_FRAME.w - FRAME_INSET * 2,
  h: BOARD_FRAME.h - FRAME_INSET * 2,
}
export const BOARD_X = MERGE_BOARD.x
export const BOARD_Y = MERGE_BOARD.y
const CELL_W = MERGE_BOARD.w / 7
const CELL_H = MERGE_BOARD.h / 9

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

const PITCH = 345

/** 第一张小桌子的设计横坐标。原来第一位在画面中间，现在改到柜台最左边。 */
const ORDER_LEFT = 28
const ORDER_SHIFT = 354 - ORDER_LEFT

/** 客人原画是 1024 的整张画布，按这个比例缩到 1080 宽的设计稿上。 */
export const GUEST_CANVAS = 1024
export const GUEST_SCALE = 0.29

/** 画布左上角。顶部对齐在 y≈305，水平落在各自托盘中间。 */
const GUEST_ANCHOR: { x: number; y: number }[] = [
  { x: 338, y: 320 },
  { x: 632, y: 316 },
  { x: 975, y: 316 },
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
  /** 右上角胶囊，屏幕坐标。顶部一排要躲开会。 */
  capsule?: { x: number; y: number; w: number; h: number } | null
  orderCount: number
  orderSlots: number[]
  /** 这一单已经凑齐，才给出完成按钮。 */
  orderReady?: boolean[]
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
  /** 柜台上固定的小桌子，不随订单滑动。 */
  tableSlots: Box[]
  orderPitch: number
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
  gemPlus: Box
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

/** 整张 1024 画布的设计坐标。默认比例下左上角就是锚点；改比例时绕画布中心缩放。 */
export function guestCanvasBox(index: number, guestScale = GUEST_SCALE, dx = 0): Box {
  const raw = index < GUEST_ANCHOR.length
    ? GUEST_ANCHOR[index]!
    : { x: GUEST_ANCHOR[2]!.x + (index - 2) * PITCH, y: GUEST_ANCHOR[2]!.y }
  const anchor = { x: raw.x - ORDER_SHIFT + dx, y: raw.y }
  const nominal = GUEST_CANVAS * GUEST_SCALE
  const size = GUEST_CANVAS * guestScale
  return { x: anchor.x + nominal / 2 - size / 2, y: anchor.y, w: size, h: size }
}

/** 7×9 格子铺满稿里的棋盘。 */
export function designCell(row: number, col: number): Box | null {
  if (row < 0 || col < 0 || row >= 9 || col >= 7) return null
  return {
    x: MERGE_BOARD.x + col * CELL_W,
    y: MERGE_BOARD.y + row * CELL_H,
    w: CELL_W,
    h: CELL_H,
  }
}

export function contentScale(board: { cell: number }): number {
  return CELL_H > 0 && board.cell > 0 ? board.cell / CELL_H : 1
}

/** 第 index 张托盘。一屏三位，间距 345。 */
export function orderPlateDesign(index: number): Box {
  return { x: 36 + index * PITCH, y: 558, w: 281, h: 80 }
}

const ITEM_PATTERNS: { shadow: Box; item: Box }[][] = [
  [{ shadow: { x: 88, y: 15, w: 101, h: 51 }, item: { x: 93, y: -29, w: 88, h: 83 } }],
  [
    { shadow: { x: 39, y: 15, w: 101, h: 51 }, item: { x: 47, y: -2, w: 82, h: 55 } },
    { shadow: { x: 151, y: 15, w: 101, h: 51 }, item: { x: 165, y: -20, w: 73, h: 75 } },
  ],
  [
    { shadow: { x: 6, y: 15, w: 101, h: 51 }, item: { x: 22, y: -57, w: 82, h: 111 } },
    { shadow: { x: 92, y: 15, w: 101, h: 51 }, item: { x: 104, y: -20, w: 77, h: 72 } },
    { shadow: { x: 176, y: 15, w: 101, h: 51 }, item: { x: 185, y: -23, w: 83, h: 75 } },
  ],
]

export function orderItemDesign(count: number, slot: number): { shadow: Box; item: Box } {
  const pattern = ITEM_PATTERNS[Math.min(3, Math.max(1, count)) - 1] ?? ITEM_PATTERNS[0]!
  return pattern[Math.min(slot, pattern.length - 1)] ?? pattern[0]!
}

export function designToScreen(
  frame: { w: number; board: { x: number; y: number; cell: number }; dock: { y: number } },
  box: Box,
  anchor: 'top' | 'bottom' = 'top',
): Box {
  const scale = contentScale(frame.board)
  const originX = frame.board.x - BOARD_X * scale
  const top = frame.board.y - BOARD_Y * scale
  const extra = frame.dock.y - (top + 2112 * scale)
  return {
    x: originX + box.x * scale,
    y: top + box.y * scale + (anchor === 'bottom' ? extra : 0),
    w: box.w * scale,
    h: box.h * scale,
  }
}

function cellSpec(row: number, col: number): Box {
  return designCell(row, col) ?? { x: BOARD_X + 43 + col * 141, y: BOARD_Y + 42 + row * 143, w: 139, h: 140 }
}

export function cellOnBoard(board: { x: number; y: number }, scale: number, row: number, col: number): Box {
  return cellWoodRect(board, scale, row, col)
}

/** 木格的整格，给遮罩挖孔。棋子仍放在格子里居中的正方形上。 */
export function cellWoodRect(board: { x: number; y: number }, scale: number, row: number, col: number): Box {
  const spec = cellSpec(row, col)
  return {
    x: board.x + (spec.x - BOARD_X) * scale,
    y: board.y + (spec.y - BOARD_Y) * scale,
    w: spec.w * scale,
    h: spec.h * scale,
  }
}

export function hechengParts(input: HechengInput): HechengScene {
  const availBottom = input.h - Math.max(0, input.insetBottom)
  // 竖屏按宽度缩放。比稿矮时只上推客人、柜台、棋盘和底栏，压掉顶栏和客人之间的背景。
  // 顶到顶栏还放不下，才把整页缩小。横屏保持手机宽的一列，两侧留给大图。
  const screenH = Math.max(1, availBottom)
  const widthScale = input.w / DESIGN_W
  const guestTop = 312
  const barBottom = 2252
  const hudClear = input.insetTop > 20 ? 276 : 168
  const maxLift = Math.max(0, guestTop - hudClear - 6)
  const portrait = input.h + 8 >= input.w
  let scale = widthScale
  let bodyShift = 0
  if (portrait) {
    const needLift = barBottom - screenH / widthScale
    if (needLift > 0) {
      if (needLift <= maxLift) bodyShift = -needLift
      else {
        bodyShift = -maxLift
        scale = Math.min(widthScale, screenH / (barBottom + bodyShift))
      }
    }
  } else {
    const packed = barBottom - maxLift
    scale = Math.min(widthScale, screenH / packed)
    const needLift = Math.max(0, barBottom - screenH / scale)
    bodyShift = -Math.min(maxLift, needLift)
  }
  const offsetX = (input.w - DESIGN_W * scale) / 2
  const sceneTop = Math.max(0, screenH - DESIGN_H * scale)
  const placeAt = (box: Box, scroll = 0, yShift = 0): Box => ({
    x: offsetX + box.x * scale - scroll,
    y: sceneTop + (box.y + yShift) * scale,
    w: box.w * scale,
    h: box.h * scale,
  })
  const place = (box: Box, scroll = 0) => placeAt(box, scroll, 0)
  const placeBody = (box: Box, scroll = 0) => placeAt(box, scroll, bodyShift)
  // 有刘海时沿用苹果 16 稿（已经放低）。没有刘海时整排往上贴顶，但要停在胶囊下面。
  let hudDy = input.insetTop > 20 ? 0 : -(130 - 16)
  const capsule = input.capsule
  if (capsule && capsule.h > 0) {
    const shopTop = sceneTop + (239 + hudDy) * scale
    const limit = capsule.y + capsule.h + 8
    if (shopTop < limit) hudDy += (limit - shopTop) / scale
  }
  const placeHud = (box: Box): Box => place({ ...box, y: box.y + hudDy })
  const n = Math.max(0, input.orderCount)
  const chestOn = input.showChest !== false
  const pitchPx = PITCH * scale
  const lastPlate = n > 0 ? orderPlateDesign(n - 1) : orderPlateDesign(0)
  const lastRight = lastPlate.x + 217 + 113
  const orderMaxScroll = Math.max(0, lastRight * scale - DESIGN_W * scale)
  const scroll = input.orderScroll
  const tableSlots: Box[] = []
  for (let i = 0; i < n; i++) tableSlots.push(placeBody(orderPlateDesign(i), scroll))
  const orders: Box[] = []
  const completes: Box[] = []
  const orderPlates: Box[] = []
  const orderRewards: Box[] = []
  const orderGuests: Box[] = []
  const orderIcons: { order: number; slot: number; rect: Box }[] = []
  for (let i = 0; i < n; i++) {
    const design = orderPlateDesign(i)
    const plate = placeBody(design, scroll)
    const guest = placeBody({ x: design.x, y: design.y - 270, w: design.w, h: 270 }, scroll)
    const reward = placeBody({ x: design.x + 217, y: design.y - 113, w: 113, h: 56 }, scroll)
    const doneH = design.w * (220 / 640)
    const done = placeBody({ x: design.x, y: design.y + design.h - 6, w: design.w, h: doneH }, scroll)
    orders.push(plate)
    orderPlates.push(plate)
    orderGuests.push(guest)
    orderRewards.push(reward)
    completes.push(input.orderReady?.[i] ? done : ZERO_BOX)
    const slots = Math.max(1, input.orderSlots[i] ?? 1)
    for (let slot = 0; slot < slots; slot++) {
      const spec = orderItemDesign(slots, slot).item
      orderIcons.push({
        order: i,
        slot,
        rect: placeBody({ x: design.x + spec.x, y: design.y + spec.y, w: spec.w, h: spec.h }, scroll),
      })
    }
  }
  const boardArt = placeBody(MERGE_BOARD)
  const info = placeBody({ x: 188, y: 2089, w: 705, h: 166 })
  const unit = Math.max(0.72, input.w / 390)
  const sellW = Math.round(54 * unit)
  const kInfo = info.w / 705
  const chainBtn: Box = {
    x: info.x + info.w - 58 * kInfo,
    y: info.y + 8 * kInfo,
    w: 47 * kInfo,
    h: 48 * kInfo,
  }
  const rushW = input.showRush ? Math.round(58 * unit) : 0
  const adW = input.showRush ? Math.round(44 * unit) : 0
  const rushBtn: Box = rushW > 0
    ? { x: chainBtn.x - rushW - adW - 12, y: info.y + info.h * 0.18, w: rushW, h: info.h * 0.64 }
    : { x: 0, y: 0, w: 0, h: 0 }
  const adBtn: Box = rushBtn.w > 0
    ? { x: rushBtn.x + rushBtn.w + 4, y: rushBtn.y, w: adW, h: rushBtn.h }
    : { x: 0, y: 0, w: 0, h: 0 }
  const sellBtn: Box = rushW === 0
    ? { x: chainBtn.x - sellW - 8, y: info.y + info.h * 0.18, w: sellW, h: info.h * 0.64 }
    : { x: 0, y: 0, w: 0, h: 0 }
  const build = placeBody({ x: 914, y: 2092, w: 154, h: 159 })
  const stash = placeBody({ x: 13, y: 2099, w: 157, h: 145 })
  const dockTop = Math.min(build.y, stash.y, info.y)
  const storyBtn = ZERO_BOX
  const taskBtn = ZERO_BOX
  const chestBtn = chestOn ? stash : ZERO_BOX
  const orderClip = placeBody({ x: 0, y: 250, w: DESIGN_W, h: 520 })
  const avatarSlot = placeHud({ x: 45, y: 139, w: 137, h: 137 })
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
    tableSlots,
    orderPitch: pitchPx,
    orderRewards,
    orderGuests,
    orderIcons,
    orderMaxScroll,
    board: { x: boardArt.x, y: boardArt.y, cell: (MERGE_BOARD.h / 9) * scale },
    rewardTray: chestBtn,
    dock: { x: 0, y: dockTop, w: input.w, h: Math.max(0, availBottom - dockTop) },
    pendingBtn: stash,
    houseBtn: build,
    infoBar: info,
    avatarSlot,
    energySlot: placeHud({ x: 234, y: 179, w: 157, h: 56 }),
    coinSlot: placeHud({ x: 454, y: 179, w: 169, h: 56 }),
    gemSlot: placeHud({ x: 661, y: 179, w: 185, h: 56 }),
    smileSlot: avatarSlot,
    multBtn: placeHud({ x: 865, y: 236, w: 83, h: 78 }),
    shopBtn: placeHud({ x: 972, y: 239, w: 73, h: 73 }),
    sellBtn,
    chainBtn,
    rushBtn,
    adBtn,
    energyPlus: placeHud({ x: 244, y: 207, w: 44, h: 44 }),
    chestBtn,
    storyBtn,
    taskBtn,
    hud: placeHud({ x: 0, y: 130, w: DESIGN_W, h: 190 }),
    gemPlus: placeHud({ x: 699, y: 207, w: 44, h: 44 }),
    counter: placeBody(COUNTER_TABLE),
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
