import type { AudioContextLike, Platform } from './types'

export function createWebPlatform(canvas: HTMLCanvasElement): Platform {
  let dpr = Math.min(2, window.devicePixelRatio || 1)
  let logical = { w: 390, h: 844 }
  let resizeCb: (() => void) | null = null
  let wheelCb: ((x: number, y: number, dy: number) => void) | null = null
  let keyCb: ((key: string) => void) | null = null
  let hideCb: (() => void) | null = null
  let showCb: (() => void) | null = null
  let audio: AudioContextLike | null = null

  const sizeQuery = new URLSearchParams(window.location.search).get('size')?.match(/^(\d+)x(\d+)$/)
  const DESIGN_W = sizeQuery ? Number(sizeQuery[1]) : 390
  const DESIGN_H = sizeQuery ? Number(sizeQuery[2]) : 844
  const fit = () => {
    const parent = canvas.parentElement ?? document.body
    const pw = parent.clientWidth || window.innerWidth
    const ph = parent.clientHeight || window.innerHeight
    const scale = Math.min(pw / DESIGN_W, ph / DESIGN_H)
    logical = { w: DESIGN_W, h: DESIGN_H }
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.style.width = `${Math.max(1, Math.floor(DESIGN_W * scale))}px`
    canvas.style.height = `${Math.max(1, Math.floor(DESIGN_H * scale))}px`
    canvas.width = Math.round(DESIGN_W * dpr)
    canvas.height = Math.round(DESIGN_H * dpr)
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
    insets: { top: 0, bottom: 0 },
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
