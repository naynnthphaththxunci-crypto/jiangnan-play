import { designToScreen, type Box } from './hechengLayout'
import type { GameConfig, GameState, Item } from './types'
import { lineCap, lineSeen, producerCap, productName } from './logic/sim'
import { producerPieceName } from './itemArt'

export interface ChainFocus {
  line: string
  level: number
  source: 'order' | 'producer'
  producerId?: string
}

export interface ChainPiece {
  kind: 'product' | 'producer'
  line: string
  producerId?: string
  level: number
}

interface DesignFrame {
  w: number
  board: { x: number; y: number; cell: number }
  dock: { y: number }
}

export interface ChainCell {
  piece: ChainPiece
  rect: Box
  select: Box
  badge: Box
  current: boolean
  seen: boolean
  count: number
}

export interface ChainSlot {
  piece: ChainPiece
  rect: Box
  badge: Box
  seen: boolean
  count: number
}

export interface ChainPopup {
  card: Box
  title: Box
  titleText: string
  close: Box
  cells: ChainCell[]
  rule: Box
  ruleLabel: string
  tray: Box
  /** 子棋页底部的母棋。点它跳到母棋弹窗。 */
  source: (ChainSlot & { info: Box; producerId: string; level: number }) | null
  /** 母棋页「可产出」。只展示。 */
  now: ChainSlot[]
  /** 母棋页「升级后额外产出」。只展示。 */
  later: ChainSlot[]
  laterRule: Box
  laterLabel: string
}

const CELL = { x: 193, y: 787, w: 155, h: 139 }
const PITCH_X = 185
const PITCH_Y = 181
const SELECT = { dx: -6, dy: -7, w: 162, h: 153 }
const BADGE = { dx: 104, dy: -12, w: 51, h: 44 }
const TITLE = { x: 208, y: 609, w: 664, h: 128 }
const CLOSE = { x: 938, y: 534, w: 114, h: 115 }
const RULE = { x: 213, w: 656, h: 14 }
const TRAY = { x: 181, w: 718, h: 236 }
const SLOT = { w: 160, h: 160 }
const INFO = { w: 47, h: 48 }

/** 短线底图裁掉了弹窗外的残留色块，原点跟着下移。 */
const CARD_SHORT = { x: 118, y: 627, w: 845, h: 918 }
const CARD_LONG = { x: 118, y: 625, w: 845, h: 1102 }
const CARD_MAKER = { x: 118, y: 625, w: 845, h: 1334 }

function box(x: number, y: number, w: number, h: number): Box {
  return { x, y, w, h }
}

function screen(frame: DesignFrame, design: Box): Box {
  return designToScreen(frame, design)
}

export function chainMaker(cfg: GameConfig, line: string): { id: string; from: number } | null {
  const side = cfg.producers.find((entry) => entry.side === line)
  if (side) return { id: side.id, from: side.sideFrom ?? side.produceFrom ?? 1 }
  const makers = cfg.producers.filter((entry) => entry.line === line)
  const direct =
    makers.find((entry) => entry.kind !== 'netSource' && entry.kind !== 'consumable' && entry.produceFrom != null) ??
    makers.find((entry) => entry.kind === 'consumable') ??
    makers[0]
  if (!direct) return null
  return { id: direct.id, from: direct.produceFrom ?? 1 }
}

export function boardCount(state: GameState, piece: ChainPiece): number {
  let count = 0
  for (const row of state.board) {
    for (const item of row) {
      if (!item) continue
      if (samePiece(item, piece)) count += 1
    }
  }
  return count
}

function samePiece(item: Item, piece: ChainPiece): boolean {
  if (piece.kind === 'product') return item.kind === 'product' && item.line === piece.line && item.level === piece.level
  return item.kind === 'producer' && item.producerId === piece.producerId && item.level === piece.level
}

function pieceSeen(state: GameState, piece: ChainPiece): boolean {
  if (piece.kind === 'product') return lineSeen(state, piece.line, piece.level)
  return (state.producerSeen?.[piece.producerId ?? ''] ?? []).includes(piece.level)
}

