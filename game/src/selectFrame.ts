/** 选择棋子.png 的画布，和抠掉透明后的四个角。 */
export const SELECT_FRAME_SIZE = 1536
export const SELECT_CONTENT = { x: 171, y: 182, w: 1359 - 171, h: 1338 - 182 }

export interface SelectRect {
  x: number
  y: number
  w: number
  h: number
}

/** 整张框等比缩放，比格子大一圈并居中。不单独拉宽或拉高。 */
export function selectFrameRect(cell: SelectRect, frameScale = 1.16): SelectRect {
  const cover = Math.max(0.5, frameScale)
  const scale = (cell.w * cover) / SELECT_CONTENT.w
  const contentW = SELECT_CONTENT.w * scale
  const contentH = SELECT_CONTENT.h * scale
  const contentX = cell.x + (cell.w - contentW) / 2
  const contentY = cell.y + (cell.h - contentH) / 2
  return {
    x: contentX - SELECT_CONTENT.x * scale,
    y: contentY - SELECT_CONTENT.y * scale,
    w: SELECT_FRAME_SIZE * scale,
    h: SELECT_FRAME_SIZE * scale,
  }
}

/**
 * 从点中那一刻起，按正弦放大再缩小。
 * times 次来回之后回到 1，不再循环。幅度为 0 或次数为 0 时一直是 1。
 */
export function selectBreathScale(elapsed: number, amplitude: number, periodMs: number, times = 2): number {
  const amp = Math.max(0, amplitude)
  const count = Math.max(0, Math.floor(times))
  if (amp === 0 || count === 0 || elapsed < 0) return 1
  const period = Math.max(1, periodMs)
  if (elapsed >= count * period) return 1
  return 1 + amp * Math.sin((elapsed / period) * Math.PI * 2)
}
