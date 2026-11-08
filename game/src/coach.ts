import { cellCenter, type Frame } from './layout'
import { currentTutorial, lockAt, type HintAction } from './logic/sim'
import type { GameConfig, GameState } from './types'

export const HAND_MS = 1500

export interface HandPose {
  x: number
  y: number
  visible: boolean
}

function ease(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
}

export function gesturePose(
  now: number,
  ax: number,
  ay: number,
  bx: number | null,
  by: number | null,
  gesture: 'tap' | 'drag',
): HandPose {
  const t = (now % HAND_MS) / HAND_MS
  if (gesture === 'tap' || bx == null || by == null) {
    const press = Math.sin(t * Math.PI * 2)
    return { x: ax, y: ay + (press < 0 ? press * 8 : 0), visible: true }
  }
  if (t > 0.86) return { x: ax, y: ay, visible: false }
  const u = t < 0.14 ? 0 : t > 0.72 ? 1 : (t - 0.14) / 0.58
  const e = ease(u)
  return { x: ax + (bx - ax) * e, y: ay + (by - ay) * e, visible: true }
}

function mid(rect: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
}

function foodAt(state: GameState, level: number): { row: number; col: number } | null {
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      const item = state.board[row]?.[col]
      if (item?.kind === 'producer' && item.producerId === 'food' && item.level >= level && !lockAt(state, row, col)) {
        return { row, col }
      }
    }
  }
  return null
}

function foodPair(state: GameState, level: number): [{ row: number; col: number }, { row: number; col: number }] | null {
  const found: { row: number; col: number }[] = []
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      const item = state.board[row]?.[col]
      if (item?.kind === 'producer' && item.producerId === 'food' && item.level === level && !lockAt(state, row, col)) {
        found.push({ row, col })
      }
    }
  }
  if (found.length < 2 || !found[0] || !found[1]) return null
  return [found[0], found[1]]
}

function firstProduct(state: GameState, frame: Frame): { x: number; y: number } | null {
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      const item = state.board[row]?.[col]
      if (item?.kind === 'product' && item.tag !== 'bag' && !lockAt(state, row, col)) return cellCenter(frame, row, col)
    }
  }
  return null
}

function emptySpot(state: GameState, frame: Frame): { x: number; y: number } | null {
  const prefer = [
    { row: 4, col: 4 },
    { row: 5, col: 3 },
    { row: 3, col: 2 },
  ]
  for (const pos of prefer) {
    if (!state.board[pos.row]?.[pos.col] && !lockAt(state, pos.row, pos.col)) return cellCenter(frame, pos.row, pos.col)
  }
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      if (!state.board[row]?.[col] && !lockAt(state, row, col)) return cellCenter(frame, row, col)
    }
  }
  return null
}

