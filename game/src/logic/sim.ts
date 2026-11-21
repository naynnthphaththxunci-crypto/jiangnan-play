import type {
  ActionResult,
  CellLock,
  GameConfig,
  GameEvent,
  GameState,
  Item,
  LevelRewardEntry,
  LootDrop,
  Order,
  Pos,
  ProducerItem,
  Rng,
  TaskDef,
} from '../types'
import { COLS, ROWS } from '../types'
import { formatMs } from '../format'
import { producerPieceName } from '../itemArt'
import openingBoard from '../data/openingBoard.json'
import { BALANCE, earlyOrder, levelGiftText, parseLevelGift, parseRewardText, smileRoundReward, smileRoundTarget, storyDef, storyNote, unitPrice } from '../balance1120'

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dayKey(now: number): string {
  const d = new Date(now)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function dayNumber(first: string, today: string): number {
  const a = Date.parse(`${first}T00:00:00`)
  const b = Date.parse(`${today}T00:00:00`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1
  return Math.floor((b - a) / 86400000) + 1
}

export function eachCell(
  board: (Item | null)[][],
  fn: (item: Item | null, row: number, col: number) => void,
): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) fn(board[r][c], r, c)
  }
}

export function inBoard(row: number, col: number): boolean {
  return row >= 0 && col >= 0 && row < ROWS && col < COLS
}

export interface Occupied {
  row: number
  col: number
  item: Item
}

export function occupied(state: GameState): Occupied[] {
  const out: Occupied[] = []
  eachCell(state.board, (item, row, col) => {
    if (item) out.push({ row, col, item })
  })
  return out
}

function emptyBoard(): (Item | null)[][] {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null))
}

function nextUid(state: GameState, prefix: string): string {
  state.idCounter += 1
  return `${prefix}${state.idCounter}`
}

export function makeProduct(state: GameState, line: string, level: number): Item {
  return { uid: nextUid(state, 'i'), kind: 'product', line, level }
}

export function makeProducer(state: GameState, id: string, cfg: GameConfig, level = 1): ProducerItem {
  const def = cfg.producers.find((p) => p.id === id)
  const kind = def?.kind ?? 'normal'
  const burst = def?.bursts?.find((row) => row.level === level)
  let charges = chargesForLevel(cfg, level)
  if (kind === 'consumable') charges = burst?.items ?? cfg.economy.consumableTaps ?? 12
  else if (burst) charges = level >= (def?.produceFrom ?? 1) ? burst.items : 0
  else if (def?.tapCooldown) charges = def.tapCooldown.taps[0]
  else if (kind === 'normal' && !(cfg.economy.producerCooldownOn > 0)) charges = 999
  if (kind === 'plant' && !burst) charges = level >= (def?.produceFrom ?? cfg.economy.plantOutputLevel ?? 6) ? (cfg.economy.plantBurst ?? 8) : 0
  const item: ProducerItem = {
    uid: nextUid(state, 'p'),
    kind: 'producer',
    producerId: id,
    line: def?.line ?? id,
    level,
    charges,
    cooldownUntil: 0,
  }
  noteProducer(state, id, level)
  return item
}

function noteProducer(state: GameState, id: string, level: number): void {
  const seen = state.producerSeen[id] ?? []
  if (!seen.includes(level)) seen.push(level)
  state.producerSeen[id] = seen
}

export function makePotion(state: GameState, tier: number): Item {
  return { uid: nextUid(state, 'b'), kind: 'potion', tier }
}

export function makeGem(state: GameState, tier: number): Item {
  return { uid: nextUid(state, 'd'), kind: 'gem', tier }
}

export function chargesForLevel(cfg: GameConfig, level: number): number {
  const start = cfg.economy.producerOutputLevel ?? 4
  if (level < start) return 0
  const base = cfg.economy.producerRoundBase ?? 200
  const step = cfg.economy.producerRoundStep ?? 40
  return base + (level - start) * step
}

export function producerCap(cfg: GameConfig, id: string): number {
  if (id === 'net') return cfg.economy.netMaxLevel ?? 5
  const def = cfg.producers.find((entry) => entry.id === id)
  return def?.maxLevel ?? cfg.economy.producerMaxLevel ?? 10
}

export function inProducerGrace(state: GameState, cfg: GameConfig): boolean {
  return state.playedMs < (cfg.economy.producerGraceMs ?? 0)
}

export function gemAmount(cfg: GameConfig, tier: number): number {
  return cfg.items.gems.find((gem) => gem.tier === tier)?.amount ?? 0
}

export function gemName(cfg: GameConfig, tier: number): string {
  return cfg.items.gems.find((gem) => gem.tier === tier)?.name ?? '宝石'
}

export function gemEnergyPrice(cfg: GameConfig, buys: number): number {
  const prices = cfg.economy.energyGemPrices ?? [0]
  const index = Math.min(Math.max(0, buys), Math.max(0, prices.length - 1))
  return prices[index] ?? 0
}

export function makeChest(state: GameState): Item {
  return { uid: nextUid(state, 'c'), kind: 'chest', box: 'energy' }
}

export function productName(cfg: GameConfig, line: string, level: number): string {
  const def = cfg.items.lines.find((l) => l.id === line)
  return def?.levels.find((lv) => lv.level === level)?.name ?? ''
}

export function lineColor(cfg: GameConfig, line: string): string {
  return cfg.items.lines.find((l) => l.id === line)?.color ?? '#888888'
}

export function coinOf(cfg: GameConfig, line: string, level: number): number {
  const def = cfg.items.lines.find((l) => l.id === line)
  return def?.levels.find((lv) => lv.level === level)?.coins ?? 0
}

export function potionEnergy(cfg: GameConfig, tier: number): number {
  return cfg.items.potions.find((p) => p.tier === tier)?.energy ?? 0
}

export function potionName(cfg: GameConfig, tier: number): string {
  return cfg.items.potions.find((p) => p.tier === tier)?.name ?? '体力瓶'
}

export function tierForEnergy(cfg: GameConfig, energy: number): number {
  return cfg.items.potions.find((p) => p.energy === energy)?.tier ?? 1
}

export function makeEnergyPotion(state: GameState, cfg: GameConfig, energy: number): Item {
  const known = cfg.items.potions.find((potion) => potion.energy === energy)
  if (known) return makePotion(state, known.tier)
  return { uid: nextUid(state, 'p'), kind: 'potion', tier: tierForEnergy(cfg, energy), energy }
}

export function bottleEnergy(cfg: GameConfig, item: { tier: number; energy?: number }): number {
  return item.energy ?? potionEnergy(cfg, item.tier)
}

export function producerName(cfg: GameConfig, id: string): string {
  return cfg.producers.find((p) => p.id === id)?.name ?? '母棋'
}

export function characterName(cfg: GameConfig, id: string): string {
  return cfg.characters.find((c) => c.id === id)?.name ?? id
}

function talkOf(cfg: GameConfig, customerId: string, big: boolean): string {
  const line = cfg.orders.talk[customerId]
  if (!line) return ''
  return big ? line.big : line.normal
}

export function lockAt(state: GameState, row: number, col: number): CellLock | undefined {
  return state.locks.find((lock) => lock.row === row && lock.col === col)
}

export function isHalfLock(lock: CellLock): boolean {
  return lock.cover === 'gift' || lock.veil !== 'full'
}

function placeBuried(state: GameState, cfg: GameConfig, lock: CellLock): void {
  const buried = lock.buried
  let item: Item | null = null
  if (buried.kind === 'producer') item = makeProducer(state, buried.id, cfg, buried.level)
  else if (buried.kind === 'product') item = makeProduct(state, buried.line, buried.level)
  else if (buried.kind === 'potion') item = makePotion(state, buried.tier)
  else if (buried.kind === 'gem') item = makeGem(state, buried.tier)
  state.board[lock.row][lock.col] = item
  if (item?.kind === 'product') noteUnlock(state, item.line, item.level)
  if (item?.kind === 'producer') state.hasProducer[item.producerId] = true
}

function grantPrize(state: GameState, _cfg: GameConfig, lock: CellLock): void {
  const prize = lock.prize
  if (!prize) return
  if (prize.energy) state.energy += prize.energy
  if (prize.coins) state.coins += prize.coins
  if (prize.gems) state.gems += prize.gems
  if (prize.chest) queueReward(state, makeChest(state))
}

function openRewardLock(state: GameState, cfg: GameConfig, lock: CellLock): void {
  grantPrize(state, cfg, lock)
  placeBuried(state, cfg, lock)
  state.locks = state.locks.filter((entry) => entry !== lock)
}

function revealAround(state: GameState, row: number, col: number, cfg?: GameConfig): void {
  if (row === 4 && col === 2) {
    for (const [r, c] of [
      [3, 3],
      [5, 3],
      [4, 4],
    ]) {
      const extra = lockAt(state, r, c)
      if (extra && extra.veil === 'full' && extra.cover !== 'gift') extra.veil = 'half'
    }
  }
  const near = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const [dr, dc] of near) {
    const lock = lockAt(state, row + (dr ?? 0), col + (dc ?? 0))
    if (!lock || lock.veil !== 'full' || lock.cover === 'gift') continue
    if (lock.prize && cfg) openRewardLock(state, cfg, lock)
    else lock.veil = 'half'
  }
}

export function findEmpty(state: GameState): Pos[] {
  const out: Pos[] = []
  eachCell(state.board, (item, row, col) => {
    if (!item && !lockAt(state, row, col)) out.push({ row, col })
  })
  return out
}

export function nearestEmpty(state: GameState, row: number, col: number): Pos | null {
  const spots = findEmpty(state)
  if (!spots.length) return null
  spots.sort((a, b) => {
    const da = Math.abs(a.row - row) + Math.abs(a.col - col)
    const db = Math.abs(b.row - row) + Math.abs(b.col - col)
    if (da !== db) return da - db
    if (a.row !== b.row) return a.row - b.row
    return a.col - b.col
  })
  return spots[0]
}

export function queueReward(state: GameState, item: Item): void {
  state.rewards.push(item)
}

export function rewardName(cfg: GameConfig, item: Item): string {
  if (item.kind === 'product') return item.tag === 'bag' ? '购物袋' : productName(cfg, item.line, item.level)
  if (item.kind === 'producer') return producerName(cfg, item.producerId)
  if (item.kind === 'potion') return potionName(cfg, item.tier)
  if (item.kind === 'gem') return gemName(cfg, item.tier)
  if (item.kind === 'rewardBox') {
    if (item.box === 'smile') return `笑脸 ×${item.n ?? 1}`
    return item.box === 'purple' ? '紫礼盒' : '购物袋'
  }
  return cfg.items.chestName
}

export function takeReward(state: GameState): ActionResult {
  const chestAt = state.rewards.findIndex((item) => item.kind === 'chest')
  const index = chestAt >= 0 ? chestAt : 0
  const item = state.rewards[index]
  if (!item) return { ok: false, reason: 'empty', events: [] }
  if (item.kind === 'rewardBox' && item.box === 'smile') {
    state.rewards.splice(index, 1)
    state.smiles += item.n ?? 1
    return { ok: true, events: [{ type: 'toast', text: `笑脸 +${item.n ?? 1}` }] }
  }
  const before = state.energy
  const spot = findEmpty(state)[0]
  if (!spot) {
    resolveGuides(state, undefined)
    return { ok: false, reason: 'full', events: [{ type: 'toast', text: '棋盘已满' }] }
  }
  state.rewards.splice(index, 1)
  state.energy = before
  state.board[spot.row][spot.col] = item
  if (item.kind === 'product') noteUnlock(state, item.line, item.level)
  if (item.kind === 'producer') state.hasProducer[item.producerId] = true
  if ((item.kind === 'rewardBox' || item.kind === 'chest') && state.chestLesson === 1) {
    state.chestLesson = 2
    state.chestCell = { row: spot.row, col: spot.col }
  }
  return { ok: true, events: [{ type: 'takeReward', row: spot.row, col: spot.col }] }
}

export function placeItem(state: GameState, item: Item, near?: Pos): { pending: boolean; row: number; col: number } {
  const spot = near ? nearestEmpty(state, near.row, near.col) : (findEmpty(state)[0] ?? null)
  if (!spot) {
    state.pending.push(item)
    return { pending: true, row: -1, col: -1 }
  }
  state.board[spot.row][spot.col] = item
  return { pending: false, row: spot.row, col: spot.col }
}

const PRODUCT_CAP = 11

export function lineCap(cfg: GameConfig, line: string): number {
  return cfg.items.lines.find((entry) => entry.id === line)?.levels.length ?? cfg.economy.producerMaxLevel
}

export function levelSpec(cfg: GameConfig, line: string, level: number) {
  return cfg.items.lines.find((entry) => entry.id === line)?.levels.find((entry) => entry.level === level)
}

export function makeChainItem(state: GameState, _cfg: GameConfig, line: string, level: number): Item {
  return makeProduct(state, line, level)
}

export function canMerge(a: Item, b: Item, cap = PRODUCT_CAP): boolean {
  if (a.kind === 'product' && a.tag === 'bubble') return false
  if (b.kind === 'product' && b.tag === 'bubble') return false
  if (a.kind === 'product' && b.kind === 'product') {
    return a.line === b.line && a.level === b.level && a.level < cap
  }
  if (a.kind === 'potion' && b.kind === 'potion') {
    return a.tier === b.tier && a.tier < 5
  }
  if (a.kind === 'gem' && b.kind === 'gem') {
    return a.tier === b.tier && a.tier < 4
  }
  if (a.kind === 'producer' && b.kind === 'producer') {
    return a.producerId === b.producerId && a.level === b.level && a.level < cap
  }
  return false
}

export function currentTutorial(cfg: GameConfig, state: GameState) {
  if (state.phase !== 'opening') return null
  return cfg.copy.tutorial[state.openingStep] ?? null
}

export function atStep(state: GameState, cfg: GameConfig, id: string): boolean {
  return currentTutorial(cfg, state)?.id === id
}

export function advanceTutorial(state: GameState, cfg: GameConfig): void {
  if (state.phase !== 'opening') return
  const currentId = cfg.copy.tutorial[state.openingStep]?.id
  const next = state.openingStep + 1
  if (next >= cfg.copy.tutorial.length) {
    if (currentId === 'mergeD' && state.board.some((row) => row.some((item) => item?.kind === 'producer' && item.producerId === 'food' && item.level >= 4))) {
      state.openingStep = next
      state.lesson = 'focus'
      syncEarlyOrders(state, cfg)
      return
    }
    state.phase = 'play'
    state.openingStep = cfg.copy.tutorial.length
    if (state.lesson !== 'free') state.lesson = 'free'
    return
  }
  state.openingStep = next
  const id = cfg.copy.tutorial[next]?.id
  if (id === 'merge' || id === 'mergeC' || id === 'mergeD') state.lesson = id
}

export function advanceDialogue(state: GameState, cfg: GameConfig): boolean {
  const step = currentTutorial(cfg, state)
  if (!step || step.type !== '对话') return false
  advanceTutorial(state, cfg)
  return true
}

export function tutorialAllowsInspect(state: GameState): boolean {
  return state.phase !== 'opening'
}

function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col
}

export function tutorialDropOk(state: GameState, cfg: GameConfig, from: Pos, to: Pos): boolean {
  const step = currentTutorial(cfg, state)
  if (!step) return true
  if (step.type !== '操作' || step.gesture !== 'drag') return false
  if (step.id === 'merge') {
    const a = cfg.board.roles.mergeA
    const b = cfg.board.roles.mergeB
    return (samePos(from, a) && samePos(to, b)) || (samePos(from, b) && samePos(to, a))
  }
  if (step.id === 'mergeC') {
    const target = cfg.board.roles.unlock
    if (!samePos(to, target) && !samePos(from, target)) return false
    const moving = samePos(to, target) ? from : to
    const item = state.board[moving.row]?.[moving.col]
    return item?.kind === 'producer' && item.producerId === 'food' && item.level === 2
  }
  if (step.id === 'mergeD') {
    const target = cfg.board.roles.mergeD
    if (!target || (!samePos(to, target) && !samePos(from, target))) return false
    const moving = samePos(to, target) ? from : to
    const item = state.board[moving.row]?.[moving.col]
    return item?.kind === 'producer' && item.producerId === 'food' && item.level === 3
  }
  if (step.id === 'unlock') {
    const target = cfg.board.roles.unlock
    if (!samePos(to, target)) return false
    const item = state.board[from.row]?.[from.col]
    const lock = lockAt(state, to.row, to.col)
    if (!item || item.kind !== 'product' || !lock || lock.cover === 'gift' || lock.buried.kind !== 'product') return false
    return item.line === lock.buried.line && item.level === lock.buried.level && item.level < PRODUCT_CAP
  }
  if (step.id === 'producerL2' || step.id === 'producerL3') {
    const fromItem = state.board[from.row]?.[from.col]
    const toItem = state.board[to.row]?.[to.col]
    if (fromItem?.kind !== 'producer' || toItem?.kind !== 'producer') return false
    if (fromItem.producerId !== 'food' || toItem.producerId !== 'food') return false
    if (fromItem.level !== toItem.level) return false
    if (step.id === 'producerL2') return fromItem.level === 1
    return fromItem.level === 1 || fromItem.level === 2
  }
  if (step.id === 'bagMerge') {
    const item = state.board[from.row]?.[from.col]
    const other = state.board[to.row]?.[to.col]
    return (
      !!item &&
      !!other &&
      item.kind === 'product' &&
      other.kind === 'product' &&
      item.tag === 'bag' &&
      other.tag === 'bag' &&
      canMerge(item, other)
    )
  }
  return false
}

function noteUnlock(state: GameState, line: string, level: number): void {
  state.unlocked[line] = Math.max(state.unlocked[line] ?? 0, level)
  const seen = state.seen[line] ?? []
  if (!seen.includes(level)) seen.push(level)
  state.seen[line] = seen
}

export function logAction(state: GameState, now: number, type: string): void {
  state.stats.log.push({ t: now, type, energy: state.energy, level: state.level })
  if (state.stats.log.length > 300) state.stats.log.splice(0, state.stats.log.length - 300)
}

export function startVisit(state: GameState, now: number): void {
  state.stats.visits.push({ start: now, ms: 0 })
  if (state.stats.visits.length > 40) state.stats.visits.splice(0, state.stats.visits.length - 40)
}

export function beatVisit(state: GameState, now: number): void {
  const visit = state.stats.visits[state.stats.visits.length - 1]
  if (!visit) return
  visit.ms = Math.max(0, now - visit.start)
}

export function syncEnergy(state: GameState, now: number, cfg: GameConfig): number {
  const max = cfg.economy.energyMax
  const interval = Math.max(1, cfg.economy.energyRegenMs)
  if (state.energy >= max) {
    state.energyTs = now
    return 0
  }
  const elapsed = now - state.energyTs
  const gain = Math.floor(elapsed / interval)
  if (gain <= 0) return 0
  const add = Math.min(gain, max - state.energy)
  state.energy += add
  state.energyTs += add * interval
  if (state.energy >= max) state.energyTs = now
  return add
}