function slotRow(count: number, y: number): Box[] {
  const gap = count <= 2 ? 97 : 16
  const maxW = 740
  let w = SLOT.w
  if (count > 1 && count * w + (count - 1) * gap > maxW) {
    w = Math.max(108, Math.floor((maxW - (count - 1) * gap) / count))
  }
  const h = SLOT.h * (w / SLOT.w)
  const total = count * w + Math.max(0, count - 1) * gap
  const start = 540 - total / 2
  return Array.from({ length: count }, (_, index) => box(start + index * (w + gap), y, w, h))
}

interface OutputGroups {
  now: ChainPiece[]
  later: ChainPiece[]
}

/** 这一级母棋正在出的，和更高等级才会多出来的。 */
export function producerOutputs(cfg: GameConfig, producerId: string, level: number): OutputGroups {
  const def = cfg.producers.find((entry) => entry.id === producerId)
  if (!def) return { now: [], later: [] }
  if (def.kind === 'plant' || producerId === 'dog' || producerId === 'plant') {
    return { now: [{ kind: 'product', line: def.line, level: 1 }], later: [] }
  }
  if (producerId === 'basket') {
    return {
      now: [
        { kind: 'product', line: 'food', level: 2 },
        { kind: 'product', line: 'food', level: 3 },
      ],
      later: [],
    }
  }
  if (producerId === 'piggy') {
    return { now: [{ kind: 'product', line: 'coin', level: 1 }], later: [] }
  }
  const rows = def.drops ?? []
  const current = rows.find((row) => row.level === level) ?? null
  const higher = rows.filter((row) => row.level > level)
  const catalog: { on: (row: (typeof rows)[number], at: number) => boolean; piece: ChainPiece }[] = []
  if (rows.some((row) => row.catch1 != null || row.catch2 != null || row.catch3 != null)) {
    catalog.push(
      { on: (row) => (row.catch1 ?? 0) > 0, piece: { kind: 'producer', producerId: 'net', line: 'fish', level: 1 } },
      { on: (row) => (row.catch2 ?? 0) > 0, piece: { kind: 'producer', producerId: 'net', line: 'fish', level: 2 } },
      { on: (row) => (row.catch3 ?? 0) > 0, piece: { kind: 'producer', producerId: 'net', line: 'fish', level: 3 } },
    )
  } else {
    catalog.push(
      { on: (row) => row.e1 > 0, piece: { kind: 'product', line: def.line, level: 1 } },
      { on: (row) => row.e2 > 0, piece: { kind: 'product', line: def.line, level: 2 } },
      { on: (row) => row.e3 > 0, piece: { kind: 'product', line: def.line, level: 3 } },
      { on: (row) => row.rare > 0, piece: { kind: 'product', line: def.line, level: 4 } },
    )
    if (def.side) {
      const from = def.sideFrom ?? 99
      catalog.push({
        on: (row, at) => at >= from && row.hard > 0,
        piece: { kind: 'product', line: def.side, level: 1 },
      })
    }
  }
  if (producerId === 'net') {
    return {
      now: [
        { kind: 'product', line: 'fish', level: 1 },
        { kind: 'product', line: 'fish', level: 2 },
      ],
      later: [],
    }
  }
  const now: ChainPiece[] = []
  const later: ChainPiece[] = []
  for (const entry of catalog) {
    const active = current ? entry.on(current, level) : false
    const upcoming = higher.some((row) => entry.on(row, row.level))
    if (active) now.push(entry.piece)
    else if (upcoming) later.push(entry.piece)
  }
  return { now, later }
}

function cellAt(index: number): Box {
  const col = index % 4
  const row = Math.floor(index / 4)
  return box(CELL.x + col * PITCH_X, CELL.y + row * PITCH_Y, CELL.w, CELL.h)
}

function asCell(frame: DesignFrame, state: GameState, piece: ChainPiece, index: number, current: boolean): ChainCell {
  const design = cellAt(index)
  const rect = screen(frame, design)
  return {
    piece,
    rect,
    select: screen(frame, box(design.x + SELECT.dx, design.y + SELECT.dy, SELECT.w, SELECT.h)),
    badge: screen(frame, box(design.x + BADGE.dx, design.y + BADGE.dy, BADGE.w, BADGE.h)),
    current,
    seen: pieceSeen(state, piece),
    count: boardCount(state, piece),
  }
}

function asSlot(frame: DesignFrame, state: GameState, piece: ChainPiece, design: Box): ChainSlot {
  return {
    piece,
    rect: screen(frame, design),
    badge: screen(frame, box(design.x + design.w - 36, design.y - 8, BADGE.w, BADGE.h)),
    seen: pieceSeen(state, piece),
    count: boardCount(state, piece),
  }
}

