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
  /** 出场先播这一段，再进循环。不填就整段按 fps 循环。 */
  introStart?: number
  introEnd?: number
  loopStart?: number
  loopEnd?: number
  /**
   * 每帧各自的毫秒数。有这张表就不用 fps。
   * 0 表示 PS 里的 0 秒帧，播放时改用 zeroFrameMs。
   */
  frameDurations?: number[]
  /** 0 秒帧实际播放的毫秒。眨眼要快，默认 33。 */
  zeroFrameMs?: number
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

/** 把 0 秒帧换成调参时长。没有逐帧表时返回空。 */
export function resolvedFrameDurations(sheet: SpriteSheet, zeroFrameMs = sheet.zeroFrameMs ?? 33): number[] | null {
  if (!sheet.frameDurations?.length) return null
  const fallback = Math.max(1, zeroFrameMs)
  return sheet.frameDurations.map((ms) => (ms <= 0 ? fallback : ms))
}

export function spriteFrameIndex(sheet: SpriteSheet, now: number, startedAt = 0): number {
  const frames = Math.max(1, sheet.frames)
  const durations = resolvedFrameDurations(sheet)
  if (durations?.length) {
    const total = durations.reduce((sum, ms) => sum + ms, 0) || 1
    let age = Math.max(0, now - startedAt) % total
    for (let i = 0; i < durations.length; i++) {
      const span = durations[i] ?? 1
      if (age < span) return i
      age -= span
    }
    return durations.length - 1
  }
  if (frames <= 1 || sheet.fps <= 0) return 0
  const frameMs = 1000 / sheet.fps
  if (sheet.loopStart == null || sheet.loopEnd == null) {
    return Math.floor(Math.max(0, now) / frameMs) % frames
  }
  const introStart = sheet.introStart ?? 0
  const introEnd = sheet.introEnd ?? frames - 1
  const loopStart = sheet.loopStart
  const loopEnd = sheet.loopEnd
  const introCount = Math.max(1, introEnd - introStart + 1)
  const age = Math.max(0, now - startedAt)
  const introMs = introCount * frameMs
  if (age < introMs) return introStart + Math.min(introCount - 1, Math.floor(age / frameMs))
  const loopCount = Math.max(1, loopEnd - loopStart + 1)
  return loopStart + (Math.floor((age - introMs) / frameMs) % loopCount)
}

/** fill 拉满目标框；contain 保持宽高比并居中；contain-bottom 等比后脚对齐下沿。 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  image: object,
  sheet: SpriteSheet,
  dest: SpriteDest,
  now: number,
  fit: 'fill' | 'contain' | 'contain-bottom' = 'fill',
  startedAt = 0,
): void {
  const sized = image as { naturalWidth?: number; naturalHeight?: number; width?: number }
  const imageW = (typeof sized.naturalWidth === 'number' && sized.naturalWidth) || (typeof sized.width === 'number' ? sized.width : 0)
  const imageH = typeof sized.naturalHeight === 'number' ? sized.naturalHeight : 0
  if (imageW <= 0 || imageH <= 0 || dest.w <= 0 || dest.h <= 0) return
  const frames = Math.max(1, sheet.frames)
  const cols = Math.max(1, sheet.columns || frames)
  const index = spriteFrameIndex(sheet, now, startedAt)
  const col = index % cols
  const row = Math.floor(index / cols)
  const sw = sheet.frameWidth > 0 ? sheet.frameWidth : imageW
  const sh = sheet.frameHeight > 0 ? sheet.frameHeight : imageH
  let dx = dest.x
  let dy = dest.y
  let dw = dest.w
  let dh = dest.h
  if (fit === 'contain' || fit === 'contain-bottom') {
    const aspect = sw / Math.max(1, sh)
    dw = dest.w
    dh = dw / aspect
    if (dh > dest.h) {
      dh = dest.h
      dw = dh * aspect
    }
    dx = dest.x + (dest.w - dw) / 2
    dy = fit === 'contain-bottom' ? dest.y + dest.h - dh : dest.y + (dest.h - dh) / 2
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image as CanvasImageSource, col * sw, row * sh, sw, sh, dx, dy, dw, dh)
}