function restoredCharges(cfg: GameConfig, item: ProducerItem): number {
  const def = cfg.producers.find((entry) => entry.id === item.producerId)
  const burst = def?.bursts?.find((row) => row.level === item.level)
  if (burst) return burst.items
  if (def?.tapCooldown) return def.tapCooldown.taps[0]
  if ((def?.kind ?? 'normal') === 'normal' && !(cfg.economy.producerCooldownOn > 0)) return 999
  return chargesForLevel(cfg, item.level)
}

export function refreshProducers(state: GameState, now: number, cfg: GameConfig): void {
  const refill = (item: Item) => {
    if (item.kind === 'producer' && item.cooldownUntil > 0 && now >= item.cooldownUntil) {
      item.charges = restoredCharges(cfg, item)
      item.cooldownUntil = 0
    }
  }
  eachCell(state.board, (item) => {
    if (item) refill(item)
  })
  for (const item of state.pending) refill(item)
}

export function rollEnergy(cfg: GameConfig, rng: Rng): number {
  const weights = cfg.economy.chestWeights
  const total = weights.reduce((sum, w) => sum + w.weight, 0) || 1
  let r = rng() * total
  for (const w of weights) {
    if (r < w.weight) return w.energy
    r -= w.weight
  }
  return weights[weights.length - 1]?.energy ?? 2
}

export function createGame(now: number, cfg: GameConfig): GameState {
  const state: GameState = {
    board: emptyBoard(),
    orders: [],
    pending: [],
    coins: cfg.economy.startCoins,
    energy: cfg.economy.startEnergy,
    energyTs: now,
    xp: 0,
    level: 1,
    tasksDone: [],
    decoration: null,
    styles: {},
    decorate: null,
    rewards: [],
    gems: 0,
    gemBuys: 0,
    playedMs: 0,
    armed: null,
    chainPop: null,
    guide: 'none',
    guidedTask: null,
    notice: null,
    giftPrompt: null,
    giftFreeUsed: false,
    buildStory: null,
    buildGuideCount: 0,
    backGuideCount: 0,
    chestLesson: 0,
    chestCell: null,
    producerLesson: null,
    newestLine: null,
    unlocked: {},
    seen: {},
    producerSeen: {},
    storageLesson: 0,
    sale: null,
    hasProducer: {},
    chestsOpened: 0,
    freeRefillUsed: false,
    dailyChestDate: null,
    firstPlayDate: dayKey(now),
    showHelp: false,
    locks: [],
    phase: 'story',
    openingStep: 0,
    lesson: 'home1',
    storyBookOn: false,
    storyForce: false,
    storyStep: 0,
    storySeen: false,
    soundMuted: false,
    storageOpen: false,
    bagPhase: 'place',
    smiles: 0,
    adDay: dayKey(now),
    adUsedToday: 0,
    playStartedAt: now,
    levelModal: null,
    levelQueue: [],
    giftModal: null,
    smileTaught: false,
    smileLesson: 'off',
    welcomeFreeUsed: false,
    bubbleDue: false,
    bubbleDropped: false,
    smileModal: null,
    orderBias: null,
    spawnMult: 1,
    mintStep: 'off',
    shopOpen: false,
    shopClaimDate: null,
    shopPackClaimed: false,
    detailLine: null,
    meatGuided: false,
    bevGuided: false,
    mintGuided: false,
    idCounter: 0,
    orderCounter: 0,
    orderSeq: 1,
    heldOrders: [],
    orderedLines: [],
    lateBlock: false,
    smileRound: 1,
    storyCard: null,
    stats: { producerTaps: 0, ordersDone: 0, adClicks: 0, visits: [], log: [] },
  }
  for (const line of cfg.items.lines) state.unlocked[line.id] = 0
  applyOpening(state, cfg)
  state.orders = []
  return state
}

function applyOpening(state: GameState, cfg: GameConfig): void {
  const cells = openingBoard as {
    row: number
    col: number
    open: boolean
    half: boolean
    item: { kind: 'product'; line: string; level: number } | { kind: 'producer'; id: string; level: number }
    prize?: CellLock['prize']
  }[]
  const open: { row: number; col: number }[] = []
  for (const cell of cells) {
    if (cell.item.kind === 'producer' && cell.item.id === 'bev') {
      state.locks.push({
        row: cell.row,
        col: cell.col,
        cover: 'sand',
        veil: 'full',
        buried: { kind: 'coin', amount: 2, line: 'coin', level: 1 },
      })
      continue
    }
    if (cell.open) {
      open.push({ row: cell.row, col: cell.col })
      state.board[cell.row][cell.col] = spawnOpening(state, cfg, cell.item)
      continue
    }
    const buried =
      cell.item.kind === 'producer'
        ? { kind: 'producer' as const, id: cell.item.id, level: cell.item.level }
        : { kind: 'product' as const, line: cell.item.line, level: cell.item.level }
    state.locks.push({
      row: cell.row,
      col: cell.col,
      cover: 'sand',
      veil: cell.half ? 'half' : 'full',
      buried,
      prize: cell.prize,
    })
  }
  state.hasProducer.food = true
  cfg.board.roles = {
    mergeA: { row: 3, col: 1 },
    mergeB: { row: 4, col: 1 },
    unlock: { row: 4, col: 2 },
    producer: { row: 3, col: 1 },
    mergeD: { row: 4, col: 3 },
    gift: { row: 7, col: 6 },
    bagSpot: { row: 4, col: 4 },
  }
  cfg.board.open = open
  cfg.board.locks = state.locks.map((lock) => ({ ...lock, buried: { ...lock.buried } }))
}

function spawnOpening(state: GameState, cfg: GameConfig, item: { kind: 'product'; line: string; level: number } | { kind: 'producer'; id: string; level: number }): Item {
  if (item.kind === 'producer') return makeProducer(state, item.id, cfg, item.level)
  noteUnlock(state, item.line, item.level)
  return makeProduct(state, item.line, item.level)
}

export function findProducer(state: GameState, id: string): Occupied | null {
  return occupied(state).find((cell) => cell.item.kind === 'producer' && cell.item.producerId === id) ?? null
}

export function findProduct(state: GameState, line: string, level: number): Pos | null {
  const hit = occupied(state).find(
    (cell) => cell.item.kind === 'product' && cell.item.line === line && cell.item.level === level,
  )
  return hit ? { row: hit.row, col: hit.col } : null
}

export function findMergePair(state: GameState): [Pos, Pos] | null {
  const list = occupied(state)
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (canMerge(list[i].item, list[j].item)) {
        return [
          { row: list[i].row, col: list[i].col },
          { row: list[j].row, col: list[j].col },
        ]
      }
    }
  }
  return null
}

export function tutorialHint(state: GameState): string {
  if (findProduct(state, 'food', 3)) return '把小鱼干拖到小桃的订单上。'
  const higher =
    findProduct(state, 'food', 4) || findProduct(state, 'food', 5) || findProduct(state, 'food', 6)
  if (higher) return '这单只要小鱼干，再做一只。'
  if (findMergePair(state)) return '把两个一样的拖到一起。'
  return '点砂锅，拿出猫草。'
}

function producerKind(cfg: GameConfig, id: string): 'normal' | 'netSource' | 'plant' | 'consumable' {
  return cfg.producers.find((entry) => entry.id === id)?.kind ?? 'normal'
}

/** 点一下会扣玩家体力。猫粮、饮料从 4 级起，和 PSD 上的闪电一致。花盆和消耗品不扣。 */
export function producerTapCostsEnergy(cfg: GameConfig, item: ProducerItem): boolean {
  const kind = producerKind(cfg, item.producerId)
  if (kind === 'consumable' || kind === 'plant') return false
  return item.level >= (cfg.economy.producerOutputLevel ?? 4)
}

export function producerCanSpawn(cfg: GameConfig, item: ProducerItem, now: number): boolean {
  const kind = producerKind(cfg, item.producerId)
  if (kind === 'consumable') return item.charges > 0
  const def = cfg.producers.find((entry) => entry.id === item.producerId)
  const minLevel = def?.produceFrom ?? (kind === 'plant' ? (cfg.economy.plantOutputLevel ?? 6) : (cfg.economy.producerOutputLevel ?? 4))
  if (item.level < minLevel || item.charges <= 0 || item.cooldownUntil > now) return false
  return true
}

export function producerCooldown(cfg: GameConfig, item: ProducerItem, now: number): { left: number; total: number } | null {
  const kind = producerKind(cfg, item.producerId)
  if (kind === 'consumable') return null
  const minLevel = kind === 'plant' ? (cfg.economy.plantOutputLevel ?? 6) : (cfg.economy.producerOutputLevel ?? 4)
  if (item.level < minLevel || item.charges > 0 || item.cooldownUntil <= now) return null
  const total = kind === 'plant' ? (cfg.economy.plantCooldownMs ?? 1_800_000) : (cfg.economy.producerRoundCooldownMs ?? 120_000)
  const left = item.cooldownUntil - now
  return { left, total: Math.max(left, total) }
}

export function spawnTier(cfg: GameConfig, mult: number) {
  return cfg.economy.spawnTable?.find((tier) => tier.mult === mult)
}

function rollSpawnLevel(cfg: GameConfig, mult: 1 | 2 | 4 | 8, rng: Rng): number {
  const tier = spawnTier(cfg, mult)
  const weights = tier?.weights?.filter((entry) => entry.p > 0) ?? []
  if (!weights.length) return 1
  const total = weights.reduce((sum, entry) => sum + entry.p, 0) || 1
  let roll = rng() * total
  for (const entry of weights) {
    roll -= entry.p
    if (roll <= 0) return entry.level
  }
  return weights[weights.length - 1]?.level ?? 1
}

export function enabledMults(cfg: GameConfig): (1 | 2 | 4 | 8)[] {
  const list = (cfg.economy.spawnTable ?? []).filter((tier) => tier.enabled).map((tier) => tier.mult)
  return list.length ? list : [1]
}

function noteProducerLevel(state: GameState, _cfg: GameConfig, id: string, level: number): void {
  if (id === 'food' && level >= 5) state.meatGuided = true
  if (id === 'bev' && level >= 4) state.bevGuided = true
  if (id === 'bev' && level >= 5) state.mintGuided = true
}

export type Overlay = 'level' | 'gift' | 'smile' | 'story' | 'shop' | 'detail' | 'talk' | 'mint'

/** 同一时间只算最前面的一个弹窗。升级优先，然后商城、详情卡、对话，最后才是强制教学。 */
export function activeOverlay(state: GameState): Overlay | null {
  if (state.levelModal) return 'level'
  if (state.giftModal) return 'gift'
  if (state.smileModal) return 'smile'
  if (state.storyCard) return 'story'
  if (state.shopOpen) return 'shop'
  if (state.detailLine) return 'detail'
  if (state.notice || state.guide === 'buildTalk' || state.guide === 'backTalk') return 'talk'
  if (state.mintStep === 'select' || state.mintStep === 'produce' || state.mintStep === 'merge' || state.mintStep === 'deliver') return 'mint'
  return null
}

export function dismissDetail(state: GameState): void {
  state.detailLine = null
  if (state.mintStep === 'talk' && !state.notice) {
    state.notice = { text: '5 级饮料能出猫薄荷了。这单要猫薄荷，跟着做。' }
  }
}

export function dismissNotice(state: GameState): void {
  const starting = state.mintStep === 'talk'
  state.notice = null
  if (!starting) return
  if (findEmpty(state).length < 2) {
    state.mintStep = 'wait'
    state.notice = { text: '棋盘满了。先腾出两个空格，再跟着做猫薄荷。' }
    return
  }
  state.mintStep = 'select'
}

export function pumpMint(state: GameState): void {
  if (state.mintStep !== 'wait' || activeOverlay(state)) return
  if (findEmpty(state).length < 2) return
  const mints = occupied(state).filter((cell) => cell.item.kind === 'product' && cell.item.line === 'mint')
  const pair = mints.some((cell, index) =>
    mints.slice(index + 1).some((other) => other.item.kind === 'product' && cell.item.kind === 'product' && other.item.level === cell.item.level),
  )
  const ready = state.orders.some((order) => order.slots.some((slot) => slot.line === 'mint') && orderSatisfied(state, order))
  state.mintStep = ready ? 'deliver' : pair ? 'merge' : 'select'
}

export function tapProducer(state: GameState, pos: Pos, cfg: GameConfig, rng: Rng, now: number): ActionResult {
  syncEnergy(state, now, cfg)
  refreshProducers(state, now, cfg)
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || item.kind !== 'producer') return { ok: false, reason: 'not-producer', events: [] }
  const name = producerName(cfg, item.producerId)
  const spot = nearestEmpty(state, pos.row, pos.col)
  const teaching = state.mintStep === 'produce' && item.producerId === 'bev'
  if (!spot && !teaching) {
    resolveGuides(state)
    return { ok: false, reason: 'full', events: [{ type: 'toast', text: '没有空格了' }] }
  }
  const kind = producerKind(cfg, item.producerId)
  const def = cfg.producers.find((entry) => entry.id === item.producerId)
  const minLevel = def?.produceFrom ?? (kind === 'plant' ? (cfg.economy.plantOutputLevel ?? 6) : (cfg.economy.producerOutputLevel ?? 4))
  if (kind !== 'consumable' && item.level < minLevel) {
    return { ok: false, reason: 'low', events: [{ type: 'toast', text: `合到 ${minLevel} 级才能产出` }] }
  }
  if (item.charges <= 0 && item.cooldownUntil > now) {
    if (kind === 'plant') {
      item.charges = cfg.economy.plantBurst ?? 8
      item.cooldownUntil = 0
      return { ok: true, events: [{ type: 'toast', text: '广告看完，花盆可以再出了' }] }
    }
    return {
      ok: false,
      reason: 'cooldown',
      events: [
        { type: 'cooldown', remainMs: item.cooldownUntil - now },
        { type: 'toast', text: `${name}歇一会儿` },
      ],
    }
  }
  const mult = allowedSpawnMults(state, cfg).includes((state.spawnMult ?? 1) as 1 | 2 | 4) ? (state.spawnMult ?? 1) : 1
  const taught = state.producerLesson === item.producerId
  const tierCost = spawnTier(cfg, mult)?.cost ?? mult
  const cost = kind === 'plant' || taught ? 0 : kind === 'consumable' ? 1 : tierCost
  if (cost > 0 && state.energy < cost) return { ok: false, reason: 'energy', events: [{ type: 'needEnergy' }] }
  if (taught) state.producerLesson = null
  if (cost > 0) {
    const wasFull = state.energy >= cfg.economy.energyMax
    state.energy -= cost
    if (wasFull && state.energy < cfg.economy.energyMax) state.energyTs = now
  }
  item.charges = Math.max(0, item.charges - 1)
  if (item.charges <= 0 && def?.tapCooldown) {
    const [lo, hi] = def.tapCooldown.seconds
    const sec = lo + Math.floor(rng() * (Math.max(0, hi - lo) + 1))
    item.cooldownUntil = now + sec * 1000
  } else if (item.charges <= 0 && kind === 'normal' && cfg.economy.producerCooldownOn > 0) {
    item.cooldownUntil = now + (cfg.economy.producerRoundCooldownMs ?? cfg.economy.producerCooldownMs)
  }
  const made = spawnFromProducer(state, cfg, item, rng, mult)
  if (spot) state.board[spot.row][spot.col] = made
  else {
    queueReward(state, made)
    state.mintStep = 'wait'
    state.notice = { text: '棋盘满了，猫薄荷先放在奖励栏。腾出空格后再继续。' }
  }
  if (made.kind === 'product') noteUnlock(state, made.line, made.level)
  if (made.kind === 'producer') state.hasProducer[made.producerId] = true
  state.stats.producerTaps += 1
  logAction(state, now, 'tap')
  if ((kind === 'consumable' && item.charges <= 0) || (kind === 'plant' && item.charges <= 0)) {
    if (kind === 'plant') {
      const burst = def?.bursts?.find((row) => row.level === item.level)
      item.cooldownUntil = now + (burst?.cooldownMin ?? 40) * 60 * 1000
    } else state.board[pos.row][pos.col] = null
  }
  if (atStep(state, cfg, 'produce')) advanceTutorial(state, cfg)
  promoteFocusLesson(state)
  if (spot && state.mintStep === 'produce' && item.producerId === 'bev') {
    const mints = occupied(state).filter((cell) => cell.item.kind === 'product' && cell.item.line === 'mint')
    const pair = mints.find((cell, index) =>
      mints.slice(index + 1).some((other) => other.item.kind === 'product' && cell.item.kind === 'product' && other.item.level === cell.item.level),
    )
    const ready = state.orders.some(
      (order) => order.slots.some((slot) => slot.line === 'mint') && orderSatisfied(state, order),
    )
    state.mintStep = ready ? 'deliver' : pair ? 'merge' : 'produce'
  }
  return {
    ok: true,
    events: [{ type: 'spawn', row: spot?.row ?? -1, col: spot?.col ?? -1, fromRow: pos.row, fromCol: pos.col }],
  }
}

function rollWeighted(rng: Rng, weights: { key: string; p: number }[]): string {
  const usable = weights.filter((entry) => entry.p > 0)
  const total = usable.reduce((sum, entry) => sum + entry.p, 0) || 1
  let roll = rng() * total
  for (const entry of usable) {
    roll -= entry.p
    if (roll <= 0) return entry.key
  }
  return usable[usable.length - 1]?.key ?? 'e1'
}

