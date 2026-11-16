/** 主场景设计稿 1080×2340。宽屏左右留黑，矮手机按宽铺满并从顶部裁。 */
export const HOME_W = 1080
export const HOME_H = 2340

export interface HomeFit {
  x: number
  y: number
  scale: number
}

export interface HomeBox {
  x: number
  y: number
  w: number
  h: number
}

export function homeFit(viewW: number, viewH: number): HomeFit {
  const aspect = viewW / Math.max(1, viewH)
  if (aspect > 0.68) {
    const scale = viewH / HOME_H
    return { x: (viewW - HOME_W * scale) / 2, y: 0, scale }
  }
  const scale = viewW / HOME_W
  const sceneH = HOME_H * scale
  return { x: 0, y: Math.min(0, viewH - sceneH), scale }
}

/** 跟场景一起走，矮屏时随底部对齐。 */
export function sceneBox(fit: HomeFit, x: number, y: number, w: number, h: number): HomeBox {
  return { x: fit.x + x * fit.scale, y: fit.y + y * fit.scale, w: w * fit.scale, h: h * fit.scale }
}

/** 贴在可见区顶部，不跟着被裁掉的场景抬头。 */
export function topBox(fit: HomeFit, x: number, y: number, w: number, h: number): HomeBox {
  return { x: fit.x + x * fit.scale, y: y * fit.scale, w: w * fit.scale, h: h * fit.scale }
}

export function homePlaces(viewW: number, viewH: number) {
  const fit = homeFit(viewW, viewH)
  return {
    fit,
    bg: sceneBox(fit, -115, -4, 1310, 2348),
    avatar: topBox(fit, 29, 150, 149, 149),
    energy: topBox(fit, 178, 169, 204, 71),
    coin: topBox(fit, 397, 169, 202, 71),
    gem: topBox(fit, 613, 168, 206, 72),
    settings: topBox(fit, 793, 248, 108, 106),
    shop: topBox(fit, 918, 247, 124, 107),
    badgeSettings: topBox(fit, 874, 246, 38, 38),
    badgeShop: topBox(fit, 1020, 246, 38, 38),
    storage: sceneBox(fit, 14, 2113, 143, 160),
    build: sceneBox(fit, 912, 2112, 153, 163),
    menu: topBox(fit, 540, 362, 405, 546),
    dialog: sceneBox(fit, 47, 819, 986, 702),
    arrow: sceneBox(fit, 668, 1819, 235, 249),
  }
}

/** 建筑按钮热区比图片四周各大一圈，设计稿像素。 */
export const BUILD_HIT_PAD = 28

export function buildHit(viewW: number, viewH: number): HomeBox {
  const fit = homeFit(viewW, viewH)
  const build = sceneBox(fit, 912, 2112, 153, 163)
  const pad = BUILD_HIT_PAD * fit.scale
  return { x: build.x - pad, y: build.y - pad, w: build.w + pad * 2, h: build.h + pad * 2 }
}

/** 箭头朝建筑按钮来回戳，返回设计稿上的位移。 */
export function arrowPoke(now: number): { x: number; y: number } {
  const fromX = 668 + 235 / 2
  const fromY = 1819 + 249 / 2
  const toX = 912 + 153 / 2
  const toY = 2112 + 163 / 2
  const dx = toX - fromX
  const dy = toY - fromY
  const len = Math.hypot(dx, dy) || 1
  const along = Math.sin(now / 220) * 14
  return { x: (dx / len) * along, y: (dy / len) * along }
}
