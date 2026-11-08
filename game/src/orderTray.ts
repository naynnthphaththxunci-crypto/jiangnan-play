import src from './assets/ui/order_tray.png'

let image: HTMLImageElement | null = null

export function orderTrayImage(): HTMLImageElement | null {
  const host = globalThis as { Image?: new () => HTMLImageElement; document?: Document }
  if (!host.document || typeof host.Image !== 'function') return null
  if (!image) {
    image = new host.Image()
    image.src = src
  }
  return image
}
