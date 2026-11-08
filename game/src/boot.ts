import loadingBg from './assets/ui/loading_bg.jpg'
import { itemImageElements } from './itemArt'
import { orderTrayImage } from './orderTray'
import { guestImageElements } from './portraits'

function waitImage(img: HTMLImageElement): Promise<void> {
  if (img.complete) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => resolve()
    img.addEventListener('load', finish, { once: true })
    img.addEventListener('error', finish, { once: true })
    if (img.complete) finish()
  })
}

function loadUrl(src: string): HTMLImageElement {
  const img = new Image()
  img.src = src
  return img
}

export async function runBoot(canvas: HTMLCanvasElement): Promise<() => void> {
  const root = document.querySelector('#boot')
  if (!(root instanceof HTMLElement)) return () => {}
  const fill = root.querySelector('.boot-fill')
  const pct = root.querySelector('.boot-pct')
  const track = root.querySelector('.boot-track')
  const paint = (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio))
    const shown = Math.round(clamped * 100)
    if (fill instanceof HTMLElement) fill.style.width = `${shown}%`
    if (pct) pct.textContent = `${shown}%`
    if (track instanceof HTMLElement) track.setAttribute('aria-valuenow', String(shown))
  }
  const place = () => {
    const app = canvas.parentElement
    if (!app) return
    const host = app.getBoundingClientRect()
    const box = canvas.getBoundingClientRect()
    root.style.transform = 'none'
    root.style.left = `${box.left - host.left}px`
    root.style.top = `${box.top - host.top}px`
    root.style.width = `${box.width}px`
    root.style.height = `${box.height}px`
  }
  root.style.backgroundImage = `url("${loadingBg}")`
  place()
  const onResize = () => place()
  window.addEventListener('resize', onResize)
  window.visualViewport?.addEventListener('resize', onResize)
  paint(0)

  const tray = orderTrayImage()
  const images = [...itemImageElements(), ...guestImageElements(), ...(tray ? [tray] : []), loadUrl(loadingBg)]
  const total = Math.max(1, images.length)
  let done = 0
  await Promise.all(
    images.map((img) =>
      waitImage(img).then(() => {
        done += 1
        paint(done / total)
      }),
    ),
  )
  paint(1)
  await new Promise((resolve) => window.setTimeout(resolve, 140))

  return () => {
    window.removeEventListener('resize', onResize)
    window.visualViewport?.removeEventListener('resize', onResize)
    root.classList.add('is-done')
    const remove = () => root.remove()
    window.setTimeout(remove, 320)
    root.addEventListener('transitionend', remove, { once: true })
    canvas.classList.remove('is-booting')
  }
}
