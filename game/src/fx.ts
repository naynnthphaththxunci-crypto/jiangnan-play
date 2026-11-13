import type { Item, OrderSlot, Pos } from './types'

export interface Flyer {
  item: Item
  fromX: number
  fromY: number
  toX: number
  toY: number
  birth: number
  dur: number
  hide: Pos[]
  ease: 'snap' | 'spawn'
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  birth: number
  life: number
  color: string
  r: number
}

export interface CoinFx {
  fromX: number
  fromY: number
  toX: number
  toY: number
  birth: number
  dur: number
  delay: number
  value: number
  bend: number
  done?: boolean
}

export interface Floater {
  text: string
  x: number
  y: number
  birth: number
  dur: number
  color: string
}

export interface Toast {
  text: string
  birth: number
  dur: number
}

export interface Pop {
  row: number
  col: number
  birth: number
  dur: number
}

export type Hover =
  | { kind: 'cell'; row: number; col: number; merge: boolean }
  | { kind: 'order'; index: number }
  | null

export interface Fx {
  flyers: Flyer[]
  particles: Particle[]
  coins: CoinFx[]
  incoming: number
  coinPunch: number
  floaters: Floater[]
  toasts: Toast[]
  banner: { text: string; until: number } | null
  pops: Pop[]
  energyFlash: number
  drag: { row: number; col: number; x: number; y: number; pending?: boolean; index?: number } | null
  hover: Hover
  shakeUntil: number
  /** 撕纸特效开始蹦出的时刻。格子到位之后才震。 */
  silaAt: number
  comicFrom: number
  comicFadeAt: number
  ghostOrder: null | {
    customerId: string
    slots: OrderSlot[]
    big: boolean
    reward: number
    rect: { x: number; y: number; w: number; h: number }
  }
}

export function createFx(): Fx {
  return {
    flyers: [],
    particles: [],
    coins: [],
    incoming: 0,
    coinPunch: -1e12,
    floaters: [],
    toasts: [],
    banner: null,
    pops: [],
    energyFlash: 0,
    drag: null,
    hover: null,
    shakeUntil: 0,
    silaAt: 0,
    comicFrom: -1,
    comicFadeAt: 0,
    ghostOrder: null,
  }
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

export function easeOutBack(t: number): number {
  const c1 = 1.35
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

export function popScale(age: number, dur: number): number {
  if (age <= 0) return 0.35
  const t = Math.min(1, age / Math.max(1, dur))
  if (t < 0.38) return 0.35 + (1.36 - 0.35) * easeOutCubic(t / 0.38)
  return 1.36 + (1 - 1.36) * easeOutCubic((t - 0.38) / 0.62)
}
