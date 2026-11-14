import { PORTRAITS } from './portraits'
import { drawSprite, spriteFrameIndex, staticSheet, type SpriteDest, type SpriteSheet } from './sprite'
import avatarUrl from './assets/hecheng/avatar.webp'

const ajiangRaw = import.meta.glob('./assets/guests/ajiang/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const baoRaw = import.meta.glob('./assets/guests/bao/*.webp', { eager: true, import: 'default' }) as Record<string, string>

function loadFrame(src: string): HTMLImageElement | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  img.src = src
  return img
}

function loadSorted(raw: Record<string, string>): HTMLImageElement[] {
  return Object.keys(raw)
    .sort()
    .map((path) => loadFrame(raw[path]!))
    .filter((img): img is HTMLImageElement => !!img)
}

const ajiangFrames = loadSorted(ajiangRaw)
const baoFrames = loadSorted(baoRaw)

/** 鲍大叔：按 PS 时间轴逐帧时长，从第 1 帧一直循环。0 是 0 秒帧，播放时换成调参。 */
const BAO_DURATIONS = [70, 0, 0, 0, 0, 0, 0, 70, 70, 70, 70, 70, 70]

/** 阿桨：24 帧整段循环，每帧时长由调参决定，没有出场段。 */
const ajiangSheet: SpriteSheet = {
  ...staticSheet('boatman', ajiangRaw[Object.keys(ajiangRaw).sort()[0] ?? ''] ?? ''),
  frames: Math.max(1, ajiangFrames.length),
  fps: 0,
  frameDurations: Array.from({ length: Math.max(1, ajiangFrames.length) }, () => 150),
}

const baoSheet: SpriteSheet = {
  ...staticSheet('fisherman', baoRaw[Object.keys(baoRaw).sort()[0] ?? ''] ?? ''),
  frames: Math.max(1, baoFrames.length),
  fps: 0,
  frameDurations: BAO_DURATIONS.slice(0, Math.max(1, baoFrames.length)),
  zeroFrameMs: 33,
}

/**
 * 客人、掌柜头像都走 SpriteSheet。
 * 静态客人 frames = 1。阿桨是第一位序列帧，其他客人以后按同一套参数接。
 */
const guestSheets = new Map<string, SpriteSheet>()

export function characterSheet(id: string | undefined): SpriteSheet | null {
  if (!id) return null
  if (id === 'boatman' && ajiangFrames.length > 1) return ajiangSheet
  if (id === 'fisherman' && baoFrames.length > 1) return baoSheet
  const src = PORTRAITS[id]
  if (!src) return null
  let sheet = guestSheets.get(id)
  if (!sheet) {
    sheet = staticSheet(id, src)
    guestSheets.set(id, sheet)
  }
  return sheet
}

export function castImageElements(): HTMLImageElement[] {
  return [...ajiangFrames, ...baoFrames]
}

export const avatarSheet: SpriteSheet = staticSheet('avatar', avatarUrl)

export interface SpritePlayback {
  /** 这位客人第一次出现的时刻。序列帧用它算出场段和循环段。 */
  startedAt?: number
  /** 阿桨每一帧的毫秒。整段按这个时长循环。 */
  frameMs?: number
  /** PS 里标成 0 秒的帧，实际播这么多毫秒。 */
  zeroFrameMs?: number
}

/**
 * 新序列帧几乎是方的，旧的 306×343 在方框里是靠高撑满、水平居中。
 * 按头带中心和头带宽把新图缩到同一位置，宽高比不变。
 */
function ajiangDest(dest: SpriteDest): SpriteDest {
  const side = Math.min(dest.w, dest.h)
  const ox = dest.x + (dest.w - side) / 2
  const oy = dest.y + (dest.h - side) / 2
  const oldDw = 306 / 343
  const oldDx = (1 - oldDw) / 2
  const bandCx = oldDx + 0.507 * oldDw
  const bandCy = 0.274
  const bandW = 0.562 * oldDw
  const w = (bandW / 0.476) * side
  const h = w * (345 / 347)
  return { x: ox + (bandCx - 0.457 * (w / side)) * side, y: oy + (bandCy - 0.267 * (h / side)) * side, w, h }
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  id: string | undefined,
  image: object | null,
  dest: SpriteDest,
  now: number,
  fit: 'fill' | 'contain' | 'contain-bottom' = 'contain',
  playback?: SpritePlayback,
): boolean {
  const sheet = characterSheet(id)
  if (!sheet) return false
  if (id === 'boatman' && ajiangFrames.length > 1) {
    const ms = Math.max(1, playback?.frameMs ?? 150)
    const playing: SpriteSheet = {
      ...ajiangSheet,
      frameDurations: Array.from({ length: ajiangFrames.length }, () => ms),
    }
    const index = spriteFrameIndex(playing, now, playback?.startedAt ?? 0)
    const frame = ajiangFrames[index]
    if (frame && (frame.naturalWidth || 0) > 0) {
      drawSprite(ctx, frame, { ...playing, frames: 1, fps: 0, frameDurations: undefined }, ajiangDest(dest), now, 'fill')
      return true
    }
  }
  if (id === 'fisherman' && baoFrames.length > 1) {
    const playing: SpriteSheet = {
      ...baoSheet,
      zeroFrameMs: playback?.zeroFrameMs ?? baoSheet.zeroFrameMs,
    }
    const index = spriteFrameIndex(playing, now, playback?.startedAt ?? 0)
    const frame = baoFrames[index]
    if (frame && (frame.naturalWidth || 0) > 0) {
      drawSprite(ctx, frame, { ...playing, frames: 1, fps: 0, frameDurations: undefined }, dest, now, 'contain')
      return true
    }
  }
  if (!image) return false
  drawSprite(ctx, image, sheet, dest, now, fit)
  return true
}

export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  image: object | null,
  dest: SpriteDest,
  now: number,
): void {
  if (!image) return
  drawSprite(ctx, image, avatarSheet, dest, now, 'contain-bottom')
}
