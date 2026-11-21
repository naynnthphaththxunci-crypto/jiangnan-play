/** PSD 以 140×140 的格子为基准。勾图层是 68×56，左上角相对格子左上角 (78, 91)。 */
export const TICK_CELL = 140
export const TICK_W = 68
export const TICK_H = 56
export const TICK_OX = 78
export const TICK_OY = 91

/** 打勾.png 是 1024 画布，不透明内容在这块里。 */
export const TICK_SRC = 1024
export const TICK_CONTENT = { x: 108, y: 184, w: 799, h: 654 }

export interface TickBox {
  x: number
  y: number
  w: number
  h: number
}

/** 可见勾的框，以及把内容对准这个框时整张图画在哪。 */
export function orderTickPlace(
  cell: TickBox,
  scale = 1,
  offsetX = TICK_OX,
  offsetY = TICK_OY,
): { box: TickBox; image: TickBox } {
  const cellScale = cell.w / TICK_CELL
  const box = {
    x: cell.x + offsetX * cellScale,
    y: cell.y + offsetY * cellScale,
    w: TICK_W * cellScale * scale,
    h: TICK_H * cellScale * scale,
  }
  const image = {
    x: box.x - (TICK_CONTENT.x / TICK_SRC) * (box.w * TICK_SRC / TICK_CONTENT.w),
    y: box.y - (TICK_CONTENT.y / TICK_SRC) * (box.h * TICK_SRC / TICK_CONTENT.h),
    w: box.w * (TICK_SRC / TICK_CONTENT.w),
    h: box.h * (TICK_SRC / TICK_CONTENT.h),
  }
  return { box, image }
}
