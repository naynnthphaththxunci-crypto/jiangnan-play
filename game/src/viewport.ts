/** 合成页设计稿。 */
export const PAGE_W = 1080
export const PAGE_H = 2340

/** 必须完整显示的设计区：资源条顶（y=140）到设计稿底。上方是可裁的场景。 */
export const KEEP_TOP = 140
export const KEEP_BOTTOM = PAGE_H

export interface CanvasBox {
  x: number
  y: number
  w: number
  h: number
  /** 左右留黑边。矮到放不下必显区域，或宽屏时为 true。 */
  wide: boolean
}

/**
 * 够高：按宽度铺满。
 * 太矮或宽屏：按高度把必显区域装进屏幕，左右留黑边。
 */
export function canvasFit(vw: number, vh: number, insetTop = 0, insetBottom = 0): CanvasBox {
  const width = Math.max(1, vw)
  const height = Math.max(1, vh)
  const availH = Math.max(1, height - Math.max(0, insetTop) - Math.max(0, insetBottom))
  const scaleW = width / PAGE_W
  const keepH = (KEEP_BOTTOM - KEEP_TOP) * scaleW
  const wideScreen = width / height > PAGE_W / PAGE_H + 0.2
  if (!wideScreen && keepH <= availH + 0.5) {
    return { x: 0, y: 0, w: width, h: height, wide: false }
  }
  const scale = Math.min(scaleW, availH / (KEEP_BOTTOM - KEEP_TOP))
  const w = PAGE_W * scale
  return { x: (width - w) / 2, y: 0, w, h: height, wide: true }
}
