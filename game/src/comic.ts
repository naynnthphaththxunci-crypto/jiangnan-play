import page1 from './assets/comic/page1.jpg'
import page2 from './assets/comic/page2.jpg'
import page3 from './assets/comic/page3.jpg'
import silaUrl from './assets/comic/sila.webp'
import fontUrl from './assets/comic/comic-bold.woff2'
import type { OpeningScript } from './types'

export const COMIC_FONT = 'JiangnanComic'

const PAGE_URLS = [page1, page2, page3]

type ComicImage = CanvasImageSource & { complete?: boolean; naturalWidth?: number; naturalHeight?: number }

function loadImage(src: string): ComicImage | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  img.src = src
  return img
}

const pageImages = PAGE_URLS.map((src) => loadImage(src))
const silaImage = loadImage(silaUrl)

export function comicPageImage(index: number): ComicImage | null {
  return pageImages[index] ?? null
}

export function comicSilaImage(): ComicImage | null {
  return silaImage
}

export function comicImageElements(): HTMLImageElement[] {
  const Ctor = (globalThis as { HTMLImageElement?: typeof HTMLImageElement }).HTMLImageElement
  if (!Ctor) return []
  return [...pageImages, silaImage].filter((img): img is HTMLImageElement => img instanceof Ctor)
}

let fontPromise: Promise<void> | null = null

export function loadComicFont(): Promise<void> {
  if (fontPromise) return fontPromise
  const host = globalThis as {
    FontFace?: new (family: string, source: string, descriptors?: { weight?: string; style?: string }) => FontFace
    document?: Document
  }
  if (!host.FontFace || !host.document?.fonts) {
    fontPromise = Promise.resolve()
    return fontPromise
  }
  const face = new host.FontFace(COMIC_FONT, `url(${fontUrl})`, { weight: '700', style: 'normal' })
  fontPromise = face
    .load()
    .then((loaded) => {
      host.document?.fonts.add(loaded)
    })
    .catch(() => {
      /* 字库没载上时仍能翻页，下一帧再试 */
      fontPromise = null
    })
  return fontPromise
}

export function comicFontReady(): boolean {
  const fonts = (globalThis as { document?: Document }).document?.fonts
  if (!fonts) return false
  return fonts.check(`700 32px ${COMIC_FONT}`)
}

export interface ComicCursor {
  page: number
  shown: number
}

/** storyStep 0 是第一页还没出字。每一页的拍数是「句子数 + 1」（含出完后的那一拍）。 */
export function comicCursor(script: OpeningScript, step: number): ComicCursor | null {
  let left = step
  for (let page = 0; page < script.pages.length; page++) {
    const count = script.pages[page].beats.length + 1
    if (left < count) return { page, shown: left }
    left -= count
  }
  return null
}

export function storyBeatCount(script: OpeningScript): number {
  return script.pages.reduce((sum, page) => sum + page.beats.length + 1, 0)
}

export function silaVisible(script: OpeningScript, step: number): boolean {
  const cursor = comicCursor(script, step)
  if (!cursor) return false
  const index = script.pages[cursor.page]?.beats.findIndex((beat) => beat.kind === 'sila') ?? -1
  return index >= 0 && cursor.shown > index
}

export function silaJustShown(script: OpeningScript, before: number, after: number): boolean {
  return !silaVisible(script, before) && silaVisible(script, after)
}
