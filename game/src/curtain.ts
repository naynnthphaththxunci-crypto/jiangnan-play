import curtainUrl from './assets/transition/curtain.webp'
import frontUrl from './assets/transition/front.webp'
import { easeOutCubic } from './fx'

/** 竹帘.png / 前景.png 的画布。两张图共用这一套坐标。 */
export const CURTAIN_W = 1440
export const CURTAIN_H = 2560

export interface CurtainPlace {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 竹帘和前景的同一块摆放。
 * 够宽时按宽度铺满，高出屏幕的部分从顶部裁掉。
 * 按宽度铺不满高度时改为按高度盖满，左右裁掉等量，不拉伸。
 * 宽屏黑边在画布外面。
 */
export function curtainPlace(viewW: number, viewH: number): CurtainPlace {
  const width = Math.max(1, viewW)
  const height = Math.max(1, viewH)
  const scaleW = width / CURTAIN_W
  const heightAtWidth = CURTAIN_H * scaleW
  if (heightAtWidth >= height - 0.5) {
    return { x: 0, y: height - heightAtWidth, w: width, h: heightAtWidth }
  }
  const scale = height / CURTAIN_H
  const w = CURTAIN_W * scale
  return { x: (width - w) / 2, y: 0, w, h: height }
}

/**
 * 竹帘相对静止位置的 y 偏移。0 是盖满，负值还在屏幕上方。
 * bouncePx > 0 时先略微超出再回到 0，整段都在 t=0..1 里。
 */
export function curtainDrop(t: number, travel: number, bouncePx: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  const over = Math.max(0, bouncePx)
  if (over <= 0) return -travel * (1 - easeOutCubic(clamped))
  const split = 0.78
  if (clamped < split) {
    const u = easeOutCubic(clamped / split)
    return -travel + (travel + over) * u
  }
  const u = easeOutCubic((clamped - split) / (1 - split))
  return over * (1 - u)
}

type ArtImage = CanvasImageSource & { complete?: boolean; naturalWidth?: number }

function loadImage(src: string): ArtImage | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  img.src = src
  return img
}

const curtainImg = loadImage(curtainUrl)
const frontImg = loadImage(frontUrl)

export function curtainBitmaps(): { curtain: ArtImage | null; front: ArtImage | null } {
  return { curtain: curtainImg, front: frontImg }
}

export function curtainReady(): boolean {
  return (curtainImg?.naturalWidth ?? 0) > 0 && (frontImg?.naturalWidth ?? 0) > 0
}