function spawnFromProducer(state: GameState, cfg: GameConfig, item: ProducerItem, rng: Rng, mult: 1 | 2 | 4 | 8): Item {
  const def = cfg.producers.find((entry) => entry.id === item.producerId)
  const kind = def?.kind ?? 'normal'
  if (item.producerId === 'basket') {
    const level = rng() < (cfg.economy.basketLowChance ?? 0.7) ? 2 : 3
    return makeProduct(state, 'food', level)
  }
  if (item.producerId === 'piggy') {
    const level = 1 + Math.floor(rng() * rng() * 5)
    return makeProduct(state, 'coin', Math.min(5, Math.max(1, level)))
  }
  const row = def?.drops?.find((entry) => entry.level === item.level) ?? def?.drops?.[0]
  if (row && (row.catch1 != null || row.catch2 != null)) {
    const key = rollWeighted(rng, [
      { key: '1', p: row.catch1 ?? 0 },
      { key: '2', p: row.catch2 ?? 0 },
      { key: '3', p: row.catch3 ?? 0 },
    ])
    return makeProducer(state, 'net', cfg, Number(key))
  }
  if (kind === 'plant' || item.producerId === 'dog') {
    return makeProduct(state, def?.line ?? 'plant', 1)
  }
  if (row) {
    const sideReady = !!def?.side && item.level >= (def.sideFrom ?? 99)
    const key = rollWeighted(rng, [
      { key: 'hard', p: sideReady ? row.hard : 0 },
      { key: 'e1', p: row.e1 + (sideReady ? 0 : row.hard) },
      { key: 'e2', p: row.e2 },
      { key: 'e3', p: row.e3 },
      { key: 'rare', p: row.rare },
    ])
    if (key === 'hard' && def?.side) return makeProduct(state, def.side, 1)
    const level = key === 'e2' ? 2 : key === 'e3' ? 3 : key === 'rare' ? 4 : 1
    let capped = Math.min(lineCap(cfg, def?.line ?? 'food'), level)
    if (state.lesson === 'focus' && item.producerId === 'food') {
      const need = state.orders.find((order) => order.scripted)?.slots.find((slot) => slot.line === 'food')?.level ?? 3
      capped = Math.min(capped, Math.max(1, need - 1))
    }
    return makeProduct(state, def?.line ?? 'food', Math.max(1, capped))
  }
  if (item.producerId === 'net') {
    const level = rollSpawnLevel(cfg, mult, rng)
    return makeProduct(state, 'fish', Math.min(lineCap(cfg, 'fish'), level))
  }
  const line = def?.line ?? 'food'
  let level = Math.min(lineCap(cfg, line), rollSpawnLevel(cfg, mult, rng))
  if (state.lesson === 'focus' && item.producerId === 'food') {
    const need = state.orders.find((order) => order.scripted)?.slots.find((slot) => slot.line === 'food')?.level ?? 3
    level = Math.min(level, Math.max(1, need - 1))
  }
  return makeProduct(state, line, Math.max(1, level))
}

export function collectBoardProduct(state: GameState, pos: Pos, cfg: GameConfig): ActionResult {
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || item.kind !== 'product') return { ok: false, reason: 'not-product', events: [] }
  const line = cfg.items.lines.find((entry) => entry.id === item.line)
  if (!line?.collect) return { ok: false, reason: 'not-collect', events: [] }
  const amount = coinOf(cfg, item.line, item.level)
  state.board[pos.row][pos.col] = null
  if (line.collect === 'gem') state.gems += amount
  else state.coins += amount
  return { ok: true, events: [{ type: 'toast', text: line.collect === 'gem' ? `钻石 +${amount}` : `铜钱 +${amount}` }] }
}

/** 按钮这一轮只在 x1 / x2 / x4 之间转。20 级前没有 x4，x8 留给以后的付费档。 */
export function allowedSpawnMults(state: GameState, cfg: GameConfig): (1 | 2 | 4)[] {
  const unlock = cfg.economy.speed4Level ?? 10
  return state.level >= unlock ? [1, 2, 4] : [1]
}

export function cycleSpawnMult(state: GameState, cfg: GameConfig): 1 | 2 | 4 | 8 {
  const list = allowedSpawnMults(state, cfg)
  const current = list.includes(state.spawnMult as 1 | 2 | 4) ? state.spawnMult : 1
  const index = list.indexOf(current as 1 | 2 | 4)
  state.spawnMult = list[(index + 1) % list.length] ?? 1
  return state.spawnMult
}

export function claimShopDaily(state: GameState, cfg: GameConfig, now: number): ActionResult {
  const today = dayKey(now)
  if (state.shopClaimDate === today) return { ok: false, reason: 'used', events: [{ type: 'toast', text: '今天领过了' }] }
  state.shopClaimDate = today
  state.energy += cfg.economy.shopDailyEnergy ?? 50
  return { ok: true, events: [{ type: 'toast', text: `体力 +${cfg.economy.shopDailyEnergy ?? 50}` }] }
}

export function claimShopPack(state: GameState, cfg: GameConfig): ActionResult {
  if (state.shopPackClaimed) return { ok: false, reason: 'used', events: [{ type: 'toast', text: '这个礼包领过了' }] }
  state.shopPackClaimed = true
  state.gems += cfg.economy.shopPackGems ?? 10
  state.energy += cfg.economy.shopPackEnergy ?? 50
  return { ok: true, events: [{ type: 'toast', text: '新手礼包：钻石和体力已到账' }] }
}

export function tapConsumable(state: GameState, pos: Pos, cfg: GameConfig, now: number): ActionResult {
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || (item.kind !== 'potion' && item.kind !== 'gem')) return { ok: false, reason: 'not-consumable', events: [] }
  const same = state.armed?.row === pos.row && state.armed?.col === pos.col
  if (!same) {
    state.armed = { row: pos.row, col: pos.col }
    state.chainPop = { kind: item.kind, tier: item.tier }
    return { ok: true, reason: 'arm', events: [] }
  }
  state.armed = null
  state.chainPop = null
  return item.kind === 'potion' ? drinkPotion(state, pos, cfg, now) : useGem(state, pos, cfg)
}

export function drinkPotion(state: GameState, pos: Pos, cfg: GameConfig, now: number): ActionResult {
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || item.kind !== 'potion') return { ok: false, reason: 'not-potion', events: [] }
  const amount = bottleEnergy(cfg, item)
  state.board[pos.row][pos.col] = null
  state.energy += amount
  if (state.energy >= cfg.economy.energyMax) state.energyTs = now
  return { ok: true, events: [{ type: 'drink', amount, row: pos.row, col: pos.col }] }
}

function placeLoot(state: GameState, _cfg: GameConfig, pos: Pos, drop: LootDrop): void {
  if (drop.coins) {
    state.coins += drop.coins
    return
  }
  if (drop.gems) {
    const gem = makeGem(state, drop.gems)
    const spot = nearestEmpty(state, pos.row, pos.col)
    if (spot) state.board[spot.row][spot.col] = gem
    else queueReward(state, gem)
    return
  }
  if (drop.item) {
    const spot = nearestEmpty(state, pos.row, pos.col)
    if (spot) state.board[spot.row][spot.col] = drop.item
    else queueReward(state, drop.item)
  }
}

function popLoot(state: GameState, cfg: GameConfig, pos: Pos, drops: LootDrop[]): number {
  const drop = drops.shift()
  if (drop) placeLoot(state, cfg, pos, drop)
  return drops.length
}

function chestTaps(box: string, rng: Rng): number {
  if (box === 'welcome') return rng() < 0.5 ? 7 : 8
  if (box === 'red') return 8
  if (box === 'green') return 10
  if (box === 'smart') return 6
  if (box === 'food') return 6
  if (box === 'meat') return 9
  return 5
}

function labelToItem(state: GameState, cfg: GameConfig, label: string): Item {
  const producer = label.match(/^(猫粮母棋|饮料母棋|玩具母棋|猫窝母棋|花盆母棋|渔网母棋)(\d+)/)
  if (producer) {
    const id = producer[1] === '猫粮母棋' ? 'food' : producer[1] === '饮料母棋' ? 'bev' : producer[1] === '玩具母棋' ? 'toy' : producer[1] === '猫窝母棋' ? 'bed' : producer[1] === '花盆母棋' ? 'plant' : 'boat'
    return makeProducer(state, id, cfg, Number(producer[2]))
  }
  const piece = label.match(/^(金币|钻石|体力|猫粮|肉类|饮料|猫薄荷|花草)(\d+)/)
  const level = Number(piece?.[2] ?? 1)
  if (piece?.[1] === '钻石') return makeGem(state, level)
  if (piece?.[1] === '体力') return makeEnergyPotion(state, cfg, BALANCE.resources.energy[level - 1] ?? 2)
  const line = piece?.[1] === '金币' ? 'coin' : piece?.[1] === '肉类' ? 'meat' : piece?.[1] === '饮料' ? 'bev' : piece?.[1] === '猫薄荷' ? 'mint' : piece?.[1] === '花草' ? 'plant' : 'food'
  return makeProduct(state, line, level)
}

function rollLabels(table: Record<string, number>, count: number, rng: Rng): string[] {
  const entries = Object.entries(table)
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0) || 1
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    let roll = rng() * total
    let pick = entries[entries.length - 1]?.[0] ?? '体力1'
    for (const [label, weight] of entries) {
      roll -= weight
      if (roll <= 0) {
        pick = label
        break
      }
    }
    out.push(pick)
  }
  return out
}

function chestTable(id: string): Record<string, number> | null {
  const chest = BALANCE.chests.find((entry) => entry.id === id)
  return chest && chest.table && typeof chest.table === 'object' ? chest.table : null
}

function fillChest(state: GameState, cfg: GameConfig, item: Extract<Item, { kind: 'chest' }>, rng: Rng): void {
  const box = item.box ?? 'energy'
  if (box === 'energy') {
    const fixed = cfg.economy.newbieChestFixed && state.chestsOpened < cfg.economy.newbieChestCount
    const energies = fixed ? cfg.economy.newbieChest.slice() : Array.from({ length: 5 }, () => rollEnergy(cfg, rng))
    state.chestsOpened += 1
    item.drops = energies.map((energy) => ({ item: makeEnergyPotion(state, cfg, energy) }))
    maybeLateProducer(state, cfg, rng)
    return
  }
  if (box === 'smart') {
    const need = state.orders.flatMap((order) => order.slots.map((slot) => ({ line: slot.line, level: slot.level })))
    item.drops = Array.from({ length: chestTaps(box, rng) }, () => {
      const slot = need.length ? need[Math.floor(rng() * need.length)] : null
      const made = slot ? makeProduct(state, slot.line, slot.level) : makeEnergyPotion(state, cfg, 2)
      return { item: made }
    })
    return
  }
  const tableId = box === 'welcome' ? 'welcome' : box === 'red' ? 'red1' : box === 'green' ? 'green1' : box === 'food' ? 'food_box' : 'meat_box'
  const table = chestTable(tableId) ?? { 体力1: 1 }
  item.drops = rollLabels(table, chestTaps(box, rng), rng).map((label) => ({ item: labelToItem(state, cfg, label) }))
}

export function openChest(state: GameState, pos: Pos, cfg: GameConfig, rng: Rng, now = 0): ActionResult {
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || item.kind !== 'chest') return { ok: false, reason: 'not-chest', events: [] }
  if (item.box === 'welcome' && item.readyAt && now && item.readyAt > now) {
    if (!state.welcomeFreeUsed) state.welcomeFreeUsed = true
    else {
      const cost = cfg.economy.giftRushGems ?? 2
      if (!item.confirmGem) {
        item.confirmGem = true
        return { ok: false, reason: 'wait', events: [{ type: 'toast', text: `再点一次，花 ${cost} 钻石立刻打开` }] }
      }
      if (state.gems < cost) return { ok: false, reason: 'gems', events: [{ type: 'toast', text: '钻石不够' }] }
      state.gems -= cost
    }
    item.readyAt = now
  }
  if (!item.drops) fillChest(state, cfg, item, rng)
  if (!nearestEmpty(state, pos.row, pos.col)) {
    return { ok: false, reason: 'full', events: [{ type: 'toast', text: '棋盘已满' }] }
  }
  const left = popLoot(state, cfg, pos, item.drops ?? [])
  if (left <= 0) state.board[pos.row][pos.col] = null
  if (state.chestLesson === 2) state.chestLesson = 3
  return { ok: true, events: [{ type: 'openChest', row: pos.row, col: pos.col, count: 1 }] }
}

function maybeLateProducer(state: GameState, cfg: GameConfig, rng: Rng): void {
  if (rng() >= (cfg.economy.lateProducerChance ?? 0)) return
  const list = cfg.producers
  const pick = list[Math.floor(rng() * list.length)]
  if (!pick) return
  const level = rng() < 0.5 ? 1 : 2
  queueReward(state, makeProducer(state, pick.id, cfg, level))
}

export function applyFreeRefill(state: GameState, cfg: GameConfig, now: number): ActionResult {
  if (state.freeRefillUsed) return { ok: false, reason: 'used', events: [] }
  state.freeRefillUsed = true
  state.energy = Math.max(state.energy, cfg.economy.freeRefill)
  if (state.energy >= cfg.economy.energyMax) state.energyTs = now
  return { ok: true, events: [{ type: 'refill', amount: cfg.economy.freeRefill, mode: 'free' }] }
}

export function applyAdRefill(state: GameState, cfg: GameConfig, now: number): ActionResult {
  const today = dayKey(now)
  if (state.adDay !== today) {
    state.adDay = today
    state.adUsedToday = 0
  }
  if (state.adUsedToday >= cfg.economy.adDailyMax) {
    return { ok: false, reason: 'ad-limit', events: [{ type: 'toast', text: '今天的广告次数用完了' }] }
  }
  state.adUsedToday += 1
  state.energy += cfg.economy.adEnergy
  state.stats.adClicks += 1
  logAction(state, now, 'ad')
  if (state.energy >= cfg.economy.energyMax) state.energyTs = now
  return {
    ok: true,
    events: [
      { type: 'refill', amount: cfg.economy.adEnergy, mode: 'ad' },
      { type: 'toast', text: `体力 +${cfg.economy.adEnergy}` },
    ],
  }
}

export function canClaimDaily(state: GameState, now: number, cfg: GameConfig): boolean {
  const today = dayKey(now)
  if (dayNumber(state.firstPlayDate, today) < cfg.economy.dailyChestFromDay) return false
  return state.dailyChestDate !== today
}

export function claimDailyChest(state: GameState, now: number, cfg: GameConfig): ActionResult {
  if (!canClaimDaily(state, now, cfg)) return { ok: false, reason: 'unavailable', events: [] }
  state.dailyChestDate = dayKey(now)
  state.stats.adClicks += 1
  logAction(state, now, 'ad')
  queueReward(state, makeChest(state))
  return {
    ok: true,
    events: [
      { type: 'grant', kind: 'chest', name: cfg.items.chestName, row: -1, col: -1, pending: true },
      { type: 'toast', text: '今日宝箱放进奖励栏了' },
    ],
  }
}

function promoteFocusLesson(state: GameState): void {
  if (state.lesson !== 'focus') return
  const order = state.orders.find((entry) => entry.scripted)
  if (order && orderSatisfied(state, order)) state.lesson = 'deliver'
}

export function dropItem(state: GameState, from: Pos, to: Pos, cfg?: GameConfig): ActionResult {
  if (!inBoard(from.row, from.col) || !inBoard(to.row, to.col)) {
    return { ok: false, reason: 'oob', events: [{ type: 'bounce' }] }
  }
  const item = state.board[from.row][from.col]
  if (!item) return { ok: false, reason: 'empty', events: [] }
  if (lockAt(state, from.row, from.col)) return { ok: false, reason: 'locked', events: [{ type: 'bounce' }] }
  if (from.row === to.row && from.col === to.col) return { ok: true, events: [] }
  const lock = lockAt(state, to.row, to.col)
  if (lock) {
    if (lock.cover === 'gift') {
      return { ok: false, reason: 'gift', events: [{ type: 'toast', text: '点解锁打开礼物' }, { type: 'bounce' }] }
    }
    if (lock.veil === 'full') {
      return { ok: false, reason: 'lock', events: [{ type: 'toast', text: '这格还盖着' }, { type: 'bounce' }] }
    }
    const buried = lock.buried
    if (
      buried.kind === 'producer' &&
      item.kind === 'producer' &&
      cfg &&
      item.producerId === buried.id &&
      item.level === buried.level &&
      item.level < producerCap(cfg, item.producerId)
    ) {
      const level = item.level + 1
      state.board[from.row][from.col] = null
      state.board[to.row][to.col] = makeProducer(state, item.producerId, cfg, level)
      state.locks = state.locks.filter((entry) => entry.row !== to.row || entry.col !== to.col)
      noteProducerLevel(state, cfg, item.producerId, level)
      if (atStep(state, cfg, 'unlock') || atStep(state, cfg, 'mergeC') || atStep(state, cfg, 'mergeD')) advanceTutorial(state, cfg)
      revealAround(state, to.row, to.col, cfg)
      return {
        ok: true,
        events: [
          { type: 'merge', row: to.row, col: to.col, line: item.line, level, kind: 'product' },
          { type: 'unlock', row: to.row, col: to.col, line: item.line, level },
        ],
      }
    }
    if (
      buried.kind === 'product' &&
      item.kind === 'product' &&
      item.line === buried.line &&
      item.level === buried.level &&
      item.level < PRODUCT_CAP
    ) {
      const level = item.level + 1
      state.board[from.row][from.col] = null
      state.board[to.row][to.col] = makeProduct(state, item.line, level)
      state.locks = state.locks.filter((entry) => entry.row !== to.row || entry.col !== to.col)
      noteUnlock(state, item.line, level)
      dropBubble(state, item.line, level)
      if (cfg && atStep(state, cfg, 'unlock')) advanceTutorial(state, cfg)
      promoteFocusLesson(state)
      revealAround(state, to.row, to.col, cfg)
      return {
        ok: true,
        events: [
          { type: 'merge', row: to.row, col: to.col, line: item.line, level, kind: 'product' },
          { type: 'unlock', row: to.row, col: to.col, line: item.line, level },
        ],
      }
    }
    const keyed = buried.kind === 'coin' || buried.kind === 'gem' || buried.kind === 'potion'
    if (keyed && buried.line && buried.level && item.kind === 'product' && item.line === buried.line && item.level === buried.level) {
      state.board[from.row][from.col] = null
      state.locks = state.locks.filter((entry) => entry.row !== to.row || entry.col !== to.col)
      if (buried.kind === 'coin') state.coins += buried.amount
      if (buried.kind === 'gem' && cfg) state.gems += gemAmount(cfg, buried.tier)
      if (buried.kind === 'potion' && cfg) state.energy += potionEnergy(cfg, buried.tier)
      revealAround(state, to.row, to.col, cfg)
      const text = buried.kind === 'coin' ? `铜钱 +${buried.amount}` : buried.kind === 'gem' ? '获得钻石' : '获得体力'
      return {
        ok: true,
        events: [
          { type: 'toast', text },
          { type: 'unlock', row: to.row, col: to.col, line: buried.line, level: buried.level },
        ],
      }
    }
    return { ok: false, reason: 'lock', events: [{ type: 'toast', text: '要同级同种才能揭开' }, { type: 'bounce' }] }
  }
  const other = state.board[to.row][to.col]
  if (!other) {
    state.board[to.row][to.col] = item
    state.board[from.row][from.col] = null
    return {
      ok: true,
      events: [{ type: 'move', fromRow: from.row, fromCol: from.col, toRow: to.row, toCol: to.col }],
    }
  }
  const mergeCap =
    item.kind === 'producer' && cfg
      ? producerCap(cfg, item.producerId)
      : cfg && item.kind === 'product'
        ? lineCap(cfg, item.line)
        : PRODUCT_CAP
  if (canMerge(item, other, mergeCap)) {
    if (other.kind === 'product' && item.kind === 'product') {
      const level = other.level + 1
      state.board[to.row][to.col] = cfg ? makeChainItem(state, cfg, other.line, level) : makeProduct(state, other.line, level)
      state.board[from.row][from.col] = null
      noteUnlock(state, other.line, level)
      dropBubble(state, other.line, level)
      if (cfg && (atStep(state, cfg, 'merge') || atStep(state, cfg, 'bagMerge'))) advanceTutorial(state, cfg)
      promoteFocusLesson(state)
      if (state.mintStep === 'merge' && other.line === 'mint') {
        const ready = state.orders.some((order) => order.slots.some((slot) => slot.line === 'mint') && orderSatisfied(state, order))
        state.mintStep = ready ? 'deliver' : 'produce'
      }
      revealAround(state, to.row, to.col, cfg)
      revealAround(state, from.row, from.col, cfg)
      return {
        ok: true,
        events: [{ type: 'merge', row: to.row, col: to.col, line: other.line, level, kind: 'product' }],
      }
    }
    if (other.kind === 'potion' && item.kind === 'potion') {
      const tier = other.tier + 1
      state.board[to.row][to.col] = makePotion(state, tier)
      state.board[from.row][from.col] = null
      revealAround(state, to.row, to.col)
      return {
        ok: true,
        events: [{ type: 'merge', row: to.row, col: to.col, line: 'potion', level: tier, kind: 'potion' }],
      }
    }
    if (other.kind === 'gem' && item.kind === 'gem') {
      const tier = other.tier + 1
      state.board[to.row][to.col] = makeGem(state, tier)
      state.board[from.row][from.col] = null
      revealAround(state, to.row, to.col)
      return {
        ok: true,
        events: [{ type: 'merge', row: to.row, col: to.col, line: 'gem', level: tier, kind: 'potion' }],
      }
    }
    if (other.kind === 'producer' && item.kind === 'producer' && cfg) {
      const level = Math.min(producerCap(cfg, other.producerId), other.level + 1)
      state.board[to.row][to.col] = makeProducer(state, other.producerId, cfg, level)
      state.board[from.row][from.col] = null
      noteProducerLevel(state, cfg, other.producerId, level)
      if (other.producerId === 'food' && atStep(state, cfg, 'merge') && level === 2) advanceTutorial(state, cfg)
      if (other.producerId === 'food' && atStep(state, cfg, 'producerL2') && level === 2) advanceTutorial(state, cfg)
      if (other.producerId === 'food' && atStep(state, cfg, 'producerL3') && level >= 3) advanceTutorial(state, cfg)
      revealAround(state, to.row, to.col, cfg)
      return {
        ok: true,
        events: [{ type: 'merge', row: to.row, col: to.col, line: other.line, level, kind: 'product' }],
      }
    }
  }
  state.board[from.row][from.col] = other
  state.board[to.row][to.col] = item
  return {
    ok: true,
    events: [{ type: 'swap', aRow: from.row, aCol: from.col, bRow: to.row, bCol: to.col }],
  }
}

