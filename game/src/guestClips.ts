import clips from './data/guestFrames.json'
import { spriteFrameIndex, type SpriteDest, type SpriteSheet } from './sprite'

/** 新序列帧画布。 */
export const GUEST_FRAME_W = 1280
export const GUEST_FRAME_H = 720

/** 1 起的画面编号，和 durations 等长。时间轴可以来回指到同一张图。 */
export interface GuestClip {
  sequence: number[]
  durations: number[]
  /** 第 1 帧不透明区域的水平中心，画布像素。动画期间沿用这个数，不逐帧重算。 */
  bodyCenterX: number
  /** 对齐桌子后再加的左右微调，屏幕像素。默认 0。 */
  offsetX: number
}

const table = clips as Record<string, GuestClip>

export function guestClip(id: string | undefined): GuestClip | null {
  if (!id) return null
  const clip = table[id]
  if (!clip?.sequence.length || clip.sequence.length !== clip.durations.length) return null
  return clip
}

/** 播到 elapsed 毫秒时，时间轴槽位（0 起）和画面编号（1 起）。 */
export function guestFrameAt(id: string, elapsedMs: number): { slot: number; image: number } | null {
  const clip = guestClip(id)
  if (!clip) return null
  const sheet: SpriteSheet = {
    id,
    src: '',
    frameWidth: 0,
    frameHeight: 0,
    frames: clip.sequence.length,
    columns: 1,
    fps: 0,
    frameDurations: clip.durations,
  }
  const slot = spriteFrameIndex(sheet, Math.max(0, elapsedMs), 0)
  return { slot, image: clip.sequence[slot] ?? 1 }
}

/**
 * 1280×720 按订单位高度缩放，脚对齐立绘框下沿。
 * 水平方向把第 1 帧的身子中心放到这张桌子的正中，再加微调。
 * 高度、宽度、纵坐标不变。
 */
export function sequencedGuestDest(
  dest: SpriteDest,
  tableCenterX: number,
  bodyCenterX: number,
  nudgeX = 0,
): SpriteDest {
  const h = dest.h
  const w = h * (GUEST_FRAME_W / GUEST_FRAME_H)
  const x = dest.x + (dest.w - w) / 2
  const bodyX = x + (bodyCenterX / GUEST_FRAME_W) * w
  return { x: x + (tableCenterX - bodyX) + nudgeX, y: dest.y + dest.h - h, w, h }
}
