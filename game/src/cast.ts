import { guestClip, sequencedGuestDest } from './guestClips'
import { PORTRAITS } from './portraits'
import { drawSprite, spriteFrameIndex, staticSheet, type SpriteDest, type SpriteSheet } from './sprite'
import avatarUrl from './assets/hecheng/avatar.webp'

const frameRaw = {
  boatman: import.meta.glob('./assets/guests/boatman/*.webp', { eager: true, import: 'default' }) as Record<string, string>,
  fisherman: import.meta.glob('./assets/guests/fisherman/*.webp', { eager: true, import: 'default' }) as Record<string, string>,
  squire: import.meta.glob('./assets/guests/squire/*.webp', { eager: true, import: 'default' }) as Record<string, string>,
  scholar: import.meta.glob('./assets/guests/scholar/*.webp', { eager: true, import: 'default' }) as Record<string, string>,
  siamese: import.meta.glob('./assets/guests/siamese/*.webp', { eager: true, import: 'default' }) as Record<string, string>,
}

function loadFrame(src: string): HTMLImageElement | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  img.src = src
  return img
}

function loadNumbered(raw: Record<string, string>): HTMLImageElement[] {
  return Object.keys(raw)
    .sort((a, b) => frameNumber(a) - frameNumber(b))
    .map((path) => loadFrame(raw[path]!))
    .filter((img): img is HTMLImageElement => !!img)
}

function frameNumber(path: string): number {
  const name = path.split('/').pop() ?? ''
  const n = Number.parseInt(name, 10)
  return Number.isFinite(n) ? n : 0
}

const frames = new Map<string, HTMLImageElement[]>(
  Object.entries(frameRaw).map(([id, raw]) => [id, loadNumbered(raw)]),
)

const guestSheets = new Map<string, SpriteSheet>()

export function characterSheet(id: string | undefined): SpriteSheet | null {
  if (!id) return null
  const clip = guestClip(id)
  const images = frames.get(id)
  if (clip && images && images.length > 1) {
    return {
      ...staticSheet(id, ''),
      frames: clip.sequence.length,
      fps: 0,
      frameDurations: clip.durations,
    }
  }
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
  return [...frames.values()].flat()
}

export const avatarSheet: SpriteSheet = staticSheet('avatar', avatarUrl)

export interface SpritePlayback {
  /** 这位客人第一次出现的时刻。序列帧从这里开始算时间轴。 */
  startedAt?: number
  /** 这张桌子的水平中心。序列帧用第 1 帧身子中心去对齐。 */
  tableCenterX?: number
  /** 全局「客人左右微调」，屏幕像素。角色自己的 offsetX 在这里另外加上。 */
  nudgeX?: number
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
  const clip = guestClip(id)
  const images = id ? frames.get(id) : undefined
  if (clip && images && images.length > 1) {
    const playing: SpriteSheet = {
      ...staticSheet(id ?? '', ''),
      frames: clip.sequence.length,
      fps: 0,
      frameDurations: clip.durations,
    }
    const slot = spriteFrameIndex(playing, now, playback?.startedAt ?? 0)
    const imageNo = clip.sequence[slot] ?? 1
    const frame = images[imageNo - 1]
    if (frame && (frame.naturalWidth || 0) > 0) {
      const tableCenterX = playback?.tableCenterX ?? dest.x + dest.w / 2
      const placed = sequencedGuestDest(dest, tableCenterX, clip.bodyCenterX, (playback?.nudgeX ?? 0) + (clip.offsetX ?? 0))
      drawSprite(ctx, frame, { ...playing, frames: 1, fps: 0, frameDurations: undefined }, placed, now, 'fill')
      return true
    }
  }
  const sheet = characterSheet(id)
  if (!sheet || !image) return false
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