export function orderReward(order: Order, cfg: GameConfig): number {
  const scale = cfg.economy.orderRewardScale
  if (order.big) return Math.round(cfg.economy.l3Coins * cfg.economy.bigOrderL3Times * scale)
  const floor = cfg.economy.earlyOrderCoinFloor ?? 0
  const sum = order.slots.reduce((acc, slot) => {
    const coins = coinOf(cfg, slot.line, slot.level)
    return acc + (coins > 0 ? coins : slot.level >= 2 ? floor : 0)
  }, 0)
  return Math.round(sum * scale)
}

export function arrangeOrders(state: GameState, now: number): void {
  if (state.phase === 'opening') return
  for (const order of state.orders) {
    if (order.scripted) continue
    if (orderSatisfied(state, order)) {
      if (order.readyAt == null) order.readyAt = now
    } else {
      order.readyAt = undefined
    }
  }
  state.orders.sort((a, b) => (a.readyAt ?? Number.POSITIVE_INFINITY) - (b.readyAt ?? Number.POSITIVE_INFINITY))
}

export function slotChecked(state: GameState, order: Order, index: number): boolean {
  const slot = order.slots[index]
  if (!slot) return false
  let need = 0
  for (let i = 0; i <= index; i++) {
    const other = order.slots[i]
    if (other && other.line === slot.line && other.level === slot.level) need += 1
  }
  let have = 0
  eachCell(state.board, (item, row, col) => {
    if (!item || item.kind !== 'product' || item.tag === 'bubble' || lockAt(state, row, col)) return
    if (item.line === slot.line && item.level === slot.level) have += 1
  })
  return have >= need
}

export function openCellCount(state: GameState): number {
  let count = 0
  eachCell(state.board, (_item, row, col) => {
    if (!lockAt(state, row, col)) count += 1
  })
  return count
}

export function orderReady(state: GameState, order: Order): boolean {
  return order.slots.some((slot) => !slot.filled && findProduct(state, slot.line, slot.level))
}

export function producerLevelOwned(state: GameState, id: string): number {
  let max = 0
  const look = (item: Item | null | undefined) => {
    if (item?.kind === 'producer' && item.producerId === id) max = Math.max(max, item.level)
  }
  eachCell(state.board, (item) => look(item))
  for (const item of state.pending) look(item)
  for (const item of state.rewards) look(item)
  return max
}

export function orderCraftable(state: GameState, cfg: GameConfig, line: string, level: number): boolean {
  const cap = cfg.items.lines.find((entry) => entry.id === line)?.levels.length ?? PRODUCT_CAP
  if (level < 1 || level > cap) return false
  const need = cfg.economy.producerOutputLevel ?? cfg.economy.producerSpawnLevel
  const direct = cfg.producers.find((entry) => entry.line === line && entry.kind !== 'consumable')
  if (direct && direct.line !== 'net') return producerLevelOwned(state, direct.id) >= need
  const parent = cfg.producers.find((entry) => entry.side === line)
  if (!parent) return false
  return producerLevelOwned(state, parent.id) >= (cfg.economy.producerSideLevel ?? 5)
}

function ownedLines(state: GameState, cfg: GameConfig): string[] {
  const lines: string[] = []
  for (const producer of cfg.producers) {
    if (producer.kind === 'consumable' || producer.line === 'net') continue
    if (producerLevelOwned(state, producer.id) <= 0 && !state.hasProducer[producer.id]) continue
    lines.push(producer.line)
    if (producer.side && producerLevelOwned(state, producer.id) >= (cfg.economy.producerSideLevel ?? 5)) lines.push(producer.side)
  }
  if (!lines.length) lines.push('food')
  return [...new Set(lines)]
}

function maxOrderLevel(state: GameState, line: string): number {
  const unlocked = state.unlocked[line] ?? 0
  if (unlocked >= 6) return 6
  if (unlocked >= 4) return unlocked
  return 3
}

const GUEST_ROTATION = ['boatman', 'embroider', 'fisherman', 'squire', 'scholar', 'siamese', 'bossDaughter']

/** 调参打开时，订单区固定带上阿桨和鲍大叔，方便看序列帧。默认关闭。 */
export function applyTestGuests(state: GameState, cfg: GameConfig): void {
  if ((cfg.economy.testOrderGuests ?? 0) < 1) return
  if (state.phase === 'story') return
  const wanted = ['boatman', 'fisherman']
  const missing = wanted.filter((id) => !state.orders.some((order) => order.customerId === id))
  for (const id of missing) {
    const donor = state.orders.find((order) => !wanted.includes(order.customerId))
    if (donor) {
      donor.customerId = id
      continue
    }
    state.orderCounter += 1
    state.orders.push({
      id: `test${state.orderCounter}`,
      customerId: id,
      slots: [{ line: 'food', level: 1, filled: false }],
      big: false,
    })
  }
}

function nextGuest(state: GameState): string {
  const busy = new Set(state.orders.map((order) => order.customerId))
  for (let step = 0; step < GUEST_ROTATION.length; step++) {
    const id = GUEST_ROTATION[(state.orderCounter + step) % GUEST_ROTATION.length]
    if (id && !busy.has(id)) return id
  }
  return GUEST_ROTATION[state.orderCounter % GUEST_ROTATION.length] ?? 'boatman'
}

