/** 主页大地图 2400×1800。镜头对准中间那栋破屋，边缘夹住，不露出空白。 */

export const HOME_MAP_W = 2400
export const HOME_MAP_H = 1800

/**
 * Allen 竖屏示意在地图上的窗口高度。
 * 按屏幕高度铺满这扇窗，地图仍比屏幕更高更宽，上下左右都能拖。
 */
export const HOME_VIEW_H = 1592

/** 默认镜头中心。房子落在屏幕中部偏上。 */
export const HOME_FOCUS = { x: 1168, y: 988 }

/** 交接单坐标在地图原图 4000×2999 上。贴图是按这个比例缩到 2400×1800。 */
export const HOME_SRC_W = 4000
export const HOME_SRC_H = 2999

/** 左上角和显示宽高，单位是原图像素。 */
export const HOME_WENRUYUE = { x: 2051, y: 1540, w: 197, h: 272 }
export const HOME_DAUGHTER = { x: 2168, y: 1622, w: 160, h: 217 }
export const HOME_FG_TREE = { x: 2096, y: 1807, w: 318, h: 264 }

export interface HomeBuilding {
  id: string
  x: number
  y: number
  w: number
  h: number
}

/** 以后按地图坐标放建筑。这轮没有图，列表先空着。 */
export const HOME_BUILDINGS: HomeBuilding[] = []

export interface HomeCam {
  x: number
  y: number
  scale: number
}

export function homeMapScale(viewW: number, viewH: number): number {
  const framed = viewH / HOME_VIEW_H
  const cover = Math.max(viewW / HOME_MAP_W, viewH / HOME_MAP_H)
  return Math.max(framed, cover)
}

export function clampHomeCam(x: number, y: number, viewW: number, viewH: number): HomeCam {
  const scale = homeMapScale(viewW, viewH)
  const halfW = viewW / scale / 2
  const halfH = viewH / scale / 2
  const minX = halfW
  const maxX = Math.max(halfW, HOME_MAP_W - halfW)
  const minY = halfH
  const maxY = Math.max(halfH, HOME_MAP_H - halfH)
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
    scale,
  }
}

export function defaultHomeCam(viewW: number, viewH: number): HomeCam {
  return clampHomeCam(HOME_FOCUS.x, HOME_FOCUS.y, viewW, viewH)
}

export function mapToScreen(viewW: number, viewH: number, cam: HomeCam, x: number, y: number): { x: number; y: number } {
  return {
    x: viewW / 2 + (x - cam.x) * cam.scale,
    y: viewH / 2 + (y - cam.y) * cam.scale,
  }
}

export interface HomeSrcBox {
  x: number
  y: number
  w: number
  h: number
}

/** 原图坐标换成当前地图贴图上的矩形，再投到屏幕。 */
export function homeSrcRect(viewW: number, viewH: number, cam: HomeCam, box: HomeSrcBox): { x: number; y: number; w: number; h: number } {
  const x = box.x * (HOME_MAP_W / HOME_SRC_W)
  const y = box.y * (HOME_MAP_H / HOME_SRC_H)
  const w = box.w * (HOME_MAP_W / HOME_SRC_W)
  const h = box.h * (HOME_MAP_H / HOME_SRC_H)
  const origin = mapToScreen(viewW, viewH, cam, x, y)
  return { x: origin.x, y: origin.y, w: w * cam.scale, h: h * cam.scale }
}

/** 温如月的点击范围。女儿和树枝不在这里。 */
export function homeHostessRect(viewW: number, viewH: number, cam: HomeCam): { x: number; y: number; w: number; h: number } {
  return homeSrcRect(viewW, viewH, cam, HOME_WENRUYUE)
}

export function homeDaughterRect(viewW: number, viewH: number, cam: HomeCam): { x: number; y: number; w: number; h: number } {
  return homeSrcRect(viewW, viewH, cam, HOME_DAUGHTER)
}

export function homeTreeRect(viewW: number, viewH: number, cam: HomeCam): { x: number; y: number; w: number; h: number } {
  return homeSrcRect(viewW, viewH, cam, HOME_FG_TREE)
}

export interface PlacedBuilding extends HomeBuilding {
  screenX: number
  screenY: number
  screenW: number
  screenH: number
}

/** 把以后的建筑从地图坐标换到屏幕。这轮没有图，返回空数组。 */
export function placeHomeBuildings(viewW: number, viewH: number, cam: HomeCam): PlacedBuilding[] {
  return HOME_BUILDINGS.map((building) => {
    const origin = mapToScreen(viewW, viewH, cam, building.x, building.y)
    return {
      ...building,
      screenX: origin.x,
      screenY: origin.y,
      screenW: building.w * cam.scale,
      screenH: building.h * cam.scale,
    }
  })
}
