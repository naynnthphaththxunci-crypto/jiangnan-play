import table from './data/balance1120.json'
import type { GameConfig, Item, LevelRewardEntry, ProducerDef } from './types'

export interface BalanceOrderItem {
  line: string
  level: number
  name: string
}

export interface BalanceOrder {
  no: number
  items: BalanceOrderItem[]
  coins: number
  smile: number
  smileTiming: string
  maxOnScreen: number
  flags: string[]
}

export interface BalanceStory {
  no: number
  cost: number
  xp: number
  type: 'dialogue' | 'build'
  hasReward: boolean
  reward: unknown
  levelUpTo: number | null
  src: string
}

export interface BalanceCell {
  cell: string
  type: 'producer' | 'item' | 'coin'
  id?: string
  line?: string
  level: number
  name: string
  cover: 'open' | 'half' | 'closed'
}

interface BalanceFile {
  lines: Record<string, { name: string; maxLevel: number; levels: { level: number; name: string; orderable: boolean; price: number | null }[] }>
  producers: {
    id: string
    name: string
    type: string
    levels: number
    produceFrom: number
    drop: unknown
    cooldown: unknown
  }[]
  ordersEarly: BalanceOrder[]
  stories: BalanceStory[]
  storyXp: number
  levels: { level: number; xp: number; reward?: string }[]
  smileRounds: { round: number; target: number }[]
  openingBoard: BalanceCell[]
  resources: { coin: number[]; gem: number[]; energy: number[] }
  startCoins: string
  ordersLate: {
    maxOnScreen: number
    foodDrinkShare: number
    itemsPerOrder: Record<string, number>
    blockFromLevel: number
  }
}

export const BALANCE = table as unknown as BalanceFile

/** JSON 母棋 id 到现有代码 id。渔网沿用 boat，渔货沿用 net。 */
export const PRODUCER_ID: Record<string, string> = {
  p_food: 'food',
  p_bev: 'bev',
  p_toy: 'toy',
  p_bed: 'bed',
  p_net: 'boat',
  p_catch: 'net',
  p_plant: 'plant',
  p_dog: 'dog',
}

const LINE_OF_PRODUCER: Record<string, string> = {
  food: 'food',
  bev: 'bev',
  toy: 'toy',
  bed: 'bed',
  boat: 'fish',
  net: 'fish',
  plant: 'plant',
  dog: 'dog',
}

export function earlyOrder(no: number): BalanceOrder | null {
  return BALANCE.ordersEarly.find((order) => order.no === no) ?? null
}

export function storyDef(no: number): BalanceStory | null {
  return BALANCE.stories.find((story) => story.no === no) ?? null
}

export function cellPos(cell: string): { col: number; row: number } {
  const col = cell.charCodeAt(0) - 'a'.charCodeAt(0)
  const row = Number(cell.slice(1)) - 1
  return { col, row }
}

const SIDE: Record<string, { side: string; from: number }> = {
  food: { side: 'meat', from: 5 },
  bev: { side: 'mint', from: 5 },
  toy: { side: 'wand', from: 6 },
}

function asDropRows(drop: unknown, producers: BalanceFile['producers']): ProducerDef['drops'] {
  if (typeof drop === 'string') {
    const food = producers.find((entry) => entry.id === 'p_food')
    return asDropRows(food?.drop, producers)
  }
  if (!Array.isArray(drop)) return undefined
  return drop
    .filter((row): row is Record<string, number> => !!row && typeof row === 'object' && 'level' in row && ('e1' in row || 'catch1' in row))
    .map((row) => ({
      level: row.level ?? 0,
      hard: row.hard ?? 0,
      e1: row.e1 ?? 0,
      e2: row.e2 ?? 0,
      e3: row.e3 ?? 0,
      rare: row.rare ?? 0,
      catch1: row.catch1,
      catch2: row.catch2,
      catch3: row.catch3,
    }))
}

