import { PORTRAITS } from './portraits'
import { drawSprite, spriteFrameIndex, staticSheet, type SpriteDest, type SpriteSheet } from './sprite'
import avatarUrl from './assets/hecheng/avatar.webp'

const ajiangRaw = import.meta.glob('./assets/guests/ajiang/*.webp', { eager: true, import: 'default' }) as Record<string, string>

function loadFrame(src: string): HTMLImageElement | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  img.src = src
  return img
}

const ajiangFrames = Object.keys(ajiangRaw)
  .sort()
  .map((path) => loadFrame(ajiangRaw[path]!))
  .filter((img): img is HTMLImageElement => !!img)

/** 阿桨：出场先播完整段，再循环眨眼段。起止帧和帧率由调用处按调参覆盖。 */
const ajiangSheet: SpriteSheet = {
  ...staticSheet('boatman', ajiangRaw[Object.keys(ajiangRaw).sort()[0] ?? ''] ?? ''),
  frames: Math.max(1, ajiangFrames.length),
  fps: 12,
  introStart: 0,
  introEnd: Math.max(0, ajiangFrames.length - 1),
  loopStart: Math.min(20, Math.max(0, ajiangFrames.length - 1)),
  loopEnd: Math.max(0, ajiangFrames.length - 1),
}

/**
 * 客人、掌柜头像都走 SpriteSheet。
 * 静态客人 frames = 1。阿桨是第一位序列帧，其他客人以后按同一套参数接。
 */
const guestSheets = new Map<string, SpriteSheet>()

export function characterSheet(id: string | undefined): SpriteSheet | null {
  if (!id) return null
  if (id === 'boatman' && ajiangFrames.length > 1) return ajiangSheet
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
  return ajiangFrames
}

export const avatarSheet: SpriteSheet = staticSheet('avatar', avatarUrl)

export interface SpritePlayback {
  /** 这位客人第一次出现的时刻。序列帧用它算出场段和循环段。 */
  startedAt?: number
  fps?: number
  introStart?: number
  introEnd?: number
  loopStart?: number
  loopEnd?: number
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
    const playing: SpriteSheet = {
      ...sheet,
      fps: playback?.fps ?? sheet.fps,
      introStart: playback?.introStart ?? sheet.introStart,
      introEnd: playback?.introEnd ?? sheet.introEnd,
      loopStart: playback?.loopStart ?? sheet.loopStart,
      loopEnd: playback?.loopEnd ?? sheet.loopEnd,
    }
    const index = spriteFrameIndex(playing, now, playback?.startedAt ?? now)
    const frame = ajiangFrames[index]
    if (frame && (frame.naturalWidth || 0) > 0) {
      drawSprite(ctx, frame, { ...playing, frames: 1, fps: 0 }, dest, now, 'contain')
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
