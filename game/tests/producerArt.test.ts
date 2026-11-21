import { describe, expect, it } from 'vitest'
import cells from '../src/data/boardCells.json'
import { producerBoltPlace, producerPieceName, producerPlace, PRODUCER_CELL_W } from '../src/itemArt'
import { createGame, infoCaption, makeProducer, producerTapCostsEnergy } from '../src/logic/sim'
import { defaultConfig } from '../src/config'

const layout = [
  { line: 'food', level: 1, bbox: [75, 780, 162, 875] },
  { line: 'food', level: 4, bbox: [495, 776, 594, 879] },
  { line: 'food', level: 12, bbox: [622, 905, 743, 1035] },
  { line: 'bev', level: 1, bbox: [784, 937, 866, 1010] },
  { line: 'bev', level: 8, bbox: [768, 1053, 886, 1170] },
  { line: 'bev', level: 9, bbox: [902, 1040, 1026, 1172] },
  { line: 'bev', level: 12, bbox: [337, 1186, 468, 1321] },
] as const

function cellOf(bbox: readonly [number, number, number, number]) {
  const cx = (bbox[0] + bbox[2]) / 2
  const cy = (bbox[1] + bbox[3]) / 2
  const found = (cells as number[][]).find((cell) => cx >= cell[0]! - 2 && cx <= cell[0]! + cell[2]! + 2 && cy >= cell[1]! - 2 && cy <= cell[1]! + cell[3]! + 2)
  if (!found) throw new Error(`no cell for ${bbox.join(',')}`)
  return found
}

describe('母棋新图位置', () => {
  it('偏移按 PSD 格子左上角算，再按格子宽 139 等比', () => {
    expect(PRODUCER_CELL_W).toBe(139)
    for (const item of layout) {
      const cell = cellOf(item.bbox)
      const place = producerPlace(item.line, item.level)
      expect(place).toEqual({
        x: item.bbox[0] - cell[0]!,
        y: item.bbox[1] - cell[1]!,
        w: item.bbox[2] - item.bbox[0],
        h: item.bbox[3] - item.bbox[1],
      })
    }
    expect(producerBoltPlace()).toEqual({ x: 107, y: 94, w: 30, h: 44 })
  })

  it('定稿名按等级，4 级起才扣体力', () => {
    expect(producerPieceName('food', 1)).toBe('小纸袋')
    expect(producerPieceName('food', 12)).toBe('满满肉柜')
    expect(producerPieceName('bev', 5)).toBe('猫薄荷茶盘')
    expect(producerPieceName('bev', 6)).toBe('竹提篮')
    expect(producerPieceName('bev', 8)).toBe('小茶几')
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    const low = makeProducer(state, 'food', cfg, 3)
    const high = makeProducer(state, 'bev', cfg, 4)
    expect(producerTapCostsEnergy(cfg, low)).toBe(false)
    expect(producerTapCostsEnergy(cfg, high)).toBe(true)
    expect(infoCaption(cfg, high).title).toBe('紫砂壶')
    const plant = makeProducer(state, 'plant', cfg, 6)
    expect(producerTapCostsEnergy(cfg, plant)).toBe(false)
  })
})