function asBursts(drop: unknown): ProducerDef['bursts'] {
  if (!Array.isArray(drop)) return undefined
  const rows = drop.filter((row): row is { level: number; items: number; cooldownMin?: number } => !!row && typeof row === 'object' && 'items' in row)
  if (!rows.length) return undefined
  return rows.map((row) => ({ level: row.level, items: row.items, cooldownMin: row.cooldownMin ?? 0 }))
}

function asCooldown(cooldown: unknown): ProducerDef['tapCooldown'] {
  if (!cooldown || typeof cooldown !== 'object' || !('tapsPerRound' in cooldown)) return null
  const row = cooldown as { tapsPerRound?: number[]; cooldownSec?: number[] }
  const taps = row.tapsPerRound ?? [1, 1]
  const seconds = row.cooldownSec ?? [0, 0]
  return { taps: [taps[0] ?? 1, taps[1] ?? taps[0] ?? 1], seconds: [seconds[0] ?? 0, seconds[1] ?? seconds[0] ?? 0] }
}

export function applyBalance(cfg: GameConfig): void {
  cfg.economy.xpPerTask = BALANCE.storyXp
  cfg.economy.orderXp = 0
  cfg.economy.startCoins = 0
  cfg.economy.levelTaskThresholds = BALANCE.levels.map((level) => level.xp)
  cfg.economy.producerMaxLevel = 11
  cfg.economy.speed4Level = 10
  cfg.economy.foodDrinkShare = BALANCE.ordersLate.foodDrinkShare
  cfg.economy.blockFromLevel = BALANCE.ordersLate.blockFromLevel
  cfg.economy.producerCooldownOn = 0
  cfg.economy.smileGoal = BALANCE.smileRounds[0]?.target ?? 6
  cfg.economy.giftCooldownMs = 120_000
  cfg.orders.maxActive = BALANCE.ordersLate.maxOnScreen
  cfg.economy.newbieChest = [100, 40, 15, 2, 2]
  cfg.economy.newbieChestFixed = true
  cfg.economy.newbieChestCount = 1
  cfg.economy.chestWeights = [
    { energy: 2, weight: 40 },
    { energy: 6, weight: 20 },
    { energy: 15, weight: 20 },
    { energy: 40, weight: 20 },
  ]
  cfg.economy.levelRewards = BALANCE.levels.map((level) => ({
    level: level.level,
    rewards: parseRewardText(level.reward ?? ''),
  }))
  const energy = BALANCE.resources.energy
  cfg.items.potions = energy.map((amount, index) => ({
    tier: index + 1,
    name: `体力${index + 1}`,
    energy: amount,
  }))
  cfg.items.gems = BALANCE.resources.gem.map((amount, index) => ({
    tier: index + 1,
    name: `钻石${index + 1}`,
    amount,
  }))
  for (const [id, line] of Object.entries(BALANCE.lines)) {
    let target = cfg.items.lines.find((entry) => entry.id === id)
    if (!target) {
      target = { id, name: line.name, color: '#8a6a4a', levels: [] }
      cfg.items.lines.push(target)
    }
    target.name = line.name
    target.levels = line.levels.map((level) => ({
      level: level.level,
      name: level.name,
      orderable: level.orderable,
      coins: level.price ?? 0,
    }))
  }
  const coin = cfg.items.lines.find((entry) => entry.id === 'coin')
  if (coin) {
    coin.collect = 'coin'
    coin.levels = BALANCE.resources.coin.map((amount, index) => ({
      level: index + 1,
      name: `金币${index + 1}`,
      orderable: false,
      coins: amount,
    }))
  }
  for (const spec of BALANCE.producers) {
    const id = PRODUCER_ID[spec.id] ?? spec.id
    let def = cfg.producers.find((entry) => entry.id === id)
    const kind = spec.type === 'cooldown' ? 'plant' : spec.id === 'p_catch' ? 'consumable' : spec.id === 'p_net' ? 'netSource' : 'normal'
    if (!def) {
      def = { id, name: spec.name, line: LINE_OF_PRODUCER[id] ?? 'food', grant: 'never', kind }
      cfg.producers.push(def)
    }
    def.name = spec.name
    def.kind = kind
    def.maxLevel = spec.levels
    def.produceFrom = spec.produceFrom
    const side = SIDE[id]
    if (side) {
      def.side = side.side
      def.sideFrom = side.from
    }
    def.drops = asDropRows(spec.drop, BALANCE.producers)
    def.bursts = spec.id === 'p_catch'
      ? [{ level: spec.produceFrom, items: (spec.drop as { items?: number })?.items ?? 12, cooldownMin: 0 }]
      : asBursts(spec.drop)
    def.tapCooldown = asCooldown(spec.cooldown)
  }
  cfg.buildings.steps = [
    {
      id: 'story',
      name: '剧情',
      tasks: BALANCE.stories.map((story) => ({
        id: `s${story.no}`,
        name: `剧情 ${story.no}`,
        price: story.cost,
        part: 'sign',
      })),
    },
  ]
}

