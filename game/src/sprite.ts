/**
 * 角色原画的绘制口。现在每张图只有 1 帧（静态原画）。
 * 以后换成序列帧时，只要把同一张图换成横向或网格 sprite sheet，
 * 并填上 frameWidth / frameHeight / frames / columns / fps，调用处不用改。
 */
export interface SpriteSheet {
  id: string
  src: string
  /** 0 表示整张图就是一帧。 */
  frameWidth: number
  frameHeight: number
  frames: number
  columns: number
  /** 0 或 frames<=1 时不播，永远画第 0 帧。 */
  fps: number
}

export interface SpriteDest {
  x: number
  y: number
  w: number
  h: number
}

export function staticSheet(id: string, src: string): SpriteSheet {
  return { id, src, frameWidth: 0, frameHeight: 0, frames: 1, columns: 1, fps: 0 }
}

export function spriteFrameIndex(sheet: SpriteSheet, now: number): number {
  const frames = Math.max(1, sheet.frames)
  if (frames <= 1 || sheet.fps <= 0) return 0
  return Math.floor(Math.max(0, now) / (1000 / sheet.fps)) % frames
}

/** fill 拉满目标框；contain-bottom 按比例放进框里，脚对齐下沿。 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: object,
  sheet: SpriteSheet,
  dest: SpriteDest,
  now: number,
  fit: 'fill' | 'contain-bottom' = 'fill',
): void {
  const sized = image as { naturalWidth?: number; naturalHeight?: number; width?: number }
  const imageW = (typeof sized.naturalWidth === 'number' && sized.naturalWidth) || (typeof sized.width === 'number' ? sized.width : 0)
  const imageH = typeof sized.naturalHeight === 'number' ? sized.naturalHeight : 0
  if (imageW <= 0 || imageH <= 0 || dest.w <= 0 || dest.h <= 0) return
  const frames = Math.max(1, sheet.frames)
  const cols = Math.max(1, sheet.columns || frames)
  const index = spriteFrameIndex(sheet, now)
  const col = index % cols
  const row = Math.floor(index / cols)
  const sw = sheet.frameWidth > 0 ? sheet.frameWidth : imageW
  const sh = sheet.frameHeight > 0 ? sheet.frameHeight : imageH
  let dx = dest.x
  let dy = dest.y
  let dw = dest.w
  let dh = dest.h
  if (fit === 'contain-bottom') {
    const aspect = sw / Math.max(1, sh)
    dw = dest.w
    dh = dw / aspect
    if (dh > dest.h) {
      dh = dest.h
      dw = dh * aspect
    }
    dx = dest.x + (dest.w - dw) / 2
    dy = dest.y + dest.h - dh
  }
  ctx.drawImage(image as CanvasImageSource, col * sw, row * sh, sw, sh, dx, dy, dw, dh)
}
