import type { AudioContextLike, Platform } from './types'
import { canvasFit, coverCanvas } from '../viewport'

export function createWebPlatform(canvas: HTMLCanvasElement): Platform {
  let dpr = Math.min(3, window.devicePixelRatio || 1)
  let logical = { w: 390, h: 844 }
  const insets = { top: 0, bottom: 0 }
  let resizeCb: (() => void) | null = null
  let wheelCb: ((x: number, y: number, dy: number) => void) | null = null
  let keyCb: ((key: string) => void) | null = null
  let hideCb: (() => void) | null = null
  let showCb: (() => void) | null = null
  let audio: AudioContextLike | null = null

  const readSafe = () => {
    const probe = document.getElementById('safe-probe')
    if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 }
    const style = getComputedStyle(probe)
    const num = (value: string) => {
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : 0
    }
    return {
      top: num(style.paddingTop),
      right: num(style.paddingRight),
      bottom: num(style.paddingBottom),
      left: num(style.paddingLeft),
    }
  }

  const fit = () => {
    const vv = window.visualViewport
    const vw = vv?.width ?? window.innerWidth
    const vh = vv?.height ?? window.innerHeight
    const ox = vv?.offsetLeft ?? 0
    const oy = vv?.offsetTop ?? 0
    const safe = readSafe()
    const layoutH = window.innerHeight
    const viewTop = oy
    const viewBottom = oy + vh
    const lvhEl = document.getElementById('lvh-probe')
    const lvh = lvhEl ? lvhEl.getBoundingClientRect().height : 0
    const screenH = Math.max(layoutH, viewBottom, lvh)
    const insetTop = Math.max(0, safe.top - viewTop)
    const insetBottom = Math.max(0, viewBottom - (layoutH - safe.bottom))
    const box = canvasFit(vw, vh, insetTop, insetBottom)
    const cover = coverCanvas(box, ox, oy, screenH)
    dpr = Math.min(3, window.devicePixelRatio || 1)
    const cssW = cover.w
    const cssH = cover.h
    logical = { w: cssW, h: cssH }
    const style = canvas.style
    style.position = 'fixed'
    style.left = `${cover.left}px`
    style.top = `${cover.top}px`
    style.width = `${cssW}px`
    style.height = `${cssH}px`
    canvas.width = Math.max(1, Math.round(cssW * dpr))
    canvas.height = Math.max(1, Math.round(cssH * dpr))
    const hiddenBelow = Math.max(0, cover.top + cover.h - viewBottom)
    insets.top = Math.max(0, safe.top - cover.top)
    insets.bottom = hiddenBelow + insetBottom
  }
  fit()
  const refit = () => {
    fit()
    resizeCb?.()
  }
  window.visualViewport?.addEventListener('resize', refit)
  window.visualViewport?.addEventListener('scroll', () => {
    window.scrollTo(0, 0)
    refit()
  })
  window.addEventListener('orientationchange', refit)
  document.addEventListener(
    'touchmove',
    (event) => {
      event.preventDefault()
    },
    { passive: false },
  )
  document.addEventListener('gesturestart', (event) => event.preventDefault())

  const rel = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * logical.w,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * logical.h,
    }
  }

  return {
    kind: 'web',
    canvas,
    get dpr() {
      return dpr
    },
    insets,
    now: () => Date.now(),
    size: () => logical,
    raf: (cb) => {
      requestAnimationFrame(cb)
    },
    storageGet(key) {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    storageSet(key, value) {
      try {
        localStorage.setItem(key, value)
      } catch {
        /* 配额满了就只在这一局里记着 */
      }
    },
    onPointer(down, move, up) {
      canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return
        event.preventDefault()
        try {
          canvas.setPointerCapture(event.pointerId)
        } catch {
          /* Safari 在指针还没激活时会抛错，不能因此丢掉这次点击 */
        }
        const p = rel(event.clientX, event.clientY)
        down(p.x, p.y, event.pointerId)
      })
      canvas.addEventListener('pointermove', (event) => {
        const p = rel(event.clientX, event.clientY)
        move(p.x, p.y, event.pointerId)
      })
      const end = (event: PointerEvent) => {
        const p = rel(event.clientX, event.clientY)
        up(p.x, p.y, event.pointerId)
      }
      canvas.addEventListener('pointerup', end)
      canvas.addEventListener('pointercancel', end)
      canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    },
    onWheel(cb) {
      wheelCb = cb
      canvas.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault()
          const p = rel(event.clientX, event.clientY)
          wheelCb?.(p.x, p.y, event.deltaY)
        },
        { passive: false },
      )
    },
    onKey(cb) {
      keyCb = cb
      window.addEventListener('keydown', (event) => keyCb?.(event.key))
    },
    onHide(cb) {
      hideCb = cb
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) hideCb?.()
        else showCb?.()
      })
    },
    onShow(cb) {
      showCb = cb
    },
    exportText(filename, content) {
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    },
    audio() {
      if (!audio) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: { new (): AudioContextLike } }).webkitAudioContext
        if (!Ctor) return null
        audio = new Ctor()
      }
      return audio
    },
    bindResize(cb) {
      resizeCb = cb
      window.addEventListener('resize', () => {
        fit()
        resizeCb?.()
      })
    },
  }
}
