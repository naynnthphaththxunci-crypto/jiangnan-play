import clips from './data/guestFrames.json'
import { spriteFrameIndex, type SpriteSheet } from './sprite'

/** 1 起的画面编号，和 durations 等长。时间轴可以来回指到同一张图。 */
export interface GuestClip {
  sequence: number[]
  durations: number[]
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
