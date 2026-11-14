import bgUrl from './assets/hecheng/bg.webp'
import counterUrl from './assets/hecheng/counter.webp'
import plateUrl from './assets/hecheng/plate.webp'
import completeUrl from './assets/hecheng/complete.webp'
import bubbleUrl from './assets/hecheng/bubble.webp'
import boardUrl from './assets/hecheng/board.webp'
import energyUrl from './assets/hecheng/energy.webp'
import coinUrl from './assets/hecheng/coin.webp'
import gemUrl from './assets/hecheng/gem.webp'
import smileUrl from './assets/hecheng/smile.webp'
import smileFullUrl from './assets/hecheng/smile_full.webp'
import shopUrl from './assets/hecheng/shop.webp'
import badgeShopUrl from './assets/hecheng/badge_shop.webp'
import badgeSmallUrl from './assets/hecheng/badge_small.webp'
import badgeTaskUrl from './assets/hecheng/badge_task.webp'
import speed1Url from './assets/hecheng/speed_x1.webp'
import speed2Url from './assets/hecheng/speed_x2.webp'
import speed4Url from './assets/hecheng/speed_x4.webp'
import speed8Url from './assets/hecheng/speed_x8.webp'
import stashUrl from './assets/hecheng/stash.webp'
import infoUrl from './assets/hecheng/info.webp'
import buildUrl from './assets/hecheng/build.webp'
import taskFrameUrl from './assets/hecheng/task_frame.webp'
import taskIconUrl from './assets/hecheng/task_icon.webp'
import chestFrameUrl from './assets/hecheng/chest_frame.webp'
import chestIconUrl from './assets/hecheng/chest_icon.webp'
import bookUrl from './assets/hecheng/book.webp'
import avatarUrl from './assets/hecheng/avatar.webp'
import avatarFrameUrl from './assets/hecheng/avatar_frame.webp'
import levelBadgeUrl from './assets/hecheng/level_badge.webp'

export const HECHENG_ART = {
  bg: bgUrl,
  counter: counterUrl,
  plate: plateUrl,
  complete: completeUrl,
  bubble: bubbleUrl,
  board: boardUrl,
  energy: energyUrl,
  coin: coinUrl,
  gem: gemUrl,
  smile: smileUrl,
  smileFull: smileFullUrl,
  shop: shopUrl,
  badgeShop: badgeShopUrl,
  badgeSmall: badgeSmallUrl,
  badgeTask: badgeTaskUrl,
  speed1: speed1Url,
  speed2: speed2Url,
  speed4: speed4Url,
  speed8: speed8Url,
  stash: stashUrl,
  info: infoUrl,
  build: buildUrl,
  taskFrame: taskFrameUrl,
  taskIcon: taskIconUrl,
  chestFrame: chestFrameUrl,
  chestIcon: chestIconUrl,
  book: bookUrl,
  avatar: avatarUrl,
  avatarFrame: avatarFrameUrl,
  levelBadge: levelBadgeUrl,
} as const

export type HechengArtId = keyof typeof HECHENG_ART

type ArtImage = CanvasImageSource & { complete?: boolean; naturalWidth?: number; naturalHeight?: number }

function loadImage(src: string): ArtImage | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  img.src = src
  return img
}

const images = new Map<HechengArtId, ArtImage | null>(
  (Object.keys(HECHENG_ART) as HechengArtId[]).map((id) => [id, loadImage(HECHENG_ART[id])]),
)

export function hechengImage(id: HechengArtId): ArtImage | null {
  return images.get(id) ?? null
}

export function hechengImageElements(): HTMLImageElement[] {
  const Ctor = (globalThis as { HTMLImageElement?: typeof HTMLImageElement }).HTMLImageElement
  if (!Ctor) return []
  return [...images.values()].filter((img): img is HTMLImageElement => img instanceof Ctor)
}

/** x8 这一轮不进循环，图留着，以后付费档直接拿。 */
export function speedArtId(mult: number): HechengArtId {
  if (mult >= 8) return 'speed8'
  if (mult >= 4) return 'speed4'
  if (mult >= 2) return 'speed2'
  return 'speed1'
}
