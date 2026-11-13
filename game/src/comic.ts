import p1_1 from './assets/comic/p1_1.webp'
import p1_2 from './assets/comic/p1_2.webp'
import p1_3 from './assets/comic/p1_3.webp'
import p1_4 from './assets/comic/p1_4.webp'
import p2_1 from './assets/comic/p2_1.webp'
import p2_2 from './assets/comic/p2_2.webp'
import p2_3 from './assets/comic/p2_3.webp'
import p2_4 from './assets/comic/p2_4.webp'
import p3_1 from './assets/comic/p3_1.webp'
import p3_2 from './assets/comic/p3_2.webp'
import p3_3 from './assets/comic/p3_3.webp'
import silaUrl from './assets/comic/sila.webp'
import regularUrl from './assets/comic/comic-regular.woff2'
import boldUrl from './assets/comic/comic-bold.woff2'
import type { ComicBeat, OpeningScript } from './types'

export const COMIC_FONT = 'JiangnanComic'

const PANEL_URLS: Record<string, string> = {
  p1_1, p1_2, p1_3, p1_4,
  p2_1, p2_2, p2_3, p2_4,
  p3_1, p3_2, p3_3,
}

type ComicImage = CanvasImageSource & { complete?: boolean; naturalWidth?: number; naturalHeight?: number }

function loadImage(src: string): ComicImage | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  img.src = src
  return img
}

const panelImages = new Map<string, ComicImage | null>(Object.entries(PANEL_URLS).map(([id, src]) => [id, loadImage(src)]))
const silaImage = loadImage(silaUrl)

export function comicPanelImage(id: string): ComicImage | null {
  return panelImages.get(id) ?? null
}

export function comicSilaImage(): ComicImage | null {
  return silaImage
}

export function comicImageElements(): HTMLImageElement[] {
  const Ctor = (globalThis as { HTMLImageElement?: typeof HTMLImageElement }).HTMLImageElement
  if (!Ctor) return []
  return [...panelImages.values(), silaImage].filter((img): img is HTMLImageElement => img instanceof Ctor)
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
  const regular = new host.FontFace(COMIC_FONT, `url(${regularUrl})`, { weight: '400', style: 'normal' })
  const bold = new host.FontFace(COMIC_FONT, `url(${boldUrl})`, { weight: '700', style: 'normal' })
  fontPromise = Promise.all([regular.load(), bold.load()])
    .then((faces) => {
      for (const face of faces) host.document?.fonts.add(face)
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
  return fonts.check(`400 32px ${COMIC_FONT}`) && fonts.check(`700 32px ${COMIC_FONT}`)
}

export type ComicPrompt = 'blank' | 'line' | 'hold' | 'sila' | 'start'

/** 当前这一拍要给玩家看的东西。最后一句出完后是「开始营业」。 */
export function comicPrompt(script: OpeningScript, step: number): { prompt: ComicPrompt; beat: ComicBeat | null; page: number } {
  const cursor = comicCursor(script, step)
  if (!cursor) return { prompt: 'blank', beat: null, page: 0 }
  const page = script.pages[cursor.page]
  const beat = page?.beats[cursor.index] ?? null
  if (!beat) return { prompt: 'blank', beat: null, page: cursor.page }
  if (beat.kind === 'sila' || !beat.text) return { prompt: beat.kind === 'sila' ? 'sila' : 'hold', beat, page: cursor.page }
  const lastPage = cursor.page === script.pages.length - 1
  if (lastPage && cursor.index >= page.beats.length - 1) return { prompt: 'start', beat, page: cursor.page }
  return { prompt: 'line', beat, page: cursor.page }
}

export interface ComicCursor {
  page: number
  index: number
}

/** storyStep 0 就是第一页第一格。点一下进入下一拍，拍数用完进入教学。 */
export function comicCursor(script: OpeningScript, step: number): ComicCursor | null {
  let left = step
  for (let page = 0; page < script.pages.length; page++) {
    const count = script.pages[page].beats.length
    if (left < count) return { page, index: left }
    left -= count
  }
  return null
}

export function storyBeatCount(script: OpeningScript): number {
  return script.pages.reduce((sum, page) => sum + page.beats.length, 0)
}

export function silaVisible(script: OpeningScript, step: number): boolean {
  const cursor = comicCursor(script, step)
  if (!cursor) return false
  const beats = script.pages[cursor.page]?.beats ?? []
  return beats.slice(0, cursor.index + 1).some((beat) => beat.kind === 'sila')
}

export function silaJustShown(script: OpeningScript, before: number, after: number): boolean {
  return !silaVisible(script, before) && silaVisible(script, after)
}

export type ComicCue = 'crickets' | 'hmm' | 'snore' | 'hmph' | 'tear'
export type ComicBed = 'tense' | 'gentle'

/** 第 1、2 页用紧张古筝，第 3 页换成温柔古筝。第一步之前不响。 */
export function comicBed(script: OpeningScript, step: number): ComicBed | null {
  if (step < 1) return null
  const cursor = comicCursor(script, step)
  if (!cursor) return null
  return cursor.page >= 2 ? 'gentle' : 'tense'
}

const BREAK_AFTER = new Set(['。', '！', '？', '，', '、', '；', '：'])

/** 先在句号、问号、叹号处断行；一行放不下时再按标点切，不把一个字或一个标点单独留到下一行。 */
export function wrapComicText(text: string, maxW: number, measure: (value: string) => number): string[] {
  const clauses: string[] = []
  let clause = ''
  for (const ch of text) {
    clause += ch
    if (ch === '。' || ch === '！' || ch === '？') {
      clauses.push(clause)
      clause = ''
    }
  }
  if (clause) clauses.push(clause)
  const lines: string[] = []
  for (const piece of clauses) {
    if (measure(piece) <= maxW) {
      lines.push(piece)
      continue
    }
    let cur = ''
    const contentCount = (value: string) => [...value].filter((ch) => !BREAK_AFTER.has(ch)).length
    for (const ch of piece) {
      const next = cur + ch
      if (cur && measure(next) > maxW) {
        let nextLine = ch
        while (cur.length > 2 && contentCount(nextLine) < 2) {
          nextLine = cur.slice(-1) + nextLine
          cur = cur.slice(0, -1)
        }
        lines.push(cur)
        cur = nextLine
      } else cur = next
    }
    if (cur) lines.push(cur)
  }
  return lines.filter((line) => line.length > 0)
}

export function comicCue(script: OpeningScript, step: number): ComicCue | null {
  const cursor = comicCursor(script, step)
  if (!cursor) return null
  return script.pages[cursor.page]?.beats[cursor.index]?.cue ?? null
}
