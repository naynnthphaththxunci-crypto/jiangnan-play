import { describe, expect, it } from 'vitest'
import { HOME_MAP_H, HOME_MAP_W, clampHomeCam, defaultHomeCam, homeMapScale, placeHomeBuildings } from '../src/homeMap'

describe('主页地图', () => {
  it('竖屏默认镜头在图内，上下左右都能再拖一点', () => {
    const viewW = 390
    const viewH = 844
    const cam = defaultHomeCam(viewW, viewH)
    const scale = homeMapScale(viewW, viewH)
    const visW = viewW / scale
    const visH = viewH / scale
    expect(visW).toBeLessThan(HOME_MAP_W)
    expect(visH).toBeLessThan(HOME_MAP_H)
    expect(cam.x - visW / 2).toBeGreaterThanOrEqual(-0.01)
    expect(cam.y - visH / 2).toBeGreaterThanOrEqual(-0.01)
    expect(cam.x + visW / 2).toBeLessThanOrEqual(HOME_MAP_W + 0.01)
    expect(cam.y + visH / 2).toBeLessThanOrEqual(HOME_MAP_H + 0.01)
    expect(clampHomeCam(0, cam.y, viewW, viewH).x).toBeLessThan(cam.x)
    expect(clampHomeCam(99_999, cam.y, viewW, viewH).x).toBeGreaterThan(cam.x)
    expect(clampHomeCam(cam.x, 0, viewW, viewH).y).toBeLessThan(cam.y)
    expect(clampHomeCam(cam.x, 99_999, viewW, viewH).y).toBeGreaterThan(cam.y)
    const edge = clampHomeCam(0, 0, viewW, viewH)
    expect(edge.x - visW / 2).toBeGreaterThanOrEqual(-0.01)
    expect(edge.y - visH / 2).toBeGreaterThanOrEqual(-0.01)
  })

  it('这轮还没有建筑点', () => {
    const cam = defaultHomeCam(390, 844)
    expect(placeHomeBuildings(390, 844, cam)).toEqual([])
  })
})