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

export function itemSprite(line: string, level: number): (CanvasImageSource & { complete?: boolean; naturalWidth?: number }) | null {
  const img = sprites.get(`${line}:${level}`)
  if (!img) return null
  if (img.complete === false) return null
  if ((img.naturalWidth ?? 0) <= 0 && img.complete !== true) return null
  return img
}