export function producerCode(jsonId: string): string {
  return PRODUCER_ID[jsonId] ?? jsonId
}

export function asProducer(def: ProducerDef): ProducerDef {
  return def
}

export function coinItemLevel(amount: number): number {
  const index = BALANCE.resources.coin.indexOf(amount)
  return index >= 0 ? index + 1 : 1
}

export function isDog(item: Item): boolean {
  return (item.kind === 'product' && item.line === 'dog') || (item.kind === 'producer' && item.producerId === 'dog')
}

export function unitPrice(line: string, level: number): number {
  const row = BALANCE.lines[line]?.levels.find((entry) => entry.level === level)
  return row?.price ?? 0
}

const PRODUCER_NAMES: Record<string, string> = {
  猫粮母棋: 'food',
  饮料母棋: 'bev',
  玩具母棋: 'toy',
  猫窝母棋: 'bed',
  花盆母棋: 'plant',
  渔网母棋: 'boat',
  渔货: 'net',
  狗窝: 'dog',
}

function splitRewardParts(text: string): string[] {
  const parts: string[] = []
  let buf = ''
  let depth = 0
  for (const ch of text) {
    if (ch === '（' || ch === '(') depth += 1
    if ((ch === '）' || ch === ')') && depth > 0) depth -= 1
    if (depth === 0 && (ch === '；' || ch === ';' || ch === '、')) {
      if (buf.trim()) parts.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

/** 把剧情和升级奖励里的原文拆成能发放的条目。认不出的句子仍保留名字。 */
export function parseRewardText(text: string): LevelRewardEntry[] {
  const parts = splitRewardParts(text)
  const out: LevelRewardEntry[] = []
  for (const part of parts) {
    if (/不做|开启|商店|卡牌|每日|弹窗/.test(part) && !/钻石|体力|母棋|宝箱|渔货|狗窝/.test(part)) continue
    const gems = part.match(/钻石\s*×?\s*(\d+)/)
    if (gems && !part.includes('宝箱')) {
      out.push({ id: 'pack', name: part, gems: Number(gems[1]) })
      continue
    }
    const energy = part.match(/体力\s*(\d+)/)
    if (energy && !part.includes('宝箱')) {
      out.push({ id: 'energy', name: part, energy: Number(energy[1]) })
      continue
    }
    if (/宝箱|礼盒|补给箱|存钱罐/.test(part)) {
      const count = Number(part.match(/×\s*(\d+)/)?.[1] ?? 1)
      for (let i = 0; i < count; i++) out.push({ id: 'chest', name: part.replace(/×\s*\d+/, '').trim() })
      continue
    }
    const producer = part.match(/(猫粮母棋|饮料母棋|玩具母棋|猫窝母棋|花盆母棋|渔网母棋|渔货|狗窝)\s*(\d+)?/)
    if (producer) {
      const id = PRODUCER_NAMES[producer[1] ?? ''] ?? 'food'
      const level = Number(producer[2] ?? 1)
      const count = Number(part.match(/×\s*(\d+)/)?.[1] ?? 1)
      for (let i = 0; i < count; i++) out.push({ id, name: part, producerLevel: level })
      continue
    }
    out.push({ id: 'note', name: part })
  }
  return out.length ? out : text ? [{ id: 'note', name: text.slice(0, 28) }] : []
}
