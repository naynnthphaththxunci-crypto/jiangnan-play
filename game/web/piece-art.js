import { assets as suppliedItemAssets, placements as suppliedItems } from './piece-items.js?v=1'
import { assets as suppliedProducerAssets, placements as suppliedProducers } from './piece-producers.js?v=1'

export { suppliedItemAssets, suppliedItems, suppliedProducerAssets, suppliedProducers }

export const suppliedLineNames = {
  food: '亡魂档案',
  meat: '阳间遗物',
  bev: '安魂茶',
  mint: '孟婆汤',
  toy: '纸扎家具',
  wand: '纸扎玩意',
  bed: '引魂莲',
  plant: '守夜果',
  fish: '糯米供食',
}

const levels = [...Object.values(suppliedItems), ...Object.values(suppliedProducers)]
export const suppliedPlacementSet = new Set(levels.flatMap(chain => Object.values(chain)))

export function pieceRect(box, placement, legacyCellWidth) {
  const scale = suppliedPlacementSet.has(placement) ? box.w : box.w / legacyCellWidth
  return {
    x: box.x + placement.x * scale,
    y: box.y + placement.y * scale,
    w: placement.w * scale,
    h: placement.h * scale,
  }
}
