import { assignArtSrc } from './artGate'
import mapUrl from './assets/home/map.webp'
import settingsUrl from './assets/home/btn_settings.webp'
import shopUrl from './assets/home/btn_shop.webp'
import storageUrl from './assets/home/btn_storage.webp'
import buildUrl from './assets/home/btn_build.webp'
import badgeUrl from './assets/home/badge_alert.webp'
import menuUrl from './assets/home/settings_menu.webp'
import arrowUrl from './assets/home/arrow_build.webp'
import home1 from './assets/home/dlg_home_01.webp'
import home2 from './assets/home/dlg_home_02.webp'
import home3 from './assets/home/dlg_home_03.webp'
import tut1 from './assets/home/dlg_tut_01.webp'
import tut2 from './assets/home/dlg_tut_02.webp'
import tut3 from './assets/home/dlg_tut_03.webp'
import tut4 from './assets/home/dlg_tut_04.webp'
import tut5 from './assets/home/dlg_tut_05.webp'
import tut6 from './assets/home/dlg_tut_06.webp'

function load(src: string): HTMLImageElement | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  assignArtSrc(img, src)
  return img
}

export const homeArt = {
  map: load(mapUrl),
  settings: load(settingsUrl),
  shop: load(shopUrl),
  storage: load(storageUrl),
  build: load(buildUrl),
  badge: load(badgeUrl),
  menu: load(menuUrl),
  arrow: load(arrowUrl),
  home1: load(home1),
  home2: load(home2),
  home3: load(home3),
  tut1: load(tut1),
  tut2: load(tut2),
  tut3: load(tut3),
  tut4: load(tut4),
  tut5: load(tut5),
  tut6: load(tut6),
}

export type HomeArtId = keyof typeof homeArt