function pickWeightedLine(state: GameState, cfg: GameConfig, rng: Rng, lines: string[]): string {
  const used = new Set(state.orders.flatMap((order) => order.slots.map((slot) => slot.line)))
  const weights = lines.map((line) => {
    let weight = line === state.newestLine ? cfg.economy.newChainWeight || 3 : 1
    if (used.size === 1 && used.has(line) && lines.length > 1) weight *= 0.2
    if (used.size > 0 && !used.has(line)) weight *= 3
    return weight
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1
  let roll = rng() * total
  for (let i = 0; i < lines.length; i++) {
    roll -= weights[i] ?? 0
    if (roll <= 0) return lines[i] ?? lines[0] ?? 'food'
  }
  return lines[0] ?? 'food'
}

function generateEarlyOrder(state: GameState, cfg: GameConfig, rng: Rng, lines: string[]): Order | null {
  const pickLine = () => pickWeightedLine(state, cfg, rng, lines)
  const slots: Order['slots'] = []
  const aChance = cfg.economy.earlyOrderAChance ?? 0.45
  if (rng() < aChance) {
    slots.push({ line: pickLine(), level: cfg.economy.earlyOrderALevel ?? 5, filled: false })
  } else {
    const min = cfg.economy.earlyOrderBMin ?? 2
    const max = Math.max(min, cfg.economy.earlyOrderBMax ?? 3)
    const span = max - min + 1
    const first = pickLine()
    slots.push({ line: first, level: min + Math.floor(rng() * span), filled: false })
    const mix = lines.filter((line) => line !== first)
    const second = mix.length && rng() < (cfg.economy.mixLineChance ?? 0.8) ? mix[Math.floor(rng() * mix.length)] ?? first : pickLine()
    slots.push({ line: second, level: min + Math.floor(rng() * span), filled: false })
  }
  if (!slots.every((slot) => orderCraftable(state, cfg, slot.line, slot.level))) return null
  const customerId = nextGuest(state)
  state.orderCounter += 1
  return { id: `o${state.orderCounter}`, customerId, slots, big: false, chest: false }
}

export function generateOrder(state: GameState, cfg: GameConfig, rng: Rng): Order | null {
  const lines = ownedLines(state, cfg)
  if (!lines.length) return null
  if (state.level <= (cfg.economy.earlyOrderUntil ?? 3)) return generateEarlyOrder(state, cfg, rng, lines)
  const fallback = lines[0] ?? 'food'
  let line = fallback
  if (state.orderBias && lines.includes(state.orderBias)) {
    line = state.orderBias
    state.orderBias = null
  } else if (lines.length) {
    line = pickWeightedLine(state, cfg, rng, lines)
  }
  const maxLv = maxOrderLevel(state, line)
  const big = maxLv >= 6 && rng() < cfg.orders.bigChance
  const slots: Order['slots'] = []
  if (big) {
    slots.push({ line, level: 6, filled: false })
  } else {
    const ceiling = Math.min(maxLv, 5)
    const span = Math.max(1, ceiling - 2)
    slots.push({ line, level: 3 + Math.floor(rng() * span), filled: false })
    if (rng() < cfg.orders.twoSlotChance) {
      const mix = lines.filter((entry) => entry !== line)
      const line2 =
        mix.length && rng() < (cfg.economy.mixLineChance ?? 0.8)
          ? mix[Math.floor(rng() * mix.length)] ?? line
          : lines[Math.floor(rng() * lines.length)] ?? line
      const ceiling2 = Math.min(maxOrderLevel(state, line2), 5)
      const span2 = Math.max(1, ceiling2 - 2)
      slots.push({ line: line2, level: 3 + Math.floor(rng() * span2), filled: false })
    }
  }
  const customerId = nextGuest(state)
  const chest = state.phase === 'play' && rng() < cfg.economy.chestOrderChance
  state.orderCounter += 1
  const order: Order = {
    id: `o${state.orderCounter}`,
    customerId: chest ? 'raccoon' : customerId,
    slots,
    big,
    chest,
  }
  if (!order.slots.every((slot) => orderCraftable(state, cfg, slot.line, slot.level))) return null
  return order
}

function producerLevel(state: GameState, id: string): number {
  let level = 0
  eachCell(state.board, (item) => {
    if (item?.kind === 'producer' && item.producerId === id) level = Math.max(level, item.level)
  })
  for (const item of [...state.pending, ...state.rewards]) {
    if (item.kind === 'producer' && item.producerId === id) level = Math.max(level, item.level)
  }
  return level
}

const LINE_PRODUCER: Record<string, string> = {
  food: 'food',
  meat: 'food',
  bev: 'bev',
  mint: 'bev',
  toy: 'toy',
  wand: 'toy',
  bed: 'bed',
  fish: 'boat',
  plant: 'plant',
}

function lineUnlocked(state: GameState, cfg: GameConfig, line: string): boolean {
  const id = LINE_PRODUCER[line]
  if (!id) return false
  const def = cfg.producers.find((entry) => entry.id === id)
  const from = line === def?.side ? (def?.sideFrom ?? 99) : (def?.produceFrom ?? 99)
  return producerLevel(state, id) >= from
}

function rememberLines(state: GameState, slots: { line: string }[]): void {
  state.orderedLines ??= []
  for (const slot of slots) {
    if (!state.orderedLines.includes(slot.line)) state.orderedLines.push(slot.line)
  }
}

function pushEarly(state: GameState, cfg: GameConfig, spec: NonNullable<ReturnType<typeof earlyOrder>>): void {
  state.orderCounter += 1
  let paySmile = 0
  let smilePending = 0
  let smileWait: Order['smileWait']
  if (spec.smile > 0 && spec.smileTiming === 'onAppear') paySmile = spec.smile
  else if (spec.smile > 0 && spec.smileTiming === 'onSmileUnlock') {
    if (state.level >= (cfg.economy.smileUnlockLevel ?? 4)) paySmile = spec.smile
    else {
      smilePending = spec.smile
      smileWait = 'unlock'
    }
  } else if (spec.smile > 0 && spec.smileTiming === 'afterClaim') {
    smilePending = spec.smile
    smileWait = 'claim'
  }
  state.orders.push({
    id: `e${spec.no}`,
    customerId: spec.no === 1 ? 'xiaotao' : ['boatman', 'scholar', 'embroider', 'squire', 'fisherman'][spec.no % 5] ?? 'boatman',
    slots: spec.items.map((item) => ({ line: item.line, level: item.level, filled: false })),
    big: false,
    scripted: spec.no === 1,
    earlyNo: spec.no,
    payCoins: spec.coins,
    paySmile,
    smilePending,
    smileWait,
  })
  rememberLines(state, spec.items)
}

export function syncEarlyOrders(state: GameState, cfg: GameConfig): void {
  state.orderSeq ??= 1
  state.heldOrders ??= []
  if (state.lesson === 'home1' || state.lesson === 'talk1' || state.lesson === 'merge' || state.lesson === 'mergeC' || state.lesson === 'mergeD') return
  if (state.orderSeq > 131) return
  let guard = 0
  while (guard < 12 && state.orderSeq <= 131) {
    const spec = earlyOrder(state.orderSeq)
    if (!spec) break
    const shownCaps = state.orders.map((order) => earlyOrder(order.earlyNo ?? 0)?.maxOnScreen ?? spec.maxOnScreen)
    const cap = Math.min(spec.maxOnScreen, ...shownCaps)
    if (state.orders.length >= cap) break
    state.orderSeq += 1
    pushEarly(state, cfg, spec)
    guard += 1
  }
}

const FOOD_LINES = ['food', 'meat', 'bev', 'mint', 'fish']
const EASY_LINES = new Set(['food', 'bev'])

function lateLevel(line: string, playerLevel: number, rng: Rng): number {
  if (EASY_LINES.has(line)) {
    if (playerLevel >= 10 && rng() < 0.25) return rng() < 0.5 ? 7 : 8
    return 3 + Math.floor(rng() * 4)
  }
  if (line === 'toy' || line === 'wand' || line === 'bed') return 3 + Math.floor(rng() * 4)
  if (line === 'plant') return 3 + Math.floor(rng() * (playerLevel >= 10 ? 4 : 3))
  return 3 + Math.floor(rng() * (playerLevel >= 10 ? 4 : 3))
}

function lateOrder(state: GameState, cfg: GameConfig, slots: { line: string; level: number }[], blocker = false): Order {
  const coins = slots.reduce((sum, slot) => sum + unitPrice(slot.line, slot.level), 0)
  const high = slots.some((slot) => (EASY_LINES.has(slot.line) ? slot.level >= 8 : slot.level >= 6))
  const smile = high ? 2 : 1
  const roundFull = state.smiles >= cfg.economy.smileGoal
  state.orderCounter += 1
  rememberLines(state, slots)
  return {
    id: `l${state.orderCounter}`,
    customerId: ['boatman', 'scholar', 'embroider', 'squire', 'fisherman'][state.orderCounter % 5] ?? 'boatman',
    slots: slots.map((slot) => ({ line: slot.line, level: slot.level, filled: false })),
    big: high,
    payCoins: coins,
    paySmile: roundFull ? 0 : smile,
    smilePending: roundFull ? smile : 0,
    smileWait: roundFull ? 'claim' : undefined,
    blocker,
  }
}

function generateLateOrder(state: GameState, cfg: GameConfig, rng: Rng): Order | null {
  const lines = ['food', 'meat', 'bev', 'mint', 'toy', 'wand', 'bed', 'fish', 'plant'].filter((line) => lineUnlocked(state, cfg, line))
  if (!lines.length) return null
  const fresh = lines.find((line) => !(state.orderedLines ?? []).includes(line))
  if (fresh) return lateOrder(state, cfg, [{ line: fresh, level: lateLevel(fresh, state.level, rng) }])
  const goal = cfg.economy.smileGoal
  if (state.level >= (cfg.economy.blockFromLevel ?? 10) && state.smiles >= goal - 1 && state.smiles < goal) {
    const pool = [
      lineUnlocked(state, cfg, 'fish') ? { line: 'fish', level: 6 } : null,
      lineUnlocked(state, cfg, 'plant') ? { line: 'plant', level: state.level >= 10 ? 6 : 5 } : null,
      lineUnlocked(state, cfg, 'mint') ? { line: 'mint', level: 6 } : null,
      lineUnlocked(state, cfg, 'meat') ? { line: 'meat', level: 6 } : null,
      lineUnlocked(state, cfg, 'bev') ? { line: 'bev', level: 8 } : null,
    ].filter((entry): entry is { line: string; level: number } => !!entry)
    const pick = pool[Math.floor(rng() * pool.length)]
    if (pick) {
      state.lateBlock = true
      return lateOrder(state, cfg, [pick], true)
    }
  }
  const share = cfg.economy.foodDrinkShare ?? BALANCE.ordersLate.foodDrinkShare
  const food = lines.filter((line) => FOOD_LINES.includes(line))
  const other = lines.filter((line) => !FOOD_LINES.includes(line))
  const wantFood = rng() < share
  let group = wantFood && food.length ? food : other.length ? other : lines
  const crowded = (line: string) => state.orders.filter((order) => order.slots[0]?.line === line).length >= 2
  const open = group.filter((line) => !crowded(line))
  if (open.length) group = open
  const line = group[Math.floor(rng() * group.length)] ?? lines[0]
  if (!line) return null
  const roll = rng()
  const count = roll < 0.45 ? 1 : roll < 0.9 ? 2 : 3
  const slots = Array.from({ length: count }, () => ({ line, level: lateLevel(line, state.level, rng) }))
  return lateOrder(state, cfg, slots)
}

export function fillOrders(state: GameState, cfg: GameConfig, rng: Rng): void {
  syncEarlyOrders(state, cfg)
  if ((state.orderSeq ?? 1) <= 131) return
  if (state.lateBlock) return
  if (state.smiles >= cfg.economy.smileGoal) return
  const cap = Math.min(cfg.orders.maxActive, BALANCE.ordersLate.maxOnScreen)
  let guard = 0
  while (state.orders.length < cap && guard < 8) {
    const order = generateLateOrder(state, cfg, rng)
    if (!order) break
    state.orders.push(order)
    guard += 1
    if (order.blocker) break
  }
}

export function orderSatisfied(state: GameState, order: Order): boolean {
  const need = new Map<string, number>()
  for (const slot of order.slots) {
    const key = `${slot.line}:${slot.level}`
    need.set(key, (need.get(key) ?? 0) + 1)
  }
  const have = new Map<string, number>()
  eachCell(state.board, (item, row, col) => {
    if (!item || item.kind !== 'product' || item.tag === 'bubble' || lockAt(state, row, col)) return
    const key = `${item.line}:${item.level}`
    have.set(key, (have.get(key) ?? 0) + 1)
  })
  for (const [key, count] of need) {
    if ((have.get(key) ?? 0) < count) return false
  }
  return true
}

export function orderTakeCells(state: GameState, order: Order): Pos[] {
  if (!orderSatisfied(state, order)) return []
  const need = new Map<string, number>()
  for (const slot of order.slots) {
    const key = `${slot.line}:${slot.level}`
    need.set(key, (need.get(key) ?? 0) + 1)
  }
  const cells: Pos[] = []
  eachCell(state.board, (item, row, col) => {
    if (!item || item.kind !== 'product' || item.tag === 'bubble' || lockAt(state, row, col)) return
    const key = `${item.line}:${item.level}`
    const left = need.get(key) ?? 0
    if (left <= 0) return
    cells.push({ row, col })
    need.set(key, left - 1)
  })
  return cells
}

function takeMatches(state: GameState, order: Order): void {
  for (const pos of orderTakeCells(state, order)) state.board[pos.row][pos.col] = null
}

export function orderMarks(state: GameState): { check: string[]; ready: string[] } {
  const check: string[] = []
  const pool = new Map<string, Pos[]>()
  eachCell(state.board, (item, row, col) => {
    if (!item || item.kind !== 'product' || item.tag === 'bubble' || lockAt(state, row, col)) return
    const key = `${item.line}:${item.level}`
    const list = pool.get(key)
    if (list) list.push({ row, col })
    else pool.set(key, [{ row, col }])
    const hit = state.orders.some((order) =>
      order.slots.some((slot) => slot.line === item.line && slot.level === item.level),
    )
    if (hit) check.push(`${row},${col}`)
  })
  const ready = new Set<string>()
  const left = new Map<string, Pos[]>()
  for (const [key, cells] of pool) left.set(key, cells.slice())
  for (const order of state.orders) {
    const need = new Map<string, number>()
    for (const slot of order.slots) {
      const key = `${slot.line}:${slot.level}`
      need.set(key, (need.get(key) ?? 0) + 1)
    }
    let enough = true
    for (const [key, count] of need) {
      if ((left.get(key)?.length ?? 0) < count) {
        enough = false
        break
      }
    }
    if (!enough) continue
    for (const [key, count] of need) {
      const cells = left.get(key) ?? []
      for (let i = 0; i < count; i++) {
        const pos = cells.shift()
        if (pos) ready.add(`${pos.row},${pos.col}`)
      }
    }
  }
  return { check, ready: [...ready] }
}

export function orderPayout(order: Order, cfg: GameConfig): { coins: number; xp: number; smiles: number } {
  if (order.payCoins != null) return { coins: order.payCoins, xp: 0, smiles: order.paySmile ?? 0 }
  let coins = orderReward(order, cfg)
  if (order.chest) coins = Math.round(coins * cfg.economy.chestRewardTimes)
  return { coins, xp: 0, smiles: order.paySmile ?? 0 }
}

function makeBag(state: GameState): Item {
  const item = makeProduct(state, 'food', 2)
  if (item.kind === 'product') item.tag = 'bag'
  return item
}

export function neededMaterials(state: GameState): { line: string; level: number }[] {
  const out: { line: string; level: number }[] = []
  for (const order of state.orders) {
    for (const slot of order.slots) {
      if (slot.level >= 3) out.push({ line: slot.line, level: slot.level })
    }
  }
  return out
}

function pickMaterial(state: GameState, cfg: GameConfig, rng: Rng): { line: string; level: number } {
  const needs = neededMaterials(state)
  if (needs.length) return needs[Math.floor(rng() * needs.length)] ?? needs[0]
  const lines = ownedLines(state, cfg)
  return { line: lines[Math.floor(rng() * Math.max(1, lines.length))] ?? 'food', level: 3 }
}

function grantMaterials(state: GameState, cfg: GameConfig, rng: Rng, count: number): string[] {
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const mat = pickMaterial(state, cfg, rng)
    const item = makeProduct(state, mat.line, mat.level)
    noteUnlock(state, mat.line, mat.level)
    queueReward(state, item)
    names.push(productName(cfg, mat.line, mat.level))
  }
  return names
}

export function completeOrder(
  state: GameState,
  orderId: string,
  cfg: GameConfig,
  rng: Rng,
  now: number,
): ActionResult {
  const order = state.orders.find((entry) => entry.id === orderId)
  if (!order) return { ok: false, reason: 'no-order', events: [] }
  if (!orderSatisfied(state, order)) {
    return { ok: false, reason: 'short', events: [{ type: 'toast', text: '棋盘上还没齐' }] }
  }
  takeMatches(state, order)
  const pay = orderPayout(order, cfg)
  state.coins += pay.coins
  state.smiles += pay.smiles
  state.stats.ordersDone += 1
  logAction(state, now, 'order')
  const dialogue = order.big || order.chest ? talkOf(cfg, order.customerId, true) : undefined
  state.orders = state.orders.filter((entry) => entry.id !== orderId)
  if (order.blocker) state.lateBlock = false
  if (state.phase === 'play' || state.lesson === 'deliver') fillOrders(state, cfg, rng)
  if (order.scripted && state.lesson === 'deliver') state.lesson = 'free'
  if (order.earlyNo === 2 && !state.tasksDone.includes('s1')) {
    state.storyCard = { no: 1 }
    state.storyForce = true
  }
  if (order.earlyNo === 4 && nextTask(state, cfg)?.id === 's2') {
    state.storyCard = { no: 2, line: '想要更多顾客？快来收拾一下餐厅吧！' }
    state.storyForce = true
  }
  if (state.smileLesson === 'order' && ((order.paySmile ?? 0) > 0 || (order.smilePending ?? 0) > 0)) state.smileLesson = 'off'
  arrangeOrders(state, now)
  if (order.chest) grantMaterials(state, cfg, rng, cfg.economy.chestBonusItems)
  if (state.mintStep === 'deliver' && order.slots.some((slot) => slot.line === 'mint')) state.mintStep = 'off'
  if (order.scripted && atStep(state, cfg, 'deliver')) {
    advanceTutorial(state, cfg)
    state.bagPhase = 'place'
    const spot = cfg.board.roles.bagSpot
    const occupant = state.board[spot.row][spot.col]
    if (occupant) state.pending.unshift(occupant)
    state.board[spot.row][spot.col] = makeBag(state)
    const empty = findEmpty(state)[0]
    if (empty) state.board[empty.row][empty.col] = makeBag(state)
    else state.pending.push(makeBag(state))
  }
  const events: GameEvent[] = [
    {
      type: 'deliver',
      orderId,
      coins: pay.coins,
      xp: pay.xp,
      smiles: pay.smiles,
      big: order.big,
      chest: !!order.chest,
      customerId: order.customerId,
      dialogue,
    },
    ...reconcileLevel(state, cfg, rng),
  ]
  return { ok: true, events }
}

export function openSmilePrize(state: GameState, cfg: GameConfig, rng: Rng): ActionResult {
  const goal = cfg.economy.smileGoal
  if (state.smiles < goal) return { ok: false, reason: 'smiles', events: [] }
  const extra = state.smiles - goal
  for (const order of state.orders) {
    if (order.smileWait === 'claim' && order.smilePending) {
      order.paySmile = (order.paySmile ?? 0) + order.smilePending
      order.smilePending = 0
      order.smileWait = undefined
    }
  }
  state.smiles = 0
  const finished = state.smileRound ?? 1
  state.smileRound = finished + 1
  cfg.economy.smileGoal = smileRoundTarget(finished + 1) ?? 10
  state.lateBlock = false
  if (extra > 0) {
    queueReward(state, { uid: nextUid(state, 's'), kind: 'rewardBox', box: 'smile', n: extra })
  }
  const names: string[] = []
  for (const piece of smileRoundReward(finished)) {
    for (let i = 0; i < piece.count; i++) {
      const item = makeProduct(state, piece.line, piece.level)
      noteUnlock(state, piece.line, piece.level)
      const spot = findEmpty(state)[0]
      if (spot) state.board[spot.row][spot.col] = item
      else queueReward(state, item)
      names.push(piece.name || productName(cfg, piece.line, piece.level))
    }
  }
  state.smileModal = { names }
  if (state.guide === 'smile') state.guide = 'none'
  fillOrders(state, cfg, rng)
  return { ok: true, events: [{ type: 'smile', count: names.length }] }
}

export function smilesVisible(state: GameState, cfg: GameConfig, now: number): boolean {
  if (state.level >= (cfg.economy.smileUnlockLevel ?? 4)) return true
  return now - state.playStartedAt >= cfg.economy.smileUiAfterMs
}

export function popPending(state: GameState): ActionResult {
  if (!state.pending.length) return { ok: false, reason: 'empty', events: [] }
  const spot = findEmpty(state)[0]
  if (!spot) return { ok: false, reason: 'full', events: [{ type: 'toast', text: '没有空格了' }] }
  const item = state.pending.shift()
  if (!item) return { ok: false, reason: 'empty', events: [] }
  state.board[spot.row][spot.col] = item
  return { ok: true, events: [{ type: 'placePending', row: spot.row, col: spot.col }] }
}

export function placeTutorialBag(state: GameState, cfg: GameConfig, pos: Pos): ActionResult {
  if (!atStep(state, cfg, 'bagDrag')) return { ok: false, reason: 'step', events: [] }
  const item = state.pending[0]
  if (!item) return { ok: false, reason: 'empty', events: [] }
  if (!inBoard(pos.row, pos.col) || state.board[pos.row][pos.col] || lockAt(state, pos.row, pos.col)) {
    return { ok: false, reason: 'blocked', events: [] }
  }
  state.pending.shift()
  state.board[pos.row][pos.col] = item
  state.bagPhase = 'merge'
  advanceTutorial(state, cfg)
  return { ok: true, events: [{ type: 'placePending', row: pos.row, col: pos.col }] }
}

export function orderCardAction(
  state: GameState,
  order: Order,
  x: number,
  y: number,
  button: { x: number; y: number; w: number; h: number },
): 'complete' | 'none' {
  const inside =
    button.w > 0 && x >= button.x && y >= button.y && x < button.x + button.w && y < button.y + button.h
  if (inside && orderSatisfied(state, order)) return 'complete'
  return 'none'
}

export function orderStripAction(input: {
  moved: boolean
  dx: number
  onComplete: boolean
  onIcon?: boolean
}): 'scroll' | 'complete' | 'icon' | 'none' {
  if (input.moved || Math.abs(input.dx) >= 8) return 'scroll'
  if (input.onComplete) return 'complete'
  if (input.onIcon) return 'icon'
  return 'none'
}

/** 越界后阻力变大，位移趋近 limit，到不了更远。 */
export function rubberOffset(distance: number, limit: number): number {
  if (limit <= 0 || distance <= 0) return 0
  return (distance * limit) / (distance + limit)
}

export function scrollOrders(start: number, dx: number, max: number, limit = 120): number {
  const raw = start - dx
  const cap = Math.max(0, max)
  if (raw < 0) return -rubberOffset(-raw, limit)
  if (raw > cap) return cap + rubberOffset(raw - cap, limit)
  return raw
}

/** 把订单条上的目标滚进屏幕。已经完全可见时不动。 */
export function revealOrderTarget(scroll: number, rect: { x: number; w: number }, viewW: number, max: number): number {
  const cap = Math.max(0, max)
  if (rect.w <= 0) return Math.min(cap, Math.max(0, scroll))
  const margin = 8
  let next = scroll
  if (rect.x < margin) next = scroll + rect.x - margin
  if (rect.x + rect.w > viewW - margin) next = scroll + rect.x + rect.w - (viewW - margin)
  return Math.min(cap, Math.max(0, next))
}

/** 松手后把客人吸到最近的固定桌位。 */
export function snapOrderScroll(scroll: number, pitch: number, max: number): number {
  const limit = Math.max(0, max)
  const clamped = Math.min(limit, Math.max(0, scroll))
  if (!(pitch > 0)) return clamped
  const snapped = Math.round(clamped / pitch) * pitch
  return Math.min(limit, Math.max(0, snapped))
}

export function storyLength(cfg: GameConfig): number {
  return cfg.opening.pages.reduce((sum, page) => sum + page.beats.length, 0)
}

export function advanceStory(state: GameState, cfg: GameConfig): void {
  if (state.phase !== 'story') return
  const next = state.storyStep + 1
  if (next >= storyLength(cfg)) {
    state.storySeen = true
    state.storyStep = storyLength(cfg)
    state.phase = 'opening'
    state.openingStep = 0
    state.lesson = 'home1'
    return
  }
  state.storyStep = next
}

export function skipStory(state: GameState): void {
  if (state.phase !== 'story') return
  state.storySeen = true
  state.phase = 'opening'
  state.openingStep = 0
  state.lesson = 'home1'
}

export const INFO_EMPTY = '点击棋子，在这里查看详细信息。'

export function feedsOrder(state: GameState, row: number, col: number): boolean {
  return orderMarks(state).check.includes(`${row},${col}`)
}

export function infoCaption(cfg: GameConfig, item: Item, now = 0): { title: string; usage: string } {
  if (item.kind === 'product') {
    const line = cfg.items.lines.find((entry) => entry.id === item.line)
    const name = item.tag === 'bag' ? '购物袋' : productName(cfg, item.line, item.level)
    const chain = line?.name ?? item.line
    const collect = line?.collect === 'gem' ? '再点一次收钻石' : line?.collect === 'coin' ? '再点一次收金币' : '两个相同的可以合成'
    return { title: name, usage: `${cnLevel(item.level)} · ${chain} · ${collect}` }
  }
  if (item.kind === 'producer') {
    const lineName = cfg.items.lines.find((line) => line.id === item.line)?.name ?? producerName(cfg, item.producerId)
    const cooling = producerCooldown(cfg, item, now)
    const status = cooling ? `冷却中，还剩 ${formatMs(cooling.left)}` : `剩余体力 ${item.charges}`
    return {
      title: producerPieceName(item.producerId, item.level) ?? producerName(cfg, item.producerId),
      usage: `${cnLevel(item.level)} · ${lineName} · ${status}`,
    }
  }
  if (item.kind === 'potion') {
    const amount = `${potionEnergy(cfg, item.tier)}点体力`
    return {
      title: cfg.copy.infoUse.replace('{amount}', String(potionEnergy(cfg, item.tier))),
      usage: cfg.copy.infoChain.replace('{amount}', amount),
    }
  }
  if (item.kind === 'gem') {
    const amount = `${gemAmount(cfg, item.tier)}颗钻石`
    return {
      title: cfg.copy.infoUse.replace('{amount}', String(gemAmount(cfg, item.tier))),
      usage: cfg.copy.infoChain.replace('{amount}', amount),
    }
  }
  if (item.kind === 'rewardBox') {
    const title = item.box === 'purple' ? '紫礼盒' : '购物袋'
    return { title: `${title}（奖励）`, usage: '点开得到一些棋子。' }
  }
  return { title: `${cfg.items.chestName}（宝箱）`, usage: '再点一次，出一瓶体力。出完这只宝箱就消失。' }
}

export interface ChainSlot {
  level: number
  label: string
  seen: boolean
  current: boolean
}

export function lineSeen(state: GameState, line: string, level: number): boolean {
  return (state.seen?.[line] ?? []).includes(level)
}

export function lineChain(cfg: GameConfig, state: GameState, line: string, current: number): ChainSlot[] {
  const def = cfg.items.lines.find((entry) => entry.id === line)
  return (def?.levels ?? []).map((level) => {
    const seen = lineSeen(state, line, level.level)
    return { level: level.level, label: seen ? level.name : '?', seen, current: level.level === current }
  })
}

export function producerOfLine(cfg: GameConfig, line: string): { id: string; name: string } | null {
  const found = cfg.producers.find((entry) => entry.line === line)
  return found ? { id: found.id, name: found.name } : null
}

export function producerChain(state: GameState, producerId: string, current: number, max = 8): ChainSlot[] {
  const seen = state.producerSeen?.[producerId] ?? []
  return Array.from({ length: max }, (_, index) => {
    const level = index + 1
    const known = seen.includes(level)
    return { level, label: known ? String(level) : '?', seen: known, current: level === current }
  })
}

export function tryAdvanceStory(state: GameState, cfg: GameConfig, tapped: boolean): boolean {
  if (state.phase !== 'story' || !tapped) return false
  advanceStory(state, cfg)
  return true
}

export function producerOutputs(cfg: GameConfig, state: GameState, line: string, level = 6): ChainSlot[] {
  const drops = levelSpec(cfg, line, level)?.drops ?? [1]
  return drops.map((drop) => {
    const name = productName(cfg, line, drop)
    const seen = lineSeen(state, line, drop)
    return { level: drop, label: seen ? name : '?', seen, current: false }
  })
}

export function canSell(state: GameState, item: Item | null): boolean {
  return state.phase === 'play' && !!item && item.kind === 'product'
}

export function sellPriceOf(cfg: GameConfig, level: number): number {
  return cfg.economy.sellPrices[level - 1] ?? 0
}

export function clearSale(state: GameState): void {
  state.sale = null
}

export function sellItem(state: GameState, cfg: GameConfig, pos: Pos): ActionResult {
  if (state.phase !== 'play') return { ok: false, reason: 'tutorial', events: [] }
  const item = state.board[pos.row]?.[pos.col]
  if (!canSell(state, item ?? null) || !item || item.kind !== 'product') return { ok: false, reason: 'unsellable', events: [] }
  if (lockAt(state, pos.row, pos.col)) return { ok: false, reason: 'locked', events: [] }
  const coins = sellPriceOf(cfg, item.level)
  state.board[pos.row][pos.col] = null
  state.coins += coins
  state.sale = { item, row: pos.row, col: pos.col, coins }
  return { ok: true, events: [{ type: 'toast', text: `+${coins}` }] }
}

export function undoSale(state: GameState): ActionResult {
  const sale = state.sale
  if (!sale) return { ok: false, reason: 'none', events: [] }
  if (state.board[sale.row]?.[sale.col] || lockAt(state, sale.row, sale.col)) {
    state.sale = null
    return { ok: false, reason: 'occupied', events: [{ type: 'toast', text: '原来的格子被占了' }] }
  }
  if (state.coins < sale.coins) return { ok: false, reason: 'coins', events: [{ type: 'toast', text: '铜钱不够，撤不回' }] }
  state.coins -= sale.coins
  state.board[sale.row][sale.col] = sale.item
  state.sale = null
  return { ok: true, events: [] }
}

export function storageTakeIndex(state: GameState, cfg: GameConfig): number {
  if (atStep(state, cfg, 'stashOut')) {
    const index = state.pending.findIndex((item) => item.kind === 'product' && item.tag === 'bag')
    return index >= 0 ? index : 0
  }
  return 0
}

export function storeItem(state: GameState, cfg: GameConfig, from: Pos): ActionResult {
  if (!state.storageOpen) return { ok: false, reason: 'closed', events: [] }
  if (state.phase === 'opening' && !atStep(state, cfg, 'stashIn')) return { ok: false, reason: 'tutorial', events: [] }
  if (!inBoard(from.row, from.col)) return { ok: false, reason: 'oob', events: [] }
  const item = state.board[from.row][from.col]
  if (!item) return { ok: false, reason: 'empty', events: [] }
  if (lockAt(state, from.row, from.col)) return { ok: false, reason: 'locked', events: [] }
  if (atStep(state, cfg, 'stashIn') && item.kind === 'product' && item.tag === 'bag') {
    return { ok: false, reason: 'tutorial', events: [] }
  }
  const cap = Math.max(1, cfg.economy.storageCapacity || 1)
  if (state.pending.length >= cap) {
    return {
      ok: false,
      reason: 'full',
      events: state.phase === 'opening' ? [] : [{ type: 'toast', text: '暂存区满了' }],
    }
  }
  state.board[from.row][from.col] = null
  state.pending.push(item)
  if (state.storageLesson === 2) state.storageLesson = 3
  if (atStep(state, cfg, 'stashIn')) advanceTutorial(state, cfg)
  return { ok: true, events: [] }
}

export function takeFromStorage(state: GameState, cfg: GameConfig, pos: Pos, index: number): ActionResult {
  if (state.phase === 'opening' && !atStep(state, cfg, 'stashOut')) return { ok: false, reason: 'tutorial', events: [] }
  const item = state.pending[index]
  if (!item) return { ok: false, reason: 'empty', events: [] }
  if (atStep(state, cfg, 'stashOut') && !(item.kind === 'product' && item.tag === 'bag')) {
    return { ok: false, reason: 'tutorial', events: [] }
  }
  if (!inBoard(pos.row, pos.col) || state.board[pos.row][pos.col] || lockAt(state, pos.row, pos.col)) {
    return { ok: false, reason: 'blocked', events: [] }
  }
  state.pending.splice(index, 1)
  state.board[pos.row][pos.col] = item
  if (state.storageLesson === 3) state.storageLesson = 4
  if (atStep(state, cfg, 'stashOut')) advanceTutorial(state, cfg)
  return { ok: true, events: [{ type: 'placePending', row: pos.row, col: pos.col }] }
}

export function guardedDrop(state: GameState, from: Pos, to: Pos, cfg: GameConfig): ActionResult {
  if (state.phase === 'opening' && !tutorialDropOk(state, cfg, from, to)) {
    return { ok: false, reason: 'tutorial', events: [] }
  }
  return dropItem(state, from, to, cfg)
}

const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

export function cnLevel(level: number): string {
  return `${CN[level] ?? String(level)}级`
}

export function levelForTaskCount(count: number, cfg: GameConfig): number {
  return levelForXp(count * (cfg.economy.xpPerTask || 15), cfg)
}

/** 从这一级升到下一级要的经验。表用完后，每级再加 15。升级后经验重新累计，不把前面的级加在一起。 */
export function levelCost(cfg: GameConfig, fromLevel: number): number {
  const costs = cfg.economy.levelTaskThresholds.length ? cfg.economy.levelTaskThresholds : [30]
  const index = Math.max(0, fromLevel - 1)
  if (index < costs.length) return costs[index]!
  let cost = costs[costs.length - 1] ?? 30
  for (let i = costs.length; i <= index; i++) cost += 15
  return cost
}

/** 从 1 级起把总经验逐级扣掉，算出能到哪一级。 */
export function levelForXp(totalXp: number, cfg: GameConfig): number {
  let level = 1
  let left = Math.max(0, totalXp)
  for (let guard = 0; guard < 80; guard++) {
    const need = levelCost(cfg, level)
    if (left < need) break
    left -= need
    level += 1
  }
  return level
}

export function xpThresholds(cfg: GameConfig): number[] {
  const out: number[] = []
  let sum = 0
  const limit = Math.max(cfg.economy.levelTaskThresholds.length, 24)
  for (let level = 1; level <= limit; level++) {
    sum += levelCost(cfg, level)
    out.push(sum)
  }
  return out
}

function grantProducer(state: GameState, cfg: GameConfig, rng: Rng, id: string, level?: number, tray = false): GameEvent[] {
  const def = cfg.producers.find((p) => p.id === id)
  if (!def) return []
  const owned = producerLevelOwned(state, id) > 0
  const give = level ?? (owned ? 1 : (cfg.economy.firstProducerLevel ?? 4))
  state.hasProducer[id] = true
  state.newestLine = def.line
  state.orderBias = def.line
  state.producerLesson = id
  const made = makeProducer(state, id, cfg, give)
  const spot = tray ? null : findEmpty(state)[0]
  if (spot) {
    state.board[spot.row][spot.col] = made
    nudgeOrder(state, cfg, rng, def.line)
    state.notice = { text: `${def.name}放到棋盘上了。点一下，看看它能出什么。` }
    return [
      { type: 'grant', kind: 'producer', name: def.name, row: spot.row, col: spot.col, pending: false },
      { type: 'toast', text: `${def.name}到了` },
    ]
  }
  queueReward(state, made)
  nudgeOrder(state, cfg, rng, def.line)
  state.notice = { text: `${def.name}先放在奖励框里，棋盘空了再拿出来。` }
  return [
    { type: 'grant', kind: 'producer', name: def.name, row: -1, col: -1, pending: true },
    { type: 'toast', text: `${def.name}先放进奖励框` },
  ]
}

export function nudgeOrder(state: GameState, cfg: GameConfig, rng: Rng, line: string): void {
  state.orderBias = line
  if (state.phase !== 'play') return
  for (let i = state.orders.length - 1; i >= 0; i--) {
    const order = state.orders[i]
    if (order.scripted || order.earlyNo != null) continue
    if (order.slots.some((slot) => slot.filled)) continue
    const next = generateOrder(state, cfg, rng)
    if (next) state.orders[i] = next
    return
  }
}

export function reconcileLevel(state: GameState, cfg: GameConfig, _rng: Rng): GameEvent[] {
  const events: GameEvent[] = []
  for (let guard = 0; guard < 40; guard++) {
    const need = levelCost(cfg, state.level)
    if (state.xp < need) break
    state.xp -= need
    state.level += 1
    if (state.level >= (cfg.economy.smileUnlockLevel ?? 4)) {
      for (const order of state.orders) {
        if (order.smileWait === 'unlock' && order.smilePending) {
          order.paySmile = (order.paySmile ?? 0) + order.smilePending
          order.smilePending = 0
          order.smileWait = undefined
        }
      }
    }
    const table = cfg.economy.levelRewards.find((entry) => entry.level === state.level)
    const rewards = table?.rewards.map((entry) => ({ ...entry })) ?? []
    const modal = { level: state.level, rewards }
    if (state.levelModal) state.levelQueue.push(modal)
    else state.levelModal = modal
    const names = rewards.map((entry) => entry.name).join('、')
    events.push({ type: 'levelup', level: state.level, text: names ? `升到${cnLevel(state.level)}：${names}` : `升到${cnLevel(state.level)}` })
  }
  if (state.level >= cfg.economy.storageUnlockLevel) {
    state.storageOpen = true
    if (state.storageLesson === 0) state.storageLesson = 1
  }
  return events
}

export function claimLevelModal(state: GameState, cfg: GameConfig, rng: Rng): ActionResult {
  const modal = state.levelModal
  if (!modal) return { ok: false, reason: 'none', events: [] }
  const events: GameEvent[] = []
  const giftBundle = modal.rewards.filter((reward) => reward.id === 'gift').flatMap((reward) => reward.bundle ?? [])
  for (const reward of modal.rewards) {
    if (reward.id === 'gift') continue
    events.push(...grantRewardEntry(state, cfg, rng, reward))
  }
  const fromField = parseLevelGift(levelGiftText(modal.level))
  const giftRewards = giftBundle.length ? giftBundle : fromField.rewards
  if (giftRewards.length || fromField.lock) {
    state.giftModal = {
      mode: giftRewards.length ? 'claim' : 'locked',
      title: giftRewards.length ? '新手大礼包' : '新手大礼包上锁',
      rewards: giftRewards,
      lockText: fromField.lock,
    }
  }
  if (modal.level === 3) {
    state.shopOpen = true
    state.notice = { text: '商城开了。每天可以领 50 体力。' }
  }
  if (modal.level === 4 && !state.smileTaught) {
    state.smileTaught = true
    state.smileLesson = state.giftModal ? 'wait' : 'order'
  }
  state.levelModal = state.levelQueue.shift() ?? null
  return { ok: true, events }
}

function rollBoxDrops(state: GameState, cfg: GameConfig, rng: Rng, box: 'purple' | 'bag'): LootDrop[] {
  const count = box === 'purple' ? cfg.economy.purpleBoxCount : cfg.economy.bagBoxCount
  const drops: LootDrop[] = []
  const goods = box === 'purple' ? Math.max(0, count - 2) : count
  for (let i = 0; i < goods; i++) {
    const mat = pickMaterial(state, cfg, rng)
    const item = makeProduct(state, mat.line, mat.level)
    noteUnlock(state, mat.line, mat.level)
    drops.push({ item })
  }
  if (box === 'purple') {
    drops.push({ coins: cfg.economy.boxCoin ?? 8 })
    drops.push({ gems: cfg.economy.boxGem ?? 1 })
  }
  return drops
}

export function makeRewardBox(state: GameState, cfg: GameConfig, rng: Rng, box: 'purple' | 'bag'): Item {
  const item: Item = { uid: nextUid(state, 'g'), kind: 'rewardBox', box, drops: rollBoxDrops(state, cfg, rng, box) }
  if (state.chestLesson === 0) state.chestLesson = 1
  return item
}

export function openRewardBox(state: GameState, pos: Pos, cfg: GameConfig, rng: Rng): ActionResult {
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || item.kind !== 'rewardBox') return { ok: false, reason: 'not-box', events: [] }
  if (item.box === 'smile') {
    state.board[pos.row][pos.col] = null
    state.smiles += item.n ?? 1
    return { ok: true, events: [{ type: 'toast', text: `笑脸 +${item.n ?? 1}` }] }
  }
  if (!item.drops) item.drops = rollBoxDrops(state, cfg, rng, item.box)
  const left = popLoot(state, cfg, pos, item.drops)
  if (left <= 0) state.board[pos.row][pos.col] = null
  return { ok: true, events: [{ type: 'openChest', row: pos.row, col: pos.col, count: 1 }] }
}

