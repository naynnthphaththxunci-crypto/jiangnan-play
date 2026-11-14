import { PORTRAITS } from './portraits'
import { drawSprite, staticSheet, type SpriteDest, type SpriteSheet } from './sprite'
import avatarUrl from './assets/hecheng/avatar.webp'

/**
 * 客人、掌柜头像都走同一套 SpriteSheet。
 * 这一轮用现成的静态原画（frames = 1）。换序列帧时改这里的表，绘制函数不用动。
 */
const guestSheets = new Map<string, SpriteSheet>()

export function characterSheet(id: string | undefined): SpriteSheet | null {
  if (!id) return null
  const src = PORTRAITS[id]
  if (!src) return null
  let sheet = guestSheets.get(id)
  if (!sheet) {
    sheet = staticSheet(id, src)
    guestSheets.set(id, sheet)
  }
  return sheet
}

export const avatarSheet: SpriteSheet = staticSheet('avatar', avatarUrl)

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  id: string | undefined,
  image: object | null,
  dest: SpriteDest,
  now: number,
): boolean {
  const sheet = characterSheet(id)
  if (!sheet || !image) return false
  drawSprite(ctx, image, sheet, dest, now, 'contain-bottom')
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
