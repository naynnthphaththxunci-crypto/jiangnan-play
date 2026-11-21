import loadingBg from './assets/ui/loading_bg.jpg'
import { releaseArt } from './artGate'
import { itemImageElements } from './itemArt'
import { orderTrayImage } from './orderTray'
import { guestImageElements } from './portraits'
import { comicImageElements, loadComicFont } from './comic'
import { hechengImageElements } from './hechengArt'
import { castImageElements } from './cast'
import { homeArt } from './homeArt'
import { curtainBitmaps } from './curtain'
import { boardCoverImages } from './boardCover'
import { orderCastImages } from './orderCast'

function waitImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve()
  return new Promise((resolve) => {
    const finish = () => resolve()
    img.addEventListener('load', finish, { once: true })
    img.addEventListener('error', finish, { once: true })
    if (img.complete && img.naturalWidth > 0) finish()
  })
}

function loadUrl(src: string): HTMLImageElement {
  const img = new Image()
  img.src = src
  return img
}

function listed(images: Array<HTMLImageElement | null | undefined>): HTMLImageElement[] {
  const Ctor = (globalThis as { HTMLImageElement?: typeof HTMLImageElement }).HTMLImageElement
  if (!Ctor) return []
  return images.filter((img): img is HTMLImageElement => img instanceof Ctor)
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
    const box = canvas.getBoundingClientRect()
    root.style.transform = 'none'
    root.style.left = `${box.left}px`
    root.style.top = `${box.top}px`
    root.style.width = `${box.width}px`
    root.style.height = `${box.height}px`
  }
  root.style.backgroundImage = `url("${loadingBg}")`
  root.style.backgroundSize = 'cover'
  root.style.backgroundPosition = 'center center'
  root.style.backgroundRepeat = 'no-repeat'
  place()
  const onResize = () => place()
  window.addEventListener('resize', onResize)
  window.visualViewport?.addEventListener('resize', onResize)
  paint(0)

  // 背景先单独加载并显示，再放开其它图。
  await waitImage(loadUrl(loadingBg))
  releaseArt()

  const curtain = curtainBitmaps()
  const tray = orderTrayImage()
  const images = [
    ...itemImageElements(),
    ...guestImageElements(),
    ...castImageElements(),
    ...comicImageElements(),
    ...hechengImageElements(),
    ...listed(Object.values(homeArt)),
    ...boardCoverImages(),
    ...orderCastImages(),
    ...listed([curtain.curtain as HTMLImageElement | null, curtain.front as HTMLImageElement | null]),
    ...(tray ? [tray] : []),
  ]
  const fontReady = loadComicFont()
  const total = Math.max(1, images.length + 1)
  let done = 0
  const tick = () => {
    done += 1
    paint(done / total)
  }
  await Promise.all([...images.map((img) => waitImage(img).then(tick)), fontReady.then(tick)])
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
