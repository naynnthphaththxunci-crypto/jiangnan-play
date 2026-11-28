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
 * 画布始终铺满屏幕。场景和木墙盖满这块画布。
 * 合成页的棋盘等内容在布局里单独缩小并居中，不在这里留黑边。
 */
export function canvasFit(vw: number, vh: number, _insetTop = 0, _insetBottom = 0): CanvasBox {
  return { x: 0, y: 0, w: Math.max(1, vw), h: Math.max(1, vh), wide: false }
}

export interface CoverBox {
  left: number
  top: number
  w: number
  h: number
}

/**
 * 画布从屏幕顶端盖到可见区底边，高度至少到大视口。
 * 工具栏收起或刘海上方不会露出一条空缝。左右黑边仍留在画布外面。
 */
export function coverCanvas(game: CanvasBox, ox = 0, oy = 0, screenH = 0): CoverBox {
  const gameLeft = ox + game.x
  const gameTop = oy + game.y
  const left = Math.floor(gameLeft)
  const right = Math.ceil(gameLeft + game.w)
  const top = 0
  const bottom = Math.ceil(Math.max(gameTop + game.h, screenH))
  return {
    left,
    top,
    w: Math.max(1, right - left),
    h: Math.max(1, bottom - top),
  }
}
