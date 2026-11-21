import { assignArtSrc } from './artGate'
import layoutJson from './data/orderCastLayout.json'

export const ORDER_CAST_IDS = ['ghost', 'mengpo', 'xiaotao', 'liuyan', 'jin', 'zhongkui', 'ajiang'] as const

const NAMES: Record<(typeof ORDER_CAST_IDS)[number], string> = {
  ghost: '勾魂小鬼',
  mengpo: '孟婆',
  xiaotao: '小桃',
  liuyan: '柳砚',
  jin: '金老爷',
  zhongkui: '钟馗',
  ajiang: '阿桨',
}

const PLATE_W = 294
const FPS = 15

interface LayoutRow {
  canvas: [number, number]
  scale: number
  canvas_rel_plate: [number, number]
}

interface AnimMeta {
  character: string
  animation: string
  image: string
  frame_width: number
  frame_height: number
  frame_count: number
  columns: number
  rows: number
  fps_suggested: number
  original_canvas: [number, number]
  crop: { x: number; y: number; width: number; height: number }
}

interface Anim {
  meta: AnimMeta
  image: HTMLImageElement | null
}

const layout = layoutJson as unknown as Record<string, LayoutRow>
const pngUrls = import.meta.glob('./assets/order-cast/*.png', { eager: true, import: 'default' }) as Record<string, string>
const jsonMods = import.meta.glob('./assets/order-cast/*.json', { eager: true }) as Record<string, { default: AnimMeta }>

function load(src: string): HTMLImageElement | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  assignArtSrc(img, src)
  return img
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path
}

const images = new Map<string, HTMLImageElement | null>()
for (const [path, url] of Object.entries(pngUrls)) images.set(fileName(path), load(url))

const anims = new Map<string, Anim>()
for (const mod of Object.values(jsonMods)) {
  const meta = mod.default
  anims.set(`${meta.character}:${meta.animation}`, { meta, image: images.get(meta.image) ?? null })
}

export function pickOrderCast(roll: number): string {
  const n = ORDER_CAST_IDS.length
  const index = Math.min(n - 1, Math.max(0, Math.floor(roll * n)))
  return ORDER_CAST_IDS[index] ?? ORDER_CAST_IDS[0]
}

export function orderCastImages(): HTMLImageElement[] {
  const Ctor = (globalThis as { HTMLImageElement?: typeof HTMLImageElement }).HTMLImageElement
  if (!Ctor) return []
  return [...images.values()].filter((img): img is HTMLImageElement => img instanceof Ctor)
}

export function orderGuestFrame(id: string, now: number, startedAt: number): { anim: '出场' | '待机'; index: number } | null {
  const name = NAMES[id as (typeof ORDER_CAST_IDS)[number]]
  if (!name) return null
  const enter = anims.get(`${name}:出场`)
  if (!enter) return null
  const frameMs = 1000 / (enter.meta.fps_suggested || FPS)
  const enterMs = enter.meta.frame_count * frameMs
  const age = Math.max(0, now - startedAt)
  if (age < enterMs) {
    return { anim: '出场', index: Math.min(enter.meta.frame_count - 1, Math.floor(age / frameMs)) }
  }
  const idle = anims.get(`${name}:待机`)
  if (!idle) return { anim: '出场', index: enter.meta.frame_count - 1 }
  const idleMs = idle.meta.frame_count * (1000 / (idle.meta.fps_suggested || FPS))
  return { anim: '待机', index: Math.floor((age - enterMs) % idleMs / (1000 / (idle.meta.fps_suggested || FPS))) }
}

/** 帧在游戏里的矩形。先回到原画布，再按柜台宽相对 294 摆。 */
export function orderGuestRect(id: string, plate: { x: number; y: number; w: number; h: number }, animName: '出场' | '待机'): { x: number; y: number; w: number; h: number } | null {
  const name = NAMES[id as (typeof ORDER_CAST_IDS)[number]]
  const row = name ? layout[name] : undefined
  const anim = name ? anims.get(`${name}:${animName}`) : undefined
  if (!row || !anim) return null
  const k = plate.w / PLATE_W
  const canvasW = row.canvas[0] * row.scale * k
  const canvasH = row.canvas[1] * row.scale * k
  const canvasX = plate.x + row.canvas_rel_plate[0] * k
  const canvasY = plate.y + row.canvas_rel_plate[1] * k
  const crop = anim.meta.crop
  return {
    x: canvasX + (crop.x / row.canvas[0]) * canvasW,
    y: canvasY + (crop.y / row.canvas[1]) * canvasH,
    w: (crop.width / row.canvas[0]) * canvasW,
    h: (crop.height / row.canvas[1]) * canvasH,
  }
}

export function drawOrderGuest(
  ctx: CanvasRenderingContext2D,
  id: string,
  plate: { x: number; y: number; w: number; h: number },
  now: number,
  startedAt: number,
): boolean {
  const frame = orderGuestFrame(id, now, startedAt)
  if (!frame) return false
  const name = NAMES[id as (typeof ORDER_CAST_IDS)[number]]
  const anim = name ? anims.get(`${name}:${frame.anim}`) : undefined
  const dest = orderGuestRect(id, plate, frame.anim)
  const img = anim?.image
  if (!anim || !dest || !img || (img.naturalWidth || 0) <= 0) return false
  const col = frame.index % anim.meta.columns
  const row = Math.floor(frame.index / anim.meta.columns)
  ctx.drawImage(
    img,
    col * anim.meta.frame_width,
    row * anim.meta.frame_height,
    anim.meta.frame_width,
    anim.meta.frame_height,
    dest.x,
    dest.y,
    dest.w,
    dest.h,
  )
  return true
}
