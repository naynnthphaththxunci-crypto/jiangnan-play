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

/** 温如月双脚所在的地图坐标，门前空地。身高是地图像素。 */
export const HOME_HOSTESS = { x: 1204, y: 1108, h: 176 }

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

/** 温如月身子在屏幕上的热区，跟着地图走。 */
export function homeHostessRect(viewW: number, viewH: number, cam: HomeCam): { x: number; y: number; w: number; h: number } {
  const foot = mapToScreen(viewW, viewH, cam, HOME_HOSTESS.x, HOME_HOSTESS.y)
  const h = HOME_HOSTESS.h * cam.scale
  const w = h * 0.62
  return { x: foot.x - w / 2, y: foot.y - h, w, h }
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
