import type { AudioContextLike, CanvasLike, Platform } from './types'

interface WxTouch {
  clientX: number
  clientY: number
  identifier: number
}

interface WxSize {
  windowWidth: number
  windowHeight: number
  pixelRatio?: number
}

interface WxApi {
  createCanvas(): CanvasLike
  getSystemInfoSync(): {
    windowWidth: number
    windowHeight: number
    screenHeight: number
    pixelRatio: number
    statusBarHeight?: number
    safeArea?: { top: number; bottom: number }
  }
  onTouchStart(cb: (e: { changedTouches: WxTouch[] }) => void): void
  onTouchMove(cb: (e: { changedTouches: WxTouch[] }) => void): void
  onTouchEnd(cb: (e: { changedTouches: WxTouch[] }) => void): void
  onTouchCancel(cb: (e: { changedTouches: WxTouch[] }) => void): void
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: string): void
  onHide(cb: () => void): void
  onShow(cb: () => void): void
  onWindowResize?: (cb: (res: WxSize & { size?: WxSize }) => void) => void
  createWebAudioContext?: () => AudioContextLike
  setClipboardData?: (opt: { data: string }) => void
  env?: { USER_DATA_PATH?: string }
  getFileSystemManager?: () => { writeFileSync: (path: string, data: string, enc?: string) => void }
}

function getWx(): WxApi {
  const wx = (globalThis as { wx?: WxApi }).wx
  if (!wx) throw new Error('微信环境里没有 wx')
  return wx
}

export function createWxPlatform(): Platform {
  const wx = getWx()
  const info = wx.getSystemInfoSync()
  const canvas = wx.createCanvas()
  let dpr = Math.min(2, info.pixelRatio || 1)
  let logical = { w: info.windowWidth, h: info.windowHeight }
  let resizeCb: (() => void) | null = null
  let audio: AudioContextLike | null = null

  const apply = (w: number, h: number, ratio?: number) => {
    dpr = Math.min(2, ratio || dpr || 1)
    logical = { w: Math.max(1, w), h: Math.max(1, h) }
    canvas.width = Math.round(logical.w * dpr)
    canvas.height = Math.round(logical.h * dpr)
  }
  apply(info.windowWidth, info.windowHeight, info.pixelRatio)

  const insets = {
    top: Math.min(64, Math.max(0, info.safeArea?.top ?? info.statusBarHeight ?? 0)),
    bottom: Math.min(48, Math.max(0, info.safeArea ? info.screenHeight - info.safeArea.bottom : 0)),
  }

  return {
    kind: 'wx',
    canvas,
    get dpr() {
      return dpr
    },
    insets,
    now: () => Date.now(),
    size: () => logical,
    raf: (cb) => {
      const raf = (globalThis as { requestAnimationFrame?: (fn: (t: number) => void) => void }).requestAnimationFrame
      if (raf) raf(cb)
      else setTimeout(() => cb(Date.now()), 16)
    },
    storageGet(key) {
      try {
        const value = wx.getStorageSync(key)
        if (typeof value === 'string') return value.length ? value : null
        if (value == null || value === '') return null
        return JSON.stringify(value)
      } catch {
        return null
      }
    },
    storageSet(key, value) {
      try {
        wx.setStorageSync(key, value)
      } catch {
        /* 忽略写入失败 */
      }
    },
    onPointer(down, move, up) {
      const emit = (touches: WxTouch[], fn: (x: number, y: number, id: number) => void) => {
        for (const touch of touches) fn(touch.clientX, touch.clientY, touch.identifier)
      }
      wx.onTouchStart((e) => emit(e.changedTouches, down))
      wx.onTouchMove((e) => emit(e.changedTouches, move))
      wx.onTouchEnd((e) => emit(e.changedTouches, up))
      wx.onTouchCancel((e) => emit(e.changedTouches, up))
    },
    onWheel() {
      /* 小游戏用双指缩放 */
    },
    onKey() {
      /* 小游戏没有键盘 */
    },
    onHide(cb) {
      wx.onHide(cb)
    },
    onShow(cb) {
      wx.onShow(cb)
    },
    exportText(filename, content) {
      try {
        wx.setClipboardData?.({ data: content })
      } catch {
        /* 剪贴板失败时仍尝试写文件 */
      }
      try {
        const root = wx.env?.USER_DATA_PATH
        if (root) wx.getFileSystemManager?.().writeFileSync(`${root}/${filename}`, content, 'utf8')
      } catch {
        /* 导出失败不打断游戏 */
      }
    },
    audio() {
      if (!audio && wx.createWebAudioContext) {
        try {
          audio = wx.createWebAudioContext()
        } catch {
          audio = null
        }
      }
      return audio
    },
    bindResize(cb) {
      resizeCb = cb
      wx.onWindowResize?.((res) => {
        const size = res.size ?? res
        apply(size.windowWidth, size.windowHeight, size.pixelRatio)
        resizeCb?.()
      })
    },
  }
}