export function unlockGift(state: GameState, pos: Pos, cfg?: GameConfig): ActionResult {
  const lock = lockAt(state, pos.row, pos.col)
  if (!lock || lock.cover !== 'gift') return { ok: false, reason: 'not-gift', events: [] }
  state.locks = state.locks.filter((entry) => entry.row !== pos.row || entry.col !== pos.col)
  const buried = lock.buried
  if (buried.kind === 'coin') state.coins += buried.amount
  else if (buried.kind === 'gem') state.board[pos.row][pos.col] = makeGem(state, buried.tier)
  else if (buried.kind === 'potion') state.board[pos.row][pos.col] = makePotion(state, buried.tier)
  else if (buried.kind === 'producer' && cfg) {
    state.board[pos.row][pos.col] = makeProducer(state, buried.id, cfg, buried.level)
  } else if (buried.kind === 'product') {
    state.board[pos.row][pos.col] = makeProduct(state, buried.line, buried.level)
    noteUnlock(state, buried.line, buried.level)
  }
  revealAround(state, pos.row, pos.col)
  if (cfg && (atStep(state, cfg, 'giftTap') || atStep(state, cfg, 'giftRush'))) advanceTutorial(state, cfg)
  const level = buried.kind === 'product' || buried.kind === 'producer' ? buried.level : buried.kind === 'coin' ? 1 : buried.tier
  const line = buried.kind === 'product' ? buried.line : buried.kind === 'producer' ? buried.id : buried.kind
  return { ok: true, events: [{ type: 'unlock', row: pos.row, col: pos.col, line, level }] }
}

export function pokeGift(state: GameState, pos: Pos, cfg: GameConfig, now: number): ActionResult {
  const lock = lockAt(state, pos.row, pos.col)
  if (!lock || lock.cover !== 'gift') return { ok: false, reason: 'not-gift', events: [] }
  if (lock.giftUntil == null) {
    lock.giftUntil = now + cfg.economy.giftCooldownMs
    if (atStep(state, cfg, 'giftTap')) advanceTutorial(state, cfg)
    return { ok: true, events: [{ type: 'toast', text: '冷却开始' }] }
  }
  if (now >= lock.giftUntil) return unlockGift(state, pos, cfg)
  return { ok: true, reason: 'cooling', events: [] }
}

export function rushProducer(state: GameState, pos: Pos, cfg: GameConfig, mode: 'free' | 'gem' | 'ad'): ActionResult {
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || item.kind !== 'producer') return { ok: false, reason: 'not-producer', events: [] }
  if (mode === 'gem') {
    const cost = cfg.economy.giftRushGems ?? 2
    if (state.gems < cost) return { ok: false, reason: 'gems', events: [{ type: 'toast', text: '钻石不够' }] }
    state.gems -= cost
  }
  item.charges = chargesForLevel(cfg, item.level)
  item.cooldownUntil = 0
  return { ok: true, events: [{ type: 'toast', text: mode === 'ad' ? '广告看完，母棋恢复了' : '母棋恢复了' }] }
}

export type GuideSpot = 'reward' | 'chest' | 'producer' | 'build' | 'repair' | 'back' | 'smile' | 'rush'

export function guideSpot(state: GameState, cfg?: GameConfig): GuideSpot | null {
  if (state.chestLesson === 1) return 'reward'
  if (state.chestLesson === 2 && state.chestCell) return 'chest'
  if (state.producerLesson) return findProducer(state, state.producerLesson) ? 'producer' : 'reward'
  if (cfg && atStep(state, cfg, 'giftRush')) return 'rush'
  if (state.guide === 'buildBtn') return 'build'
  if (state.guide === 'repairBtn') return 'repair'
  if (state.guide === 'backBtn') return 'back'
  if (state.guide === 'smile') return 'smile'
  return null
}

function isLootBox(item: Item | null | undefined): boolean {
  return item?.kind === 'chest'
}

function findBoardBox(state: GameState): Pos | null {
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      if (isLootBox(state.board[row]?.[col])) return { row, col }
    }
  }
  return null
}

function openingStepPossible(state: GameState, cfg: GameConfig): boolean {
  const step = currentTutorial(cfg, state)
  if (!step) return true
  const hasFood = (level: number) =>
    state.board.some((row) => row.some((item) => item?.kind === 'producer' && item.producerId === 'food' && item.level === level))
  if (step.id === 'merge') {
    const a = cfg.board.roles.mergeA
    const b = cfg.board.roles.mergeB
    const piece = (pos: { row: number; col: number }) => state.board[pos.row]?.[pos.col]
    const left = piece(a)
    const right = piece(b)
    return left?.kind === 'producer' && left.producerId === 'food' && right?.kind === 'producer' && right.producerId === 'food'
  }
  if (step.id === 'mergeC' || step.id === 'unlock') return hasFood(2)
  if (step.id === 'mergeD') return hasFood(3)
  return true
}

export function guideLockKey(state: GameState): string {
  return [state.phase, state.openingStep, state.chestLesson, state.producerLesson ?? '', state.mintStep, state.storageLesson, state.guide].join('|')
}

export function guideIsLocking(state: GameState, cfg?: GameConfig): boolean {
  if (state.phase === 'opening') return true
  if (guideSpot(state, cfg)) return true
  if (state.storageLesson > 0 && state.storageLesson < 4) return true
  if (state.mintStep === 'select' || state.mintStep === 'produce' || state.mintStep === 'merge' || state.mintStep === 'deliver') return true
  return false
}

/** 引导对不上棋盘，或玩家连点别处时，收起所有会锁输入的引导。 */
export function dismissStuckGuide(state: GameState, cfg: GameConfig): void {
  if (state.phase === 'opening') {
    state.phase = 'play'
    state.openingStep = cfg.copy.tutorial.length
    state.storySeen = true
  }
  if (state.chestLesson < 3) state.chestLesson = 3
  state.chestCell = null
  state.producerLesson = null
  if (state.mintStep === 'select' || state.mintStep === 'produce' || state.mintStep === 'merge' || state.mintStep === 'deliver' || state.mintStep === 'talk') {
    state.mintStep = 'off'
  }
  if (state.storageLesson > 0 && state.storageLesson < 4) state.storageLesson = 4
  if (state.guide !== 'none') state.guide = 'none'
  state.notice = null
}

function promoteOldBlueBox(item: Item): Item {
  if (item.kind === 'rewardBox' && (item as { box?: string }).box === 'blue') return { uid: item.uid, kind: 'chest' }
  return item
}