export function tutorialHand(cfg: GameConfig, state: GameState, frame: Frame, now: number): HandPose | null {
  const step = currentTutorial(cfg, state)
  if (!step || step.gesture === 'none') return null
  let ax = 0
  let ay = 0
  let bx: number | null = null
  let by: number | null = null
  if (step.id === 'enter' && frame.enterBtn.w > 0) {
    const p = mid(frame.enterBtn)
    ax = p.x
    ay = p.y
  } else if (step.id === 'merge') {
    const a = cellCenter(frame, cfg.board.roles.mergeA.row, cfg.board.roles.mergeA.col)
    const b = cellCenter(frame, cfg.board.roles.mergeB.row, cfg.board.roles.mergeB.col)
    ax = a.x
    ay = a.y
    bx = b.x
    by = b.y
  } else if (step.id === 'unlock') {
    let from = cellCenter(frame, cfg.board.roles.mergeB.row, cfg.board.roles.mergeB.col)
    for (let row = 0; row < state.board.length; row++) {
      for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'product' && item.line === 'food' && item.level === 2) from = cellCenter(frame, row, col)
      }
    }
    const to = cellCenter(frame, cfg.board.roles.unlock.row, cfg.board.roles.unlock.col)
    ax = from.x
    ay = from.y
    bx = to.x
    by = to.y
  } else if (step.id === 'producerL2' || step.id === 'producerL3') {
    const want = step.id === 'producerL3' ? 2 : 1
    const pair = foodPair(state, want) ?? foodPair(state, 1)
    if (!pair) return null
    const a = cellCenter(frame, pair[0].row, pair[0].col)
    const b = cellCenter(frame, pair[1].row, pair[1].col)
    ax = a.x
    ay = a.y
    bx = b.x
    by = b.y
  } else if (step.id === 'produce') {
    const ready = foodAt(state, 3)
    const p = ready
      ? cellCenter(frame, ready.row, ready.col)
      : cellCenter(frame, cfg.board.roles.producer.row, cfg.board.roles.producer.col)
    ax = p.x
    ay = p.y
  } else if (step.id === 'deliver' && frame.completes[0]) {
    const p = mid(frame.completes[0])
    ax = p.x
    ay = p.y
  } else if (step.id === 'stashIn' && frame.pendingBtn.w > 0) {
    const from = firstProduct(state, frame)
    const to = mid(frame.pendingBtn)
    if (!from) return null
    ax = from.x
    ay = from.y
    bx = to.x
    by = to.y
  } else if (step.id === 'stashOut' && frame.pendingBtn.w > 0) {
    const from = mid(frame.pendingBtn)
    const to = emptySpot(state, frame)
    if (!to) return null
    ax = from.x
    ay = from.y
    bx = to.x
    by = to.y
  } else if (step.id === 'bagMerge') {
    const bags: { x: number; y: number }[] = []
    for (let row = 0; row < state.board.length; row++) {
      for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'product' && item.tag === 'bag') bags.push(cellCenter(frame, row, col))
      }
    }
    if (bags.length < 2 || !bags[0] || !bags[1]) return null
    ax = bags[0].x
    ay = bags[0].y
    bx = bags[1].x
    by = bags[1].y
  } else if (step.id === 'giftTap' || step.id === 'giftRush') {
    const p = cellCenter(frame, cfg.board.roles.gift.row, cfg.board.roles.gift.col)
    ax = p.x
    ay = p.y
  } else if (step.id === 'build' && frame.houseBtn.w > 0) {
    const p = mid(frame.houseBtn)
    ax = p.x
    ay = p.y
  } else return null
  return gesturePose(now, ax, ay, bx, by, step.gesture === 'drag' ? 'drag' : 'tap')
}

export function storageLessonHand(state: GameState, frame: Frame, now: number): HandPose | null {
  if (state.storageLesson === 2 && frame.pendingBtn.w > 0) {
    const from = firstProduct(state, frame) ?? cellCenter(frame, 3, 2)
    const to = mid(frame.pendingBtn)
    return gesturePose(now, from.x, from.y, to.x, to.y, 'drag')
  }
  if (state.storageLesson === 3 && frame.pendingBtn.w > 0) {
    const from = mid(frame.pendingBtn)
    const to = emptySpot(state, frame)
    if (!to) return null
    return gesturePose(now, from.x, from.y, to.x, to.y, 'drag')
  }
  return null
}

export function hintHand(hint: HintAction, frame: Frame, now: number): HandPose | null {
  if (hint.type === 'complete') {
    const rect = frame.completes[hint.index]
    if (!rect || rect.w <= 0) return null
    const p = mid(rect)
    return gesturePose(now, p.x, p.y, null, null, 'tap')
  }
  if (hint.type === 'produce') {
    const p = cellCenter(frame, hint.row, hint.col)
    return gesturePose(now, p.x, p.y, null, null, 'tap')
  }
  const from = cellCenter(frame, hint.from.row, hint.from.col)
  const to = cellCenter(frame, hint.to.row, hint.to.col)
  return gesturePose(now, from.x, from.y, to.x, to.y, 'drag')
}
