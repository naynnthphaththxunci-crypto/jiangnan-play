/** 开场视频和贴图共用 1080×1920。按宽铺满，屏幕比画面矮时从顶部裁掉。 */
export const FILM_W = 1080
export const FILM_H = 1920

export interface FilmBox {
  x: number
  y: number
  w: number
  h: number
}

export interface FilmFit {
  x: number
  y: number
  w: number
  h: number
  scale: number
}

export const LABEL_JINMEN: FilmBox = { x: 352, y: 978, w: 378, h: 106 }
export const HAND_DOOR: FilmBox = { x: 340, y: 1031, w: 157, h: 239 }
export const DLG_RUYUE: FilmBox = { x: 47, y: 852, w: 986, h: 700 }
export const DLG_ZHAO: FilmBox = { x: 0, y: 847, w: 1033, h: 705 }
export const TAP_TEXT: FilmBox = { x: 357, y: 1629, w: 366, h: 127 }
export const BTN_RESTART: FilmBox = { x: 327, y: 1416, w: 427, h: 169 }
export const HAND_RESTART: FilmBox = { x: 340, y: 1501, w: 157, h: 239 }

export function filmFit(viewW: number, viewH: number): FilmFit {
  const scale = viewW / FILM_W
  const h = FILM_H * scale
  const y = h > viewH ? viewH - h : 0
  return { x: 0, y, w: viewW, h, scale }
}

export function placeFilm(fit: FilmFit, box: FilmBox): FilmBox {
  return {
    x: fit.x + box.x * fit.scale,
    y: fit.y + box.y * fit.scale,
    w: box.w * fit.scale,
    h: box.h * fit.scale,
  }
}

export function expandBox(box: FilmBox, pad: number): FilmBox {
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 }
}

export function unionBox(a: FilmBox, b: FilmBox): FilmBox {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  }
}

/** 进门查看的热区：文字和手的外接框，再向外扩一圈。 */
export function doorHotspot(pad: number): FilmBox {
  return expandBox(unionBox(LABEL_JINMEN, HAND_DOOR), pad)
}

export function hitBox(box: FilmBox, x: number, y: number): boolean {
  return x >= box.x && y >= box.y && x < box.x + box.w && y < box.y + box.h
}

export function toFilm(fit: FilmFit, x: number, y: number): { x: number; y: number } {
  return { x: (x - fit.x) / fit.scale, y: (y - fit.y) / fit.scale }
}

/** 手往下按、略缩小，再弹回。返回 0–1 周期里的位移和缩放。 */
export function openingHandPose(now: number, startedAt: number): { dy: number; scale: number } {
  const period = 900
  const t = ((Math.max(0, now - startedAt) % period) + period) % period / period
  if (t < 0.35) {
    const u = t / 0.35
    return { dy: 12 * u, scale: 1 - 0.1 * u }
  }
  if (t < 0.7) {
    const u = (t - 0.35) / 0.35
    const ease = 1 - (1 - u) ** 3
    return { dy: 12 * (1 - ease) - 4 * Math.sin(u * Math.PI), scale: 0.9 + 0.14 * ease }
  }
  const u = (t - 0.7) / 0.3
  return { dy: -4 * (1 - u), scale: 1.04 - 0.04 * u }
}