export function resolveGuides(state: GameState, cfg?: GameConfig): string[] {
  const notes: string[] = []
  state.rewards = state.rewards.map(promoteOldBlueBox)
  state.pending = state.pending.map(promoteOldBlueBox)
  state.board.forEach((row) => {
    row.forEach((item, col) => {
      if (item) row[col] = promoteOldBlueBox(item)
    })
  })
  const empty = findEmpty(state).length
  if (state.chestLesson === 1) {
    const index = state.rewards.findIndex((item) => isLootBox(item))
    if (index < 0 || empty === 0) {
      state.chestLesson = 3
      state.chestCell = null
      notes.push('chest')
    } else if (index > 0) {
      const [item] = state.rewards.splice(index, 1)
      if (item) state.rewards.unshift(item)
    }
  }
  if (state.chestLesson === 2) {
    const cell = state.chestCell
    const there = cell ? state.board[cell.row]?.[cell.col] : null
    if (!isLootBox(there)) {
      const found = findBoardBox(state)
      if (found) state.chestCell = found
      else if (empty > 0 && state.rewards.some((item) => isLootBox(item))) state.chestLesson = 1
      else {
        state.chestLesson = 3
        state.chestCell = null
        notes.push('chest')
      }
    }
  }
  if (cfg && state.phase === 'opening' && !openingStepPossible(state, cfg)) {
    state.phase = 'play'
    state.openingStep = cfg.copy.tutorial.length
    state.lesson = 'free'
    notes.push('opening')
  }
  if (state.producerLesson) {
    const onBoard = findProducer(state, state.producerLesson)
    const queued = state.rewards.some((item) => item.kind === 'producer' && item.producerId === state.producerLesson)
    if (onBoard && empty === 0) {
      state.producerLesson = null
      notes.push('producer')
    } else if (!onBoard) {
      if (queued && empty > 0) {
        const index = state.rewards.findIndex((item) => item.kind === 'producer' && item.producerId === state.producerLesson)
        if (index > 0) {
          const [item] = state.rewards.splice(index, 1)
          if (item) state.rewards.unshift(item)
        }
      } else {
        state.producerLesson = null
        notes.push('producer')
      }
    }
  }
  if (state.guide === 'smile' && cfg && state.smiles < cfg.economy.smileGoal) {
    state.guide = 'none'
    notes.push('smile')
  }
  if ((state.guide === 'buildTalk' || state.guide === 'buildBtn' || state.guide === 'repairBtn' || state.guide === 'backBtn') && cfg && !nextTask(state, cfg)) {
    state.guide = 'none'
    notes.push('build')
  }
  if (state.giftPrompt) {
    state.giftPrompt = null
    notes.push('gift')
  }
  if (state.storageLesson === 3 && empty === 0) {
    state.storageLesson = 4
    notes.push('storage')
  }
  if (state.mintStep === 'select' || state.mintStep === 'produce') {
    const bev = state.board.some((row) => row.some((item) => item?.kind === 'producer' && item.producerId === 'bev' && item.level >= 5))
    if (!bev) {
      state.mintStep = 'off'
      notes.push('mint')
    }
  } else if (state.mintStep === 'merge') {
    const piece = state.board.some((row) => row.some((item) => item?.kind === 'product' && item.line === 'mint'))
    if (!piece) {
      state.mintStep = 'off'
      notes.push('mint')
    }
  } else if (state.mintStep === 'deliver') {
    const ready = state.orders.some((order) => order.slots.some((slot) => slot.line === 'mint') && orderSatisfied(state, order))
    if (!ready) {
      state.mintStep = 'off'
      notes.push('mint')
    }
  }
  if (state.storageLesson === 2) {
    const any = state.board.some((row) => row.some((item) => item))
    if (!any) {
      state.storageLesson = 4
      notes.push('storage')
    }
  }
  if (cfg && state.phase === 'opening' && !currentTutorial(cfg, state)) {
    state.phase = 'play'
    state.openingStep = cfg.copy.tutorial.length
    state.storySeen = true
    notes.push('opening')
  }
  promoteFocusLesson(state)
  if (cfg && state.phase === 'opening') {
    let guard = 0
    while (state.phase === 'opening' && guard < 6 && !openingStepPossible(state, cfg)) {
      advanceTutorial(state, cfg)
      guard += 1
      notes.push('opening')
    }
  }
  if (cfg && state.phase === 'opening' && empty === 0 && currentTutorial(cfg, state)?.id === 'produce') {
    advanceTutorial(state, cfg)
    notes.push('produce')
  }
  if (cfg && atStep(state, cfg, 'giftRush')) {
    const gift = cfg.board.roles?.gift
    const lock = gift ? lockAt(state, gift.row, gift.col) : undefined
    if (!lock || lock.cover !== 'gift' || lock.giftUntil == null) {
      advanceTutorial(state, cfg)
      notes.push('rush')
    }
  }
  return notes
}

export function rushGift(state: GameState, pos: Pos, cfg: GameConfig, mode: 'free' | 'gem' | 'ad'): ActionResult {
  const lock = lockAt(state, pos.row, pos.col)
  if (!lock || lock.cover !== 'gift') return { ok: false, reason: 'not-gift', events: [] }
  if (mode === 'gem') {
    const cost = cfg.economy.giftRushGems ?? 2
    if (state.gems < cost) return { ok: false, reason: 'gems', events: [{ type: 'toast', text: '钻石不够' }] }
    state.gems -= cost
  }
  if (mode === 'free') state.giftFreeUsed = true
  state.giftPrompt = null
  lock.giftUntil = 0
  return unlockGift(state, pos, cfg)
}

export function settleGifts(state: GameState, cfg: GameConfig, now: number): void {
  settleClocks(state, now)
  if (atStep(state, cfg, 'giftTap') || atStep(state, cfg, 'giftRush')) return
  for (const lock of state.locks.slice()) {
    if (lock.cover !== 'gift' || lock.giftUntil == null || now < lock.giftUntil) continue
    unlockGift(state, { row: lock.row, col: lock.col }, cfg)
  }
}

export function collectLock(state: GameState, pos: Pos): ActionResult {
  const lock = lockAt(state, pos.row, pos.col)
  if (!lock || lock.cover === 'gift') return { ok: false, reason: 'not-cache', events: [] }
  if (lock.veil === 'full') return { ok: false, reason: 'covered', events: [{ type: 'toast', text: '这格还盖着' }] }
  if (lock.buried.kind === 'coin') {
    state.locks = state.locks.filter((entry) => entry.row !== pos.row || entry.col !== pos.col)
    state.coins += lock.buried.amount
    revealAround(state, pos.row, pos.col)
    return { ok: true, events: [{ type: 'toast', text: `铜钱 +${lock.buried.amount}` }] }
  }
  if (lock.buried.kind === 'gem') {
    state.locks = state.locks.filter((entry) => entry.row !== pos.row || entry.col !== pos.col)
    state.board[pos.row][pos.col] = makeGem(state, lock.buried.tier)
    revealAround(state, pos.row, pos.col)
    return { ok: true, events: [{ type: 'unlock', row: pos.row, col: pos.col, line: 'gem', level: lock.buried.tier }] }
  }
  return { ok: false, reason: 'not-cache', events: [] }
}

export function useGem(state: GameState, pos: Pos, cfg: GameConfig): ActionResult {
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || item.kind !== 'gem') return { ok: false, reason: 'not-gem', events: [] }
  const amount = gemAmount(cfg, item.tier)
  state.board[pos.row][pos.col] = null
  state.gems += amount
  state.armed = null
  state.chainPop = null
  return { ok: true, events: [{ type: 'toast', text: `钻石 +${amount}` }] }
}

export function buyEnergyWithGems(state: GameState, cfg: GameConfig, now: number): ActionResult {
  const price = gemEnergyPrice(cfg, state.gemBuys)
  if (state.gems < price) return { ok: false, reason: 'gems', events: [{ type: 'toast', text: '钻石不够' }] }
  state.gems -= price
  state.gemBuys += 1
  state.energy += cfg.economy.energyGemAmount
  if (state.energy >= cfg.economy.energyMax) state.energyTs = now
  return {
    ok: true,
    events: [
      { type: 'refill', amount: cfg.economy.energyGemAmount, mode: 'gem' },
      { type: 'toast', text: `体力 +${cfg.economy.energyGemAmount}` },
    ],
  }
}

export function enterKitchen(state: GameState, cfg?: GameConfig): void {
  if (state.phase !== 'opening') return
  if (cfg) {
    if (atStep(state, cfg, 'enter')) advanceTutorial(state, cfg)
    return
  }
  if (state.openingStep === 0) state.openingStep = 1
}

export function finishTutorial(state: GameState, cfg: GameConfig, rng: Rng): void {
  if (!atStep(state, cfg, 'build')) return
  state.storySeen = true
  state.phase = 'play'
  state.openingStep = cfg.copy.tutorial.length
  fillOrders(state, cfg, rng)
}

function checkStepGrants(state: GameState, cfg: GameConfig, rng: Rng): GameEvent[] {
  const events: GameEvent[] = []
  for (const producer of cfg.producers) {
    if (!producer.grant.startsWith('afterStep:')) continue
    const stepId = producer.grant.slice('afterStep:'.length)
    const step = cfg.buildings.steps.find((entry) => entry.id === stepId)
    if (!step) continue
    if (!step.tasks.every((task) => state.tasksDone.includes(task.id))) continue
    events.push(...grantProducer(state, cfg, rng, producer.id))
  }
  return events
}

export function allTasks(cfg: GameConfig): TaskDef[] {
  return cfg.buildings.steps.flatMap((step) => step.tasks)
}

export function nextTask(state: GameState, cfg: GameConfig): TaskDef | null {
  return allTasks(cfg).find((task) => !state.tasksDone.includes(task.id)) ?? null
}

export function taskPrice(task: TaskDef, cfg: GameConfig): number {
  return Math.max(1, Math.round(task.price * cfg.economy.buildPriceScale))
}

export function taskStep(cfg: GameConfig, taskId: string): { stepName: string; index: number; total: number } | null {
  let index = 0
  const tasks = allTasks(cfg)
  for (const step of cfg.buildings.steps) {
    for (const task of step.tasks) {
      index += 1
      if (task.id === taskId) return { stepName: step.name, index, total: tasks.length }
    }
  }
  return null
}

export function buildTask(
  state: GameState,
  taskId: string,
  choice: string | null,
  cfg: GameConfig,
  rng: Rng,
  now: number,
): ActionResult {
  const next = nextTask(state, cfg)
  if (!next || next.id !== taskId) {
    return { ok: false, reason: 'locked', events: [{ type: 'toast', text: '还没轮到这件' }] }
  }
  if (state.decorate) return { ok: false, reason: 'decorate', events: [{ type: 'toast', text: '先定下装修' }] }
  const price = taskPrice(next, cfg)
  if (state.coins < price) return { ok: false, reason: 'coins', events: [{ type: 'toast', text: '铜钱不够' }] }
  state.coins -= price
  state.tasksDone.push(next.id)
  state.xp += cfg.economy.xpPerTask
  state.storyForce = false
  state.storyCard = null
  const storyNo = Number(next.id.replace(/\D/g, ''))
  if (storyNo === 11) state.bubbleDue = true
  if (next.id.startsWith('s')) grantStoryReward(state, cfg, rng, storyNo)
  if (next.choices?.length) {
    const picked = next.choices.findIndex((entry) => entry.id === choice)
    state.decorate = { taskId: next.id, index: picked >= 0 ? picked : 0 }
  } else startBuildStory(state, cfg, next.id)
  logAction(state, now, 'build')
  const events: GameEvent[] = [{ type: 'build', taskId: next.id, name: next.name }]
  events.push(...reconcileLevel(state, cfg, rng))
  events.push(...checkStepGrants(state, cfg, rng))
  if (next.id.startsWith('s')) maybeOfferStory(state, cfg, storyNo)
  const firstId = cfg.buildings.steps[0]?.tasks[0]?.id
  if (state.phase === 'opening' && firstId && state.tasksDone.includes(firstId)) {
    state.phase = 'play'
    state.openingStep = cfg.copy.tutorial.length
    fillOrders(state, cfg, rng)
  }
  return { ok: true, events }
}

function placeReward(state: GameState, item: Item): void {
  const spot = findEmpty(state)[0]
  if (spot) state.board[spot.row][spot.col] = item
  else queueReward(state, item)
}

function grantRewardEntry(state: GameState, cfg: GameConfig, rng: Rng, entry: LevelRewardEntry): GameEvent[] {
  if (entry.id === 'gift') return (entry.bundle ?? []).flatMap((part) => grantRewardEntry(state, cfg, rng, part))
  if (entry.id === 'pack') {
    state.gems += entry.gems ?? 0
    return [{ type: 'toast', text: `钻石 +${entry.gems ?? 0}` }]
  }
  if (entry.id === 'energy') {
    state.energy += entry.energy ?? 0
    return [{ type: 'toast', text: `体力 +${entry.energy ?? 0}` }]
  }
  if (entry.id === 'product' && entry.line) {
    const item = makeProduct(state, entry.line, entry.pieceLevel ?? 1)
    noteUnlock(state, entry.line, entry.pieceLevel ?? 1)
    placeReward(state, item)
    return [{ type: 'grant', kind: 'box', name: entry.name, row: -1, col: -1, pending: true }]
  }
  if (entry.id === 'welcome' || entry.id === 'red' || entry.id === 'green' || entry.id === 'smart' || entry.id === 'foodbox' || entry.id === 'meatbox' || entry.id === 'chest') {
    const box = entry.id === 'foodbox' ? 'food' : entry.id === 'meatbox' ? 'meat' : entry.id === 'chest' ? 'energy' : entry.id
    const chest: Item = { uid: nextUid(state, 'c'), kind: 'chest', box, readyAt: box === 'welcome' ? 0 : undefined }
    if (box === 'energy' && state.chestLesson === 0) state.chestLesson = 1
    placeReward(state, chest)
    return [{ type: 'grant', kind: 'chest', name: entry.name, row: -1, col: -1, pending: true }]
  }
  if (cfg.producers.some((producer) => producer.id === entry.id)) {
    const tray = entry.id === 'bev' && entry.producerLevel === 1
    return grantProducer(state, cfg, rng, entry.id, entry.producerLevel ?? 1, tray).filter((event) => event.type !== 'toast')
  }
  return []
}

function releaseSmileLesson(state: GameState): void {
  if (state.smileLesson === 'wait' && !state.giftModal) state.smileLesson = 'order'
}

export function claimGiftModal(state: GameState, cfg: GameConfig, rng: Rng): ActionResult {
  const modal = state.giftModal
  if (!modal) return { ok: false, reason: 'none', events: [] }
  if (modal.mode === 'locked') {
    state.giftModal = null
    releaseSmileLesson(state)
    return { ok: true, events: [] }
  }
  const events = modal.rewards.flatMap((entry) => grantRewardEntry(state, cfg, rng, entry))
  if (modal.lockText) {
    state.giftModal = { mode: 'locked', title: '下一档还锁着', rewards: [], lockText: modal.lockText }
  } else state.giftModal = null
  releaseSmileLesson(state)
  return { ok: true, events }
}

function grantStoryReward(state: GameState, cfg: GameConfig, rng: Rng, no: number): void {
  const reward = storyDef(no)?.reward
  if (typeof reward !== 'string' || !reward || reward === '—') return
  const entries = parseRewardText(reward)
  const gift = entries.find((entry) => entry.id === 'gift')
  const bundle = [...(gift?.bundle ?? [])]
  for (const entry of entries) {
    if (entry.id === 'gift') continue
    if (gift && (entry.id === 'energy' || entry.id === 'pack')) {
      bundle.push(entry.id === 'energy' ? { ...entry, name: `体力 ×${entry.energy ?? 0}` } : entry)
      continue
    }
    grantRewardEntry(state, cfg, rng, entry)
  }
  if (!bundle.length) return
  const lock = (storyNote(no).match(/达到[^。）]*/)?.[0] ?? storyNote(no).match(/到达[^。）]*/)?.[0] ?? '').replace(/^出现弹窗：?/, '')
  state.giftModal = { mode: 'claim', title: '新手大礼包', rewards: bundle, lockText: lock }
}

export function openStoryCard(state: GameState, cfg: GameConfig): void {
  if (state.lesson && state.lesson !== 'free') return
  const next = nextTask(state, cfg)
  if (!next) return
  state.storyCard = { no: Number(next.id.replace(/\D/g, '')) || 1 }
}

export function closeStoryCard(state: GameState): void {
  if (state.storyForce) return
  state.storyCard = null
}

export function storyReady(state: GameState, cfg: GameConfig): boolean {
  const task = nextTask(state, cfg)
  if (!task?.id.startsWith('s')) return false
  if (state.storyForce) return true
  return state.coins >= taskPrice(task, cfg)
}

export function buyBubble(state: GameState, pos: Pos, cfg: GameConfig): ActionResult {
  const item = state.board[pos.row]?.[pos.col]
  if (!item || item.kind !== 'product' || item.tag !== 'bubble') return { ok: false, reason: 'none', events: [] }
  const cost = cfg.economy.giftRushGems ?? 2
  if (state.gems < cost) return { ok: false, reason: 'gems', events: [{ type: 'toast', text: '钻石不够' }] }
  state.gems -= cost
  item.tag = undefined
  item.bubbleUntil = undefined
  return { ok: true, events: [{ type: 'toast', text: `花了 ${cost} 钻石，气泡破了` }] }
}

function dropBubble(state: GameState, line: string, level: number): void {
  if (!state.bubbleDue || state.bubbleDropped) return
  state.bubbleDue = false
  state.bubbleDropped = true
  const bubble = makeProduct(state, line, level)
  if (bubble.kind === 'product') {
    bubble.tag = 'bubble'
    bubble.bubbleUntil = 0
  }
  placeReward(state, bubble)
}

export function settleClocks(state: GameState, now: number): void {
  const turn = (item: Item): Item => {
    if (item.kind === 'chest' && item.box === 'welcome' && !item.readyAt) item.readyAt = now + 120_000
    if (item.kind === 'product' && item.tag === 'bubble') {
      if (!item.bubbleUntil) item.bubbleUntil = now + 120_000
      else if (now >= item.bubbleUntil) return makeProduct(state, 'coin', 1)
    }
    return item
  }
  state.board.forEach((row) => {
    row.forEach((item, c) => {
      if (item) row[c] = turn(item)
    })
  })
  state.rewards = state.rewards.map((item) => turn(item))
  state.pending = state.pending.map((item) => turn(item))
}

export function maybeOfferStory(state: GameState, cfg: GameConfig, finishedNo: number): void {
  const next = nextTask(state, cfg)
  const prev = storyDef(finishedNo)
  if (!next || !prev) {
    state.storyCard = null
    return
  }
  const price = taskPrice(next, cfg)
  if (prev.type === 'dialogue' && !prev.hasReward && state.coins >= price) {
    state.storyCard = { no: Number(next.id.replace(/\D/g, '')) || nextStoryNo(next.id) }
  } else state.storyCard = null
}

function nextStoryNo(id: string): number {
  return Number(id.replace(/\D/g, '')) || 1
}