export function chainTitle(cfg: GameConfig, focus: ChainFocus): string {
  if (focus.source === 'producer' && focus.producerId) {
    return producerPieceName(focus.producerId, focus.level) ?? cfg.producers.find((entry) => entry.id === focus.producerId)?.name ?? '母棋'
  }
  return productName(cfg, focus.line, focus.level) || '棋子'
}

export function layoutChainPopup(frame: DesignFrame, cfg: GameConfig, state: GameState, focus: ChainFocus): ChainPopup {
  const maker = focus.source === 'producer'
  const levels = maker ? producerCap(cfg, focus.producerId ?? focus.line) : lineCap(cfg, focus.line)
  const long = !maker && levels > 8
  const rows = Math.max(1, Math.ceil(levels / 4))
  const extra = maker ? 0 : long ? Math.max(0, rows - 3) * PITCH_Y : 0
  const cardDesign = maker ? CARD_MAKER : long ? { ...CARD_LONG, h: CARD_LONG.h + extra } : CARD_SHORT
  const pieces: ChainPiece[] = maker
    ? Array.from({ length: levels }, (_, index) => ({
        kind: 'producer' as const,
        producerId: focus.producerId,
        line: focus.line,
        level: index + 1,
      }))
    : Array.from({ length: levels }, (_, index) => ({
        kind: 'product' as const,
        line: focus.line,
        level: index + 1,
      }))
  const cells = pieces.map((piece, index) => asCell(frame, state, piece, index, piece.level === focus.level))
  const ruleY = (long ? 1350 : 1182) + (long ? extra : 0)
  const trayY = (long ? 1414 : 1247) + (long ? extra : 0)
  const slotY = (long ? 1452 : 1285) + (long ? extra : 0)
  const infoY = (long ? 1448 : 1281) + (long ? extra : 0)
  const usedRuleY = maker ? 1350 : ruleY
  const outputs = maker && focus.producerId ? producerOutputs(cfg, focus.producerId, focus.level) : { now: [], later: [] }
  const nowRects = slotRow(Math.max(1, outputs.now.length), 1406)
  const laterRects = slotRow(Math.max(1, outputs.later.length), 1701)
  const makerOf = !maker ? chainMaker(cfg, focus.line) : null
  const sourcePiece: ChainPiece | null = makerOf
    ? { kind: 'producer', producerId: makerOf.id, line: focus.line, level: makerOf.from }
    : null
  const sourceRect = box(460, slotY, SLOT.w, SLOT.h)
  return {
    card: screen(frame, cardDesign),
    title: screen(frame, TITLE),
    titleText: chainTitle(cfg, focus),
    close: screen(frame, CLOSE),
    cells,
    rule: screen(frame, box(RULE.x, maker ? 1350 : usedRuleY, RULE.w, RULE.h)),
    ruleLabel: maker ? '可产出' : '产自',
    tray: screen(frame, box(TRAY.x, maker ? 1414 : trayY, TRAY.w, TRAY.h)),
    source:
      sourcePiece && makerOf
        ? {
            ...asSlot(frame, state, sourcePiece, sourceRect),
            info: screen(frame, box(580, infoY, INFO.w, INFO.h)),
            producerId: makerOf.id,
            level: makerOf.from,
          }
        : null,
    now: maker ? outputs.now.map((piece, index) => asSlot(frame, state, piece, nowRects[index] ?? nowRects[0]!)) : [],
    later: maker ? outputs.later.map((piece, index) => asSlot(frame, state, piece, laterRects[index] ?? laterRects[0]!)) : [],
    laterRule: screen(frame, box(269, 1629, 542, 12)),
    laterLabel: '升级后额外产出',
  }
}

export type ChainPopupHit = 'close' | 'outside' | 'source' | 'swallow'

export function hitChainPopup(popup: ChainPopup, x: number, y: number): ChainPopupHit {
  if (contains(popup.close, x, y)) return 'close'
  if (popup.source && (contains(popup.source.rect, x, y) || contains(popup.source.info, x, y))) return 'source'
  if (contains(popup.card, x, y) || contains(popup.title, x, y)) return 'swallow'
  return 'outside'
}

function contains(rect: Box, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
}
