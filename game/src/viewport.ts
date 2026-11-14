/** 合成页设计稿。宽屏按这个比例装进屏幕，左右留黑边。 */
export const PAGE_W = 1080
export const PAGE_H = 2340

export interface CanvasBox {
  x: number
  y: number
  w: number
  h: number
  wide: boolean
}

/**
 * 窄屏按宽度铺满，高由可视区域决定。
 * 宽屏（iPad、横屏）把设计稿等比装进屏幕，左右或上下留黑边。
 */
export function canvasFit(vw: number, vh: number): CanvasBox {
  const width = Math.max(1, vw)
  const height = Math.max(1, vh)
  const designAspect = PAGE_W / PAGE_H
  const wide = width / height > designAspect + 0.2
  if (!wide) return { x: 0, y: 0, w: width, h: height, wide: false }
  const scale = Math.min(width / PAGE_W, height / PAGE_H)
  const w = PAGE_W * scale
  const h = PAGE_H * scale
  return { x: (width - w) / 2, y: (height - h) / 2, w, h, wide: true }
}