export function refreshGuide(state: GameState, cfg: GameConfig, view: 'board' | 'house'): void {
  if (state.lesson && state.lesson !== 'free') {
    if (state.guide === 'buildTalk' || state.guide === 'backTalk' || state.guide === 'buildBtn' || state.guide === 'repairBtn' || state.guide === 'backBtn') {
      state.guide = 'none'
    }
    return
  }
  const upcoming = nextTask(state, cfg)
  if (upcoming?.id.startsWith('s')) {
    if (state.guide === 'buildTalk' || state.guide === 'backTalk' || state.guide === 'buildBtn' || state.guide === 'repairBtn' || state.guide === 'backBtn') {
      state.guide = 'none'
    }
    if (view === 'board' && state.guide === 'none' && state.level < (cfg.economy.guideUntilLevel ?? 5) && state.smiles >= cfg.economy.smileGoal) {
      state.guide = 'smile'
    }
    return
  }
  if (state.phase !== 'play' || state.decorate || state.buildStory) {
    if (state.decorate && (state.guide === 'repairBtn' || state.guide === 'backBtn')) state.guide = 'none'
    return
  }
  const task = nextTask(state, cfg)
  const price = task ? taskPrice(task, cfg) : Number.POSITIVE_INFINITY
  const enough = !!task && state.coins >= price
  const limit = cfg.economy.guideShows ?? 3
  if (view === 'house' && task && !enough) {
    if (state.guide !== 'backBtn' && state.guide !== 'backTalk' && state.backGuideCount < limit) {
      state.backGuideCount += 1
      state.guide = 'backBtn'
    } else if (state.backGuideCount >= limit && state.guide === 'backBtn') state.guide = 'none'
    return
  }
  if (view === 'house' && enough && (state.guide === 'buildBtn' || state.guide === 'buildTalk')) {
    state.guide = 'repairBtn'
    return
  }
  if (view === 'board' && state.guide === 'backBtn') {
    state.guide = 'backTalk'
    return
  }
  if (view === 'board' && state.guide === 'repairBtn') state.guide = 'none'
  if (view === 'board' && enough && task && state.guidedTask !== task.id && state.guide === 'none' && state.buildGuideCount < limit) {
    state.buildGuideCount += 1
    state.guidedTask = task.id
    state.guide = 'buildTalk'
    return
  }
  if (view === 'board' && state.guide === 'none' && state.level < (cfg.economy.guideUntilLevel ?? 5) && state.smiles >= cfg.economy.smileGoal) {
    state.guide = 'smile'
  }
}

export function startBuildStory(state: GameState, cfg: GameConfig, taskId: string): void {
  const lines = cfg.stories?.[taskId]
  if (!lines?.length) return
  state.buildStory = { taskId, index: 0 }
}

export function advanceBuildStory(state: GameState, cfg: GameConfig): void {
  const story = state.buildStory
  if (!story) return
  const lines = cfg.stories?.[story.taskId] ?? []
  if (story.index + 1 >= lines.length) state.buildStory = null
  else story.index += 1
}

export function pressFirst(state: GameState, view: 'board' | 'house' | 'story'): 'decor' | 'buildStory' | 'level' | 'talk' | 'play' {
  if (view === 'house' && state.decorate) return 'decor'
  if (state.buildStory) return 'buildStory'
  if (state.levelModal) return 'level'
  if (state.notice || state.guide === 'buildTalk' || state.guide === 'backTalk') return 'talk'
  return 'play'
}

export function advanceGuide(state: GameState, cfg: GameConfig): void {
  const task = nextTask(state, cfg)
  if (state.guide === 'buildTalk') {
    state.guide = 'buildBtn'
    state.guidedTask = task?.id ?? state.guidedTask
    return
  }
  if (state.guide === 'backTalk') state.guide = 'none'
}

export function previewDecor(state: GameState, index: number): void {
  if (!state.decorate) return
  state.decorate.index = index
}

export function confirmDecor(state: GameState, cfg: GameConfig): ActionResult {
  const pick = state.decorate
  if (!pick) return { ok: false, reason: 'none', events: [] }
  const task = allTasks(cfg).find((entry) => entry.id === pick.taskId)
  const choice = task?.choices?.[pick.index]
  if (!task || !choice) return { ok: false, reason: 'none', events: [] }
  state.styles[task.id] = choice.id
  state.decoration = choice.id
  state.decorate = null
  startBuildStory(state, cfg, task.id)
  return { ok: true, events: [{ type: 'toast', text: `${task.name} · ${choice.name}` }] }
}

export function reopenDecor(state: GameState, cfg: GameConfig, taskId: string): boolean {
  if (state.decorate) return false
  const task = allTasks(cfg).find((entry) => entry.id === taskId)
  if (!task?.choices?.length || !state.tasksDone.includes(taskId)) return false
  const current = state.styles[taskId]
  const index = task.choices.findIndex((entry) => entry.id === current)
  state.decorate = { taskId, index: index >= 0 ? index : 0 }
  return true
}

export function advanceOpening(state: GameState, cfg: GameConfig): void {
  advanceDialogue(state, cfg)
}

export function skipOpening(state: GameState, cfg: GameConfig, rng: Rng): void {
  if (state.phase === 'play') return
  const early = state.phase === 'story' || state.openingStep < cfg.copy.tutorial.length
  state.storySeen = true
  state.phase = 'play'
  state.openingStep = cfg.copy.tutorial.length
  state.lesson = 'free'
  state.showHelp = early
  if (producerLevelOwned(state, 'food') < cfg.economy.producerSpawnLevel) {
    state.hasProducer.food = true
    queueReward(state, makeProducer(state, 'food', cfg, cfg.economy.producerSpawnLevel))
  }
  fillOrders(state, cfg, rng)
}

export function xpSpan(state: GameState, cfg: GameConfig): { prev: number; next: number; maxed: boolean } {
  const thresholds = xpThresholds(cfg)
  if (state.level - 1 >= thresholds.length) {
    const last = thresholds[thresholds.length - 1] ?? 0
    return { prev: last, next: last, maxed: true }
  }
  const prev = state.level <= 1 ? 0 : thresholds[state.level - 2]
  const next = thresholds[state.level - 1]
  return { prev, next, maxed: false }
}

export interface SaveFile {
  v: 2
  state: GameState
  economy: GameConfig['economy']
  /** 有这个印记才沿用存档里的等级表。旧档没有，避免把旧的 4 级饮料母棋带回来。 */
  curve?: string
}

const CURVE = '1120-reset'

export function serialize(state: GameState, cfg: GameConfig): string {
  const data: SaveFile = { v: 2, state, economy: cfg.economy, curve: CURVE }
  return JSON.stringify(data)
}

export function hydrate(raw: string, cfg: GameConfig): GameState | null {
  try {
    const data = JSON.parse(raw) as SaveFile
    if (!data || data.v !== 2 || !data.state || !Array.isArray(data.state.board)) return null
    if (data.state.board.length !== ROWS) return null
    if (!data.state.board.every((row) => Array.isArray(row) && row.length === COLS)) return null
    const freshCurve = {
      xpPerTask: cfg.economy.xpPerTask,
      orderXp: cfg.economy.orderXp,
      levelTaskThresholds: cfg.economy.levelTaskThresholds.slice(),
      levelRewards: cfg.economy.levelRewards,
    }
    if (data.economy) cfg.economy = { ...cfg.economy, ...data.economy }
    const state = data.state
    if (data.curve !== CURVE) {
      cfg.economy.xpPerTask = freshCurve.xpPerTask
      cfg.economy.orderXp = freshCurve.orderXp
      cfg.economy.levelTaskThresholds = freshCurve.levelTaskThresholds
      cfg.economy.levelRewards = freshCurve.levelRewards
      const stories = (state.tasksDone ?? []).filter((id) => String(id).startsWith('s')).length
      const earned = stories * (cfg.economy.xpPerTask || 15)
      let level = 1
      let left = earned
      while (level < 99) {
        const need = levelCost(cfg, level)
        if (left < need) break
        left -= need
        level += 1
      }
      if (state.level > level) {
        state.level = level
        state.xp = left
        state.levelModal = null
        state.levelQueue = []
      } else {
        let spent = 0
        for (let at = 1; at < state.level; at++) spent += levelCost(cfg, at)
        state.xp = Math.max(0, state.xp - spent)
      }
    }
    state.pending ||= []
    state.rewards ||= []
    state.styles ||= {}
    state.decorate ??= null
    state.gems ??= 0
    state.gemBuys ??= 0
    state.playedMs ??= 0
    state.armed ??= null
    state.chainPop ??= null
    state.guide ??= 'none'
    state.guidedTask ??= null
    state.notice ??= null
    state.giftPrompt ??= null
    state.giftFreeUsed ??= false
    state.buildStory ??= null
    state.buildGuideCount ??= 0
    state.backGuideCount ??= 0
    state.chestLesson ??= 3
    state.chestCell ??= null
    state.producerLesson ??= null
    state.newestLine ??= null
    state.orderSeq ??= 1
    state.heldOrders ??= []
    state.orderedLines ??= []
    state.lateBlock ??= false
    state.smileRound ??= 1
    state.storyCard ??= null
    state.storyForce ??= false
    state.giftModal ??= null
    state.smileTaught ??= false
    state.smileLesson ??= 'off'
    state.welcomeFreeUsed ??= false
    state.bubbleDue ??= false
    state.bubbleDropped ??= false
    state.storyStep ??= 0
    state.lesson ??= state.phase === 'play' ? 'free' : state.phase === 'opening' ? (cfg.copy.tutorial[state.openingStep]?.id as GameState['lesson']) || 'merge' : 'home1'
    if (state.lesson !== 'home1' && state.lesson !== 'talk1' && state.lesson !== 'merge' && state.lesson !== 'mergeC' && state.lesson !== 'mergeD' && state.lesson !== 'focus' && state.lesson !== 'deliver' && state.lesson !== 'book' && state.lesson !== 'home2' && state.lesson !== 'home3' && state.lesson !== 'free') {
      state.lesson = 'free'
    }
    state.storyBookOn ??= state.phase === 'play' && ((state.stats?.ordersDone ?? 0) > 0 || state.level >= 5)
    state.soundMuted ??= false
    if (state.phase === 'story' && state.storyStep >= storyLength(cfg)) {
      state.storySeen = true
      state.phase = 'opening'
      state.openingStep ??= 0
    }
    state.storageOpen ??= (state.stats?.ordersDone ?? 0) > 0
    if (state.storySeen == null) state.storySeen = state.phase === 'play' || (state.openingStep ?? 0) > 0
    if (!state.storySeen && state.phase === 'opening' && state.openingStep === 0) state.phase = 'story'
    state.orders ||= []
    state.tasksDone ||= []
    state.unlocked ||= {}
    state.seen ||= {}
    state.producerSeen ||= {}
    state.storageLesson ??= state.level >= (cfg.economy.storageUnlockLevel ?? 5) ? 4 : 0
    state.storageOpen = state.level >= (cfg.economy.storageUnlockLevel ?? 5)
    state.sale ??= null
    const fixItem = (item: Item | null, write: (next: Item | null) => void) => {
      if (item?.kind === 'producer' && (item.level == null || item.level < 1)) item.level = 1
      if (item?.kind === 'rewardBox' && (item as { box?: string }).box === 'blue') write({ uid: item.uid, kind: 'chest' })
    }
    state.board.forEach((row) => row.forEach((item, c) => fixItem(item, (next) => { row[c] = next })))
    state.pending.forEach((item, i) => fixItem(item, (next) => { if (next) state.pending[i] = next }))
    state.rewards.forEach((item, i) => fixItem(item, (next) => { if (next) state.rewards[i] = next }))
    for (const lock of state.locks) if (!lock.veil) lock.veil = 'half'
    state.hasProducer ||= {}
    state.locks ||= []
    state.levelQueue ||= []
    state.levelModal ??= null
    state.smileModal ??= null
    state.smiles ??= 0
    state.spawnMult ??= 1
    if (!allowedSpawnMults(state, cfg).includes(state.spawnMult as 1 | 2 | 4)) state.spawnMult = 1
    state.mintStep ??= 'off'
    resolveGuides(state, cfg)
    if (state.phase === 'opening' && !openingStepPossible(state, cfg)) dismissStuckGuide(state, cfg)
    state.shopOpen ??= false
    state.shopClaimDate ??= null
    state.shopPackClaimed ??= false
    state.detailLine ??= null
    state.meatGuided ??= false
    state.bevGuided ??= false
    state.mintGuided ??= false
    state.adUsedToday ??= 0
    state.adDay ||= dayKey(state.playStartedAt || Date.now())
    state.stats ||= { producerTaps: 0, ordersDone: 0, adClicks: 0, visits: [], log: [] }
    state.stats.visits ||= []
    state.stats.log ||= []
    resolveGuides(state, cfg)
    return state
  } catch {
    return null
  }
}

function touchesOpen(state: GameState, row: number, col: number): boolean {
  const near = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  return near.some(([dr, dc]) => {
    const r = row + (dr ?? 0)
    const c = col + (dc ?? 0)
    return inBoard(r, c) && !lockAt(state, r, c)
  })
}

export function unlockHints(state: GameState): { from: Pos; to: Pos }[] {
  const pieces: { row: number; col: number; line: string; level: number }[] = []
  eachCell(state.board, (item, row, col) => {
    if (!item || item.kind !== 'product' || item.tag === 'bag' || lockAt(state, row, col)) return
    pieces.push({ row, col, line: item.line, level: item.level })
  })
  const hints: { from: Pos; to: Pos }[] = []
  for (const lock of state.locks) {
    if (lock.cover === 'gift' || lock.veil === 'full' || lock.buried.kind !== 'product') continue
    if (state.board[lock.row]?.[lock.col]) continue
    const buried = lock.buried
    const match = pieces.find((piece) => piece.line === buried.line && piece.level === buried.level && piece.level < PRODUCT_CAP)
    if (!match) continue
    const beside = Math.abs(match.row - lock.row) + Math.abs(match.col - lock.col) === 1
    if (!touchesOpen(state, lock.row, lock.col) && !beside) continue
    hints.push({ from: { row: match.row, col: match.col }, to: { row: lock.row, col: lock.col } })
  }
  return hints
}

export function glowingLocks(state: GameState): Pos[] {
  return unlockHints(state).map((hint) => hint.to)
}

export type HintAction =
  | { type: 'complete'; index: number }
  | { type: 'unlock'; from: Pos; to: Pos }
  | { type: 'merge'; from: Pos; to: Pos }
  | { type: 'produce'; row: number; col: number }

export function pickHint(state: GameState, now: number): HintAction | null {
  if (state.phase !== 'play') return null
  const orderIndex = state.orders.findIndex((order) => orderSatisfied(state, order))
  if (orderIndex >= 0) return { type: 'complete', index: orderIndex }
  const unlock = unlockHints(state)[0]
  if (unlock) return { type: 'unlock', from: unlock.from, to: unlock.to }
  const pair = findMergePair(state)
  if (pair) return { type: 'merge', from: pair[0], to: pair[1] }
  const producer = occupied(state).find((cell) => {
    if (cell.item.kind !== 'producer' || lockAt(state, cell.row, cell.col)) return false
    return cell.item.charges > 0 && cell.item.cooldownUntil <= now
  })
  if (producer) return { type: 'produce', row: producer.row, col: producer.col }
  return null
}

export function describeAt(cfg: GameConfig, state: GameState, pos: Pos): { title: string; level: string; text: string } | null {
  const lock = lockAt(state, pos.row, pos.col)
  if (lock && !state.board[pos.row][pos.col]) {
    if (lock.cover === 'gift') return { title: '礼物', level: '锁着', text: cfg.copy.gift }
    if (lock.veil === 'full') return { title: '全遮', level: '锁格', text: '旁边的格子打开后，这里会露出一角。' }
    const buried = lock.buried
    const title =
      buried.kind === 'product'
        ? productName(cfg, buried.line, buried.level)
        : buried.kind === 'potion'
          ? potionName(cfg, buried.tier)
          : buried.kind === 'gem'
            ? gemName(cfg, buried.tier)
            : buried.kind === 'producer'
              ? (producerPieceName(buried.id, buried.level) ?? producerName(cfg, buried.id))
              : `${buried.amount} 铜钱`
    return { title: `半开 · ${title}`, level: '锁格', text: cfg.copy.lock }
  }
  const item = state.board[pos.row]?.[pos.col]
  if (!item) return null
  if (item.kind === 'product') {
    return {
      title: item.tag === 'bag' ? '购物袋' : productName(cfg, item.line, item.level),
      level: cnLevel(item.level),
      text: item.tag === 'bag' ? cfg.copy.bagPiece : item.level >= 3 ? cfg.copy.productOrder : cfg.copy.productRaw,
    }
  }
  if (item.kind === 'producer') {
    const lineName = cfg.items.lines.find((line) => line.id === item.line)?.name ?? '原料'
    const text = item.charges <= 0 && item.cooldownUntil > 0 ? cfg.copy.producerCool : cfg.copy.producer.replace('{line}', lineName)
    return { title: producerPieceName(item.producerId, item.level) ?? producerName(cfg, item.producerId), level: cnLevel(item.level), text }
  }
  if (item.kind === 'potion') {
    return {
      title: potionName(cfg, item.tier),
      level: cnLevel(item.tier),
      text: cfg.copy.potion.replace('{energy}', String(potionEnergy(cfg, item.tier))),
    }
  }
  if (item.kind === 'rewardBox') {
    const text = item.box === 'purple' ? cfg.copy.purple : cfg.copy.bag
    const title = item.box === 'purple' ? '紫礼盒' : '购物袋'
    return { title, level: '奖励', text }
  }
  return { title: cfg.items.chestName, level: '宝箱', text: cfg.copy.chest }
}

export function tutorialLine(cfg: GameConfig, step: number): string {
  const raw = cfg.copy.tutorial[step]?.text ?? ''
  return raw.replace('{daughter}', cfg.copy.daughterName)
}

export function inspectText(cfg: GameConfig, item: Item): string {
  if (item.kind === 'product') {
    const name = productName(cfg, item.line, item.level)
    const flag = item.level >= 3 ? '可交单' : '原料，不能交单'
    return `${name} · ${cnLevel(item.level)} · ${flag}`
  }
  if (item.kind === 'producer') {
    if (item.charges <= 0 && item.cooldownUntil > 0) return `${producerName(cfg, item.producerId)} · 冷却中`
    return `${producerName(cfg, item.producerId)} · 点一下出原料 · 还剩 ${item.charges} 次`
  }
  if (item.kind === 'potion') return `${potionName(cfg, item.tier)} · 再点一次使用 · +${potionEnergy(cfg, item.tier)}`
  if (item.kind === 'gem') return `${gemName(cfg, item.tier)} · 再点一次使用 · +${gemAmount(cfg, item.tier)}`
  return `${cfg.items.chestName} · 点一下拆出五瓶体力`
}
