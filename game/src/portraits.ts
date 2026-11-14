import teaGuest from './assets/guests/teaGuest.png'
import scholar from './assets/guests/scholar.png'
import embroider from './assets/guests/embroider.png'
import boatman from './assets/guests/boatman.webp'
import squire from './assets/guests/squire.webp'
import fisherman from './assets/guests/fisherman.webp'
import siamese from './assets/guests/siamese.png'
import bossDaughter from './assets/guests/bossDaughter.png'
import ruyue from './assets/guests/ruyue.png'
import xiaotao from './assets/guests/xiaotao.png'
import zhao from './assets/guests/zhao.png'
import liu from './assets/guests/liu.png'
import portraitsJson from './data/portraits.json'
import type { NormBox } from './types'

export const PORTRAITS: Record<string, string> = {
  teaGuest,
  scholar,
  embroider,
  boatman,
  squire,
  fisherman,
  siamese,
  bossDaughter,
  ruyue,
  xiaotao,
  zhao,
  liu,
}

type PortraitRow = { file?: string; aspect?: number; content?: NormBox; face?: NormBox }

const rows = portraitsJson as Record<string, PortraitRow>

const FULL: NormBox = { x: 0, y: 0, w: 1, h: 1 }
const DEFAULT_FACE: NormBox = { x: 0.25, y: 0.04, w: 0.5, h: 0.36 }

const measured = new Map<string, { content: NormBox; aspect: number }>()

export function portraitConfig(id: string): { content: NormBox; face: NormBox; aspect: number } {
  const row = rows[id]
  const live = measured.get(id)
  return {
    content: live?.content ?? row?.content ?? FULL,
    face: row?.face ?? DEFAULT_FACE,
    aspect: live?.aspect ?? row?.aspect ?? 1,
  }
}

export function measurePortrait(id: string, img: GuestImage): void {
  if (measured.has(id)) return
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) return
  const host = globalThis as { document?: Document }
  if (!host.document) return
  try {
    const canvas = host.document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img as CanvasImageSource, 0, 0)
    const data = ctx.getImageData(0, 0, width, height).data
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if ((data[(y * width + x) * 4 + 3] ?? 0) < 24) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
    if (maxX <= minX || maxY <= minY) return
    measured.set(id, {
      aspect: width / height,
      content: {
        x: minX / width,
        y: minY / height,
        w: (maxX - minX) / width,
        h: (maxY - minY) / height,
      },
    })
  } catch {
    /* 测不到就用 portraits.json 里的 content */
  }
}

interface GuestImage {
  src: string
  width: number
  height: number
  naturalWidth?: number
  naturalHeight?: number
  complete?: boolean
}

const cache = new Map<string, GuestImage>()

function createImage(): GuestImage | null {
  const host = globalThis as {
    wx?: { createImage?: () => GuestImage }
    Image?: new () => GuestImage
  }
  if (host.wx?.createImage) return host.wx.createImage()
  if (typeof host.Image === 'function') return new host.Image()
  return null
}

export function guestPortrait(key: string | undefined): GuestImage | null {
  if (!key) return null
  const src = PORTRAITS[key]
  if (!src) return null
  const cached = cache.get(src)
  if (cached) return cached
  const img = createImage()
  if (!img) return null
  const host = globalThis as { wx?: unknown }
  img.src = host.wx && src.startsWith('./') ? src.slice(2) : src
  cache.set(src, img)
  return img
}

export function guestImageElements(): HTMLImageElement[] {
  const Ctor = (globalThis as { HTMLImageElement?: typeof HTMLImageElement }).HTMLImageElement
  if (!Ctor) return []
  const out: HTMLImageElement[] = []
  for (const key of Object.keys(PORTRAITS)) {
    const img = guestPortrait(key)
    if (img instanceof Ctor) out.push(img)
  }
  return out
}

export function portraitReady(img: GuestImage | null): boolean {
  if (!img) return false
  if (img.complete === false) return false
  return (img.naturalWidth || img.width || 0) > 0
}
