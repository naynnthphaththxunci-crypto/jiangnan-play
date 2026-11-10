const raw = import.meta.glob('./assets/items/*.png', { eager: true, import: 'default' }) as Record<string, string>

const sprites = new Map<string, CanvasImageSource & { complete?: boolean; naturalWidth?: number }>()

for (const [path, url] of Object.entries(raw)) {
  const match = path.match(/([^/]+)_(\d+)\.png$/)
  if (!match || typeof url !== 'string') continue
  const host = globalThis as { Image?: new () => HTMLImageElement; document?: Document }
  if (!host.document || typeof host.Image !== 'function') continue
  const img = new host.Image()
  img.src = url
  sprites.set(`${match[1]}:${match[2]}`, img)
}

export function itemImageElements(): HTMLImageElement[] {
  const Ctor = (globalThis as { HTMLImageElement?: typeof HTMLImageElement }).HTMLImageElement
  if (!Ctor) return []
  return [...sprites.values()].filter((img): img is HTMLImageElement => img instanceof Ctor)
}

const ART_LINE: Record<string, string> = {
  food: 'food',
  meat: 'meat',
  bev: 'bev',
  mint: 'mint',
  toy: 'toy',
  wand: 'toy',
  bed: 'bed',
  fish: 'boat',
  plant: 'plant',
  coin: 'food',
  gemline: 'bev',
  net: 'boat',
  boat: 'boat',
}

type SpriteImage = CanvasImageSource & { complete?: boolean; naturalWidth?: number; naturalHeight?: number; src?: string }

const contentBoxes = new Map<string, { x: number; y: number; w: number; h: number }>()

/** 按不透明像素的实际边界，而不是 256 画布。测不到时先当内容占画布约八成。 */
export function spriteContent(img: SpriteImage | null): { x: number; y: number; w: number; h: number } {
  const fallback = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
  if (!img) return fallback
  const key = img.src || ''
  const cached = key ? contentBoxes.get(key) : undefined
  if (cached) return cached
  const width = img.naturalWidth || 0
  const height = img.naturalHeight || 0
  if (!width || !height || img.complete === false) return fallback
  const host = globalThis as { document?: Document }
  if (!host.document) return fallback
  try {
    const canvas = host.document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return fallback
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
    if (maxX <= minX || maxY <= minY) return fallback
    const box = {
      x: minX / width,
      y: minY / height,
      w: (maxX - minX) / width,
      h: (maxY - minY) / height,
    }
    if (key) contentBoxes.set(key, box)
    return box
  } catch {
    return fallback
  }
}

function usable(img: (CanvasImageSource & { complete?: boolean; naturalWidth?: number }) | undefined) {
  if (!img) return false
  if (img.complete === false) return false
  if ((img.naturalWidth ?? 0) <= 0 && img.complete !== true) return false
  return true
}

/** 新链还没有专属图，先借用现有图。名字只在详情栏里写。 */
export function itemSprite(line: string, level: number): (CanvasImageSource & { complete?: boolean; naturalWidth?: number }) | null {
  const mapped = ART_LINE[line] ?? 'food'
  const exact = sprites.get(`${mapped}:${level}`)
  if (usable(exact)) return exact ?? null
  for (let step = 1; step <= 11; step++) {
    const lower = sprites.get(`${mapped}:${level - step}`)
    if (usable(lower)) return lower ?? null
    const higher = sprites.get(`${mapped}:${level + step}`)
    if (usable(higher)) return higher ?? null
  }
  for (const [key, img] of sprites) {
    if (key.startsWith(`${mapped}:`) && usable(img)) return img
  }
  return null
}
