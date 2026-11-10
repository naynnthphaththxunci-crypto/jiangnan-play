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
