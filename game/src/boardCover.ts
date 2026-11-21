import { assignArtSrc } from './artGate'
import plainUrl from './assets/board/soil_plain.png'
import stoneUrl from './assets/board/soil_stone.png'
import flowerUrl from './assets/board/soil_flower.png'
import tombUrl from './assets/board/soil_tomb.png'
import skullUrl from './assets/board/soil_skull.png'
import logUrl from './assets/board/soil_log.png'
import moundUrl from './assets/board/cover_mound.png'
import energyUrl from './assets/board/reward_energy_100.png'
import chestCatBlueUrl from './assets/board/reward_chest_cat_blue.png'
import chestBlueUrl from './assets/board/reward_chest_blue.png'
import chestWoodUrl from './assets/board/reward_chest_cat_wood.png'
import gemsUrl from './assets/board/reward_gems.png'
import badgeUrl from './assets/board/badge_exclaim.png'

/** 半遮掩棋子。新土堆从大约 61% 高度才挡住，棋子上移，露出更多。 */
export const HALF_PIECE_BOX = { x: 0.12, y: 0.02, w: 0.74, h: 0.64 }
/** 宝箱气泡右上角感叹号：左 67%、右 96%、上 5%、下 35%。 */
export const CHEST_BADGE_BOX = { x: 0.67, y: 0.05, w: 0.29, h: 0.3 }
/** 气泡奖励图，相对格子，居中。 */
export const BUBBLE_BOX = { w: 126 / 145, h: 128 / 144 }

export type SoilKind = 'plain' | 'stone' | 'flower' | 'tomb' | 'skull' | 'log'
export type BubbleArt = 'energy' | 'chestCatBlue' | 'chestBlue' | 'chestWood' | 'gems'

export interface BubbleReward {
  art: BubbleArt
  energy?: number
  gems?: number
}

const PLAIN = new Set([
  '1,1', '1,2', '1,5', '1,6', '1,7', '2,1', '2,5', '2,6', '3,2', '3,3', '3,4', '3,6', '3,7',
  '4,1', '4,3', '4,7', '5,4', '6,3', '6,4', '6,6', '6,7', '7,1', '7,7', '8,1', '8,2', '8,4',
  '8,5', '9,1', '9,2', '9,5', '9,7',
])
const STONE = new Set(['1,3', '1,4', '2,4', '5,5', '7,2'])
const FLOWER = new Set(['6,5', '7,4', '7,5', '7,6'])
const TOMB = new Set(['2,3', '2,7', '3,5', '5,1', '5,6', '5,7', '6,1', '6,2'])
const SKULL = new Set(['2,2', '3,1', '4,4', '4,5', '4,6', '8,6', '8,7', '9,6'])
const LOG = new Set(['7,3', '8,3', '9,3', '9,4'])

/** 行列从 1 起。三个宝箱都直接给 100 体力。 */
const BUBBLES: Record<string, BubbleReward> = {
  '1,1': { art: 'energy', energy: 100 },
  '1,4': { art: 'energy', energy: 100 },
  '1,7': { art: 'chestCatBlue', energy: 100 },
  '4,7': { art: 'energy', energy: 100 },
  '7,7': { art: 'gems', gems: 50 },
  '8,1': { art: 'energy', energy: 100 },
  '8,5': { art: 'energy', energy: 100 },
  '9,1': { art: 'chestBlue', energy: 100 },
  '9,4': { art: 'chestWood', energy: 100 },
  '9,7': { art: 'energy', energy: 100 },
}

function load(src: string): HTMLImageElement | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  assignArtSrc(img, src)
  return img
}

const soils: Record<SoilKind, HTMLImageElement | null> = {
  plain: load(plainUrl),
  stone: load(stoneUrl),
  flower: load(flowerUrl),
  tomb: load(tombUrl),
  skull: load(skullUrl),
  log: load(logUrl),
}
const mound = load(moundUrl)
const badge = load(badgeUrl)
const bubbles: Record<BubbleArt, HTMLImageElement | null> = {
  energy: load(energyUrl),
  chestCatBlue: load(chestCatBlueUrl),
  chestBlue: load(chestBlueUrl),
  chestWood: load(chestWoodUrl),
  gems: load(gemsUrl),
}

function key(row: number, col: number): string {
  return `${row + 1},${col + 1}`
}

/** 交接单上的泥土。表里没有的未解锁格用平土。 */
export function soilKind(row: number, col: number): SoilKind {
  const id = key(row, col)
  if (STONE.has(id)) return 'stone'
  if (FLOWER.has(id)) return 'flower'
  if (TOMB.has(id)) return 'tomb'
  if (SKULL.has(id)) return 'skull'
  if (LOG.has(id)) return 'log'
  if (PLAIN.has(id)) return 'plain'
  return 'plain'
}

export function soilImage(row: number, col: number): HTMLImageElement | null {
  return soils[soilKind(row, col)]
}

export function moundImage(): HTMLImageElement | null {
  return mound
}

export function badgeImage(): HTMLImageElement | null {
  return badge
}

/** 三个宝箱气泡格才有感叹号。 */
export function chestBubble(row: number, col: number): boolean {
  const id = key(row, col)
  return id === '1,7' || id === '9,1' || id === '9,4'
}

export function bubbleReward(row: number, col: number): BubbleReward | null {
  return BUBBLES[key(row, col)] ?? null
}

export function bubbleImage(row: number, col: number): HTMLImageElement | null {
  const reward = bubbleReward(row, col)
  return reward ? bubbles[reward.art] : null
}

export function boardCoverImages(): HTMLImageElement[] {
  const Ctor = (globalThis as { HTMLImageElement?: typeof HTMLImageElement }).HTMLImageElement
  if (!Ctor) return []
  return [...Object.values(soils), mound, badge, ...Object.values(bubbles)].filter((img): img is HTMLImageElement => img instanceof Ctor)
}
