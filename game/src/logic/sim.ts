import type {
  ActionResult,
  CellLock,
  GameConfig,
  GameEvent,
  GameState,
  Item,
  LootDrop,
  Order,
  Pos,
  ProducerItem,
  Rng,
  TaskDef,
} from '../types'
import { COLS, ROWS } from '../types'

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
  const item: ProducerItem = {
    uid: nextUid(state, 'p'),
    kind: 'producer',
    producerId: id,
    line: def?.line ?? id,
    level,
    charges: chargesForLevel(cfg, level),
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
  const table = cfg.economy.producerChargesByLevel
  const fromTable = table?.[level]
  if (fromTable != null && fromTable > 0) return fromTable
  return cfg.economy.producerCharges
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
  return { uid: nextUid(state, 'c'), kind: 'chest' }
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

function revealAround(state: GameState, row: number, col: number): void {
  const near = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const [dr, dc] of near) {
    const lock = lockAt(state, row + (dr ?? 0), col + (dc ?? 0))
    if (lock && lock.veil === 'full' && lock.cover !== 'gift') lock.veil = 'half'
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
    return item.box === 'blue' ? '蓝宝箱' : item.box === 'purple' ? '紫礼盒' : '购物袋'
  }
  return cfg.items.chestName
}

export function takeReward(state: GameState): ActionResult {
  const item = state.rewards[0]
  if (!item) return { ok: false, reason: 'empty', events: [] }
  if (item.kind === 'rewardBox' && item.box === 'smile') {
    state.rewards.shift()
    state.smiles += item.n ?? 1
    return { ok: true, events: [{ type: 'toast', text: `笑脸 +${item.n ?? 1}` }] }
  }
  const spot = findEmpty(state)[0]
  if (!spot) {
    resolveGuides(state, undefined)
    return { ok: false, reason: 'full', events: [{ type: 'toast', text: '棋盘满了，奖励先留着' }] }
  }
  state.rewards.shift()
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

export function makeChainItem(state: GameState, cfg: GameConfig, line: string, level: number): Item {
  const spec = levelSpec(cfg, line, level)
  if (spec?.producer || level >= cfg.economy.producerSpawnLevel) return makeProducer(state, line, cfg, level)
  return makeProduct(state, line, level)
}

export function canMerge(a: Item, b: Item, cap = PRODUCT_CAP): boolean {
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
  const next = state.openingStep + 1
  if (next >= cfg.copy.tutorial.length) {
    state.phase = 'play'
    state.openingStep = cfg.copy.tutorial.length
    return
  }
  state.openingStep = next
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

export function refreshProducers(state: GameState, now: number, cfg: GameConfig): void {
  const refill = (item: Item) => {
    if (item.kind === 'producer' && item.cooldownUntil > 0 && now >= item.cooldownUntil) {
      item.charges = chargesForLevel(cfg, item.level)
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
    storyStep: 0,
    storySeen: false,
    storageOpen: false,
    bagPhase: 'place',
    smiles: 0,
    adDay: dayKey(now),
    adUsedToday: 0,
    playStartedAt: now,
    levelModal: null,
    levelQueue: [],
    smileModal: null,
    orderBias: null,
    idCounter: 0,
    orderCounter: 0,
    stats: { producerTaps: 0, ordersDone: 0, adClicks: 0, visits: [], log: [] },
  }
  for (const line of cfg.items.lines) state.unlocked[line.id] = 0
  applyOpening(state, cfg)
  state.orders = [
    {
      id: 'tutorial',
      customerId: 'xiaotao',
      slots: [{ line: 'food', level: 3, filled: false }],
      big: false,
      scripted: true,
    },
  ]
  return state
}

function applyOpening(state: GameState, cfg: GameConfig): void {
  const open: [number, number][] = [
    [3, 2],
    [3, 3],
    [4, 2],
    [4, 3],
    [4, 4],
    [5, 2],
    [5, 3],
  ]
  const openKey = new Set(open.map(([row, col]) => `${row},${col}`))
  state.hasProducer.food = true
  state.board[4][3] = makeProducer(state, 'food', cfg, cfg.economy.producerSpawnLevel)
  state.board[3][2] = makeProduct(state, 'food', 1)
  state.board[3][3] = makeProduct(state, 'food', 1)
  noteUnlock(state, 'food', 1)
  let seq = 0
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (openKey.has(`${row},${col}`)) continue
      let ring = 99
      for (const [or, oc] of open) ring = Math.min(ring, Math.abs(row - or) + Math.abs(col - oc))
      seq += 1
      const line = 'food'
      const level = Math.min(8, 6 + Math.max(0, ring - 3))
      const lock: CellLock = {
        row,
        col,
        cover: ring >= 4 ? 'web' : 'sand',
        veil: 'full',
        buried: { kind: 'product', line, level: Math.min(8, level) },
      }
      state.locks.push(lock)
    }
  }
  const patch = (row: number, col: number, lock: CellLock) => {
    const index = state.locks.findIndex((entry) => entry.row === row && entry.col === col)
    if (index >= 0) state.locks[index] = lock
  }
  patch(3, 4, { row: 3, col: 4, cover: 'sand', veil: 'half', buried: { kind: 'product', line: 'food', level: 2 } })
  patch(4, 5, { row: 4, col: 5, cover: 'sand', veil: 'half', buried: { kind: 'product', line: 'food', level: 2 } })
  patch(3, 1, { row: 3, col: 1, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 2 } })
  patch(2, 3, { row: 2, col: 3, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 2 } })
  patch(5, 1, { row: 5, col: 1, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 3 } })
  patch(6, 2, { row: 6, col: 2, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 3 } })
  patch(6, 3, { row: 6, col: 3, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 3 } })
  patch(4, 1, { row: 4, col: 1, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 3 } })
  patch(2, 2, { row: 2, col: 2, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 4 } })
  patch(2, 4, { row: 2, col: 4, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 4 } })
  patch(6, 4, { row: 6, col: 4, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 4 } })
  patch(3, 5, { row: 3, col: 5, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 5 } })
  patch(5, 5, { row: 5, col: 5, cover: 'sand', veil: 'full', buried: { kind: 'product', line: 'food', level: 5 } })
  patch(5, 4, { row: 5, col: 4, cover: 'gift', veil: 'half', buried: { kind: 'product', line: 'food', level: 1 } })
  patch(0, 2, { row: 0, col: 2, cover: 'web', veil: 'full', buried: { kind: 'coin', amount: 8, line: 'food', level: 6 } })
  patch(0, 4, { row: 0, col: 4, cover: 'web', veil: 'full', buried: { kind: 'coin', amount: 12, line: 'food', level: 7 } })
  patch(8, 2, { row: 8, col: 2, cover: 'web', veil: 'full', buried: { kind: 'coin', amount: 20, line: 'food', level: 7 } })
  patch(0, 0, { row: 0, col: 0, cover: 'web', veil: 'full', buried: { kind: 'gem', tier: 1, line: 'food', level: 6 } })
  patch(8, 6, { row: 8, col: 6, cover: 'web', veil: 'full', buried: { kind: 'gem', tier: 2, line: 'food', level: 7 } })
  patch(1, 6, { row: 1, col: 6, cover: 'web', veil: 'full', buried: { kind: 'gem', tier: 3, line: 'food', level: 8 } })
  patch(8, 0, { row: 8, col: 0, cover: 'web', veil: 'full', buried: { kind: 'potion', tier: 1, line: 'food', level: 6 } })
  patch(7, 6, { row: 7, col: 6, cover: 'web', veil: 'full', buried: { kind: 'potion', tier: 2, line: 'food', level: 7 } })
  patch(2, 0, { row: 2, col: 0, cover: 'web', veil: 'full', buried: { kind: 'potion', tier: 3, line: 'food', level: 6 } })
  cfg.board.roles = {
    mergeA: { row: 3, col: 2 },
    mergeB: { row: 3, col: 3 },
    unlock: { row: 3, col: 4 },
    producer: { row: 4, col: 3 },
    gift: { row: 5, col: 4 },
    bagSpot: { row: 4, col: 4 },
  }
  cfg.board.open = open.map(([row, col]) => ({ row, col }))
  cfg.board.locks = state.locks.map((lock) => ({ ...lock, buried: { ...lock.buried } }))
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

export function tapProducer(state: GameState, pos: Pos, cfg: GameConfig, rng: Rng, now: number): ActionResult {
  syncEnergy(state, now, cfg)
  refreshProducers(state, now, cfg)
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || item.kind !== 'producer') return { ok: false, reason: 'not-producer', events: [] }
  const name = producerName(cfg, item.producerId)
  const spec = levelSpec(cfg, item.line, item.level)
  const drops = spec?.drops ?? []
  if (item.level < cfg.economy.producerSpawnLevel || !drops.length) {
    return { ok: false, reason: 'low', events: [{ type: 'toast', text: '合到 6 级才能产出' }] }
  }
  const grace = inProducerGrace(state, cfg)
  if (!grace && item.charges <= 0 && item.cooldownUntil > now) {
    return {
      ok: false,
      reason: 'cooldown',
      events: [
        { type: 'cooldown', remainMs: item.cooldownUntil - now },
        { type: 'toast', text: `${name}歇一会儿` },
      ],
    }
  }
  const spot = nearestEmpty(state, pos.row, pos.col)
  if (!spot) {
    if (state.producerLesson === item.producerId) resolveGuides(state)
    return { ok: false, reason: 'full', events: [{ type: 'toast', text: '没有空格了' }] }
  }
  const taught = state.producerLesson === item.producerId
  if (!taught && state.energy < cfg.economy.energyCost) {
    return { ok: false, reason: 'energy', events: [{ type: 'needEnergy' }] }
  }
  const wasFull = state.energy >= cfg.economy.energyMax
  if (!taught) {
    state.energy -= cfg.economy.energyCost
    if (wasFull && state.energy < cfg.economy.energyMax) state.energyTs = now
  } else state.producerLesson = null
  if (!grace && !taught) {
    item.charges = 0
    item.cooldownUntil = now + (spec?.cooldownMs ?? cfg.economy.producerCooldownMs)
  }
  const dropLevel = drops[Math.min(drops.length - 1, Math.floor(rng() * drops.length))] ?? drops[0] ?? 1
  const product = makeChainItem(state, cfg, item.line, dropLevel)
  noteUnlock(state, item.line, dropLevel)
  state.board[spot.row][spot.col] = product
  state.stats.producerTaps += 1
  logAction(state, now, 'tap')
  if (atStep(state, cfg, 'produce')) advanceTutorial(state, cfg)
  return {
    ok: true,
    events: [{ type: 'spawn', row: spot.row, col: spot.col, fromRow: pos.row, fromCol: pos.col }],
  }
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
  const amount = potionEnergy(cfg, item.tier)
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

export function openChest(state: GameState, pos: Pos, cfg: GameConfig, rng: Rng): ActionResult {
  const item = inBoard(pos.row, pos.col) ? state.board[pos.row][pos.col] : null
  if (!item || item.kind !== 'chest') return { ok: false, reason: 'not-chest', events: [] }
  if (!item.drops) {
    const fixed = cfg.economy.newbieChestFixed && state.chestsOpened < cfg.economy.newbieChestCount
    const energies = fixed ? cfg.economy.newbieChest.slice() : Array.from({ length: 5 }, () => rollEnergy(cfg, rng))
    state.chestsOpened += 1
    item.drops = energies.map((energy) => ({ item: makePotion(state, tierForEnergy(cfg, energy)) }))
    maybeLateProducer(state, cfg, rng)
  }
  const left = popLoot(state, cfg, pos, item.drops)
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
      if (cfg && atStep(state, cfg, 'unlock')) advanceTutorial(state, cfg)
      revealAround(state, to.row, to.col)
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
      revealAround(state, to.row, to.col)
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
  const mergeCap = cfg && (item.kind === 'product' || item.kind === 'producer') ? lineCap(cfg, item.line) : PRODUCT_CAP
  if (canMerge(item, other, mergeCap)) {
    if (other.kind === 'product' && item.kind === 'product') {
      const level = other.level + 1
      state.board[to.row][to.col] = cfg ? makeChainItem(state, cfg, other.line, level) : makeProduct(state, other.line, level)
      state.board[from.row][from.col] = null
      noteUnlock(state, other.line, level)
      if (cfg && (atStep(state, cfg, 'merge') || atStep(state, cfg, 'bagMerge'))) advanceTutorial(state, cfg)
      revealAround(state, to.row, to.col)
      revealAround(state, from.row, from.col)
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
      const level = Math.min(lineCap(cfg, other.line), other.level + 1)
      state.board[to.row][to.col] = makeProducer(state, other.producerId, cfg, level)
      state.board[from.row][from.col] = null
      if (other.producerId === 'food' && atStep(state, cfg, 'producerL2') && level === 2) advanceTutorial(state, cfg)
      if (other.producerId === 'food' && atStep(state, cfg, 'producerL3') && level >= 3) advanceTutorial(state, cfg)
      revealAround(state, to.row, to.col)
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
    if (!item || item.kind !== 'product' || lockAt(state, row, col)) return
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
  const producer = cfg.producers.find((entry) => entry.line === line)
  if (!producer) return false
  if (producerLevelOwned(state, producer.id) < cfg.economy.producerSpawnLevel) return false
  const cap = cfg.items.lines.find((entry) => entry.id === line)?.levels.length ?? PRODUCT_CAP
  return level >= 1 && level <= cap
}

function ownedLines(state: GameState, cfg: GameConfig): string[] {
  return cfg.producers
    .filter((producer) => producerLevelOwned(state, producer.id) >= cfg.economy.producerSpawnLevel)
    .map((producer) => producer.line)
}

function maxOrderLevel(state: GameState, line: string): number {
  const unlocked = state.unlocked[line] ?? 0
  if (unlocked >= 6) return 6
  if (unlocked >= 4) return unlocked
  return 3
}

const GUEST_ROTATION = ['boatman', 'embroider', 'fisherman', 'squire', 'scholar', 'teaGuest']

function nextGuest(state: GameState): string {
  const busy = new Set(state.orders.map((order) => order.customerId))
  for (let step = 0; step < GUEST_ROTATION.length; step++) {
    const id = GUEST_ROTATION[(state.orderCounter + step) % GUEST_ROTATION.length]
    if (id && !busy.has(id)) return id
  }
  return GUEST_ROTATION[state.orderCounter % GUEST_ROTATION.length] ?? 'teaGuest'
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

export function fillOrders(state: GameState, cfg: GameConfig, rng: Rng): void {
  let guard = 0
  while (state.orders.length < cfg.orders.maxActive && guard < 8) {
    const order = generateOrder(state, cfg, rng)
    if (!order) break
    state.orders.push(order)
    guard += 1
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
    if (!item || item.kind !== 'product' || lockAt(state, row, col)) return
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
    if (!item || item.kind !== 'product' || lockAt(state, row, col)) return
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
  const ready = new Set<string>()
  eachCell(state.board, (item, row, col) => {
    if (!item || item.kind !== 'product' || lockAt(state, row, col)) return
    const hit = state.orders.some((order) =>
      order.slots.some((slot) => slot.line === item.line && slot.level === item.level),
    )
    if (hit) check.push(`${row},${col}`)
  })
  for (const order of state.orders) {
    for (const pos of orderTakeCells(state, order)) ready.add(`${pos.row},${pos.col}`)
  }
  return { check, ready: [...ready] }
}

export function orderPayout(order: Order, cfg: GameConfig): { coins: number; xp: number; smiles: number } {
  let coins = orderReward(order, cfg)
  let xp = order.big ? cfg.economy.bigOrderXp : cfg.economy.orderXp
  const smiles = order.big || order.chest ? 2 : 1
  if (order.chest) {
    coins = Math.round(coins * cfg.economy.chestRewardTimes)
    xp = Math.round(xp * cfg.economy.chestRewardTimes)
  }
  return { coins, xp, smiles }
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
  state.xp += pay.xp
  state.smiles += pay.smiles
  state.stats.ordersDone += 1
  logAction(state, now, 'order')
  const dialogue = order.big || order.chest ? talkOf(cfg, order.customerId, true) : undefined
  state.orders = state.orders.filter((entry) => entry.id !== orderId)
  if (state.phase === 'play') fillOrders(state, cfg, rng)
  arrangeOrders(state, now)
  if (order.chest) grantMaterials(state, cfg, rng, cfg.economy.chestBonusItems)
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

function smileMaterial(state: GameState, cfg: GameConfig, rng: Rng): { line: string; level: number } {
  const min = cfg.economy.smilePieceMin ?? 2
  const max = Math.max(min, cfg.economy.smilePieceMax ?? 3)
  const needs = state.orders.flatMap((order) => order.slots.map((slot) => slot.line))
  const lines = needs.length ? needs : ownedLines(state, cfg)
  const line = lines[Math.floor(rng() * Math.max(1, lines.length))] ?? 'food'
  const level = min + Math.floor(rng() * (max - min + 1))
  return { line, level }
}

export function openSmilePrize(state: GameState, cfg: GameConfig, rng: Rng): ActionResult {
  const goal = cfg.economy.smileGoal
  if (state.smiles < goal) return { ok: false, reason: 'smiles', events: [] }
  const extra = state.smiles - goal
  state.smiles = 0
  if (extra > 0) {
    queueReward(state, { uid: nextUid(state, 's'), kind: 'rewardBox', box: 'smile', n: extra })
  }
  const count = cfg.economy.smilePrizeCount ?? 15
  const names: string[] = []
  for (let i = 0; i < count; i++) {
    const mat = smileMaterial(state, cfg, rng)
    const item = makeProduct(state, mat.line, mat.level)
    noteUnlock(state, mat.line, mat.level)
    const spot = findEmpty(state)[0]
    if (spot) state.board[spot.row][spot.col] = item
    else queueReward(state, item)
    names.push(productName(cfg, mat.line, mat.level))
  }
  state.smileModal = { names }
  if (state.guide === 'smile') state.guide = 'none'
  return { ok: true, events: [{ type: 'smile', count }] }
}

export function smilesVisible(state: GameState, cfg: GameConfig, now: number): boolean {
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

export function scrollOrders(start: number, dx: number, max: number): number {
  return Math.min(Math.max(0, max), Math.max(0, start - dx))
}

export function storyLength(cfg: GameConfig): number {
  const cut = cfg.opening.findIndex((step) => step.scene.startsWith('棋盘'))
  return cut === -1 ? cfg.opening.length : cut
}

export function advanceStory(state: GameState, cfg: GameConfig): void {
  if (state.phase !== 'story') return
  const next = state.storyStep + 1
  if (next >= storyLength(cfg)) {
    state.storySeen = true
    state.storyStep = storyLength(cfg)
    state.phase = 'opening'
    state.openingStep = 0
    return
  }
  state.storyStep = next
}

export function skipStory(state: GameState): void {
  if (state.phase !== 'story') return
  state.storySeen = true
  state.phase = 'opening'
  state.openingStep = 0
}

export const INFO_EMPTY = '点击棋子，在这里查看详细信息。'

export function feedsOrder(state: GameState, row: number, col: number): boolean {
  return orderMarks(state).check.includes(`${row},${col}`)
}

export function infoCaption(cfg: GameConfig, item: Item): { title: string; usage: string } {
  if (item.kind === 'product') {
    const name = item.tag === 'bag' ? '购物袋' : productName(cfg, item.line, item.level)
    return { title: `${name}（等级 ${item.level}）`, usage: cfg.copy.infoMerge }
  }
  if (item.kind === 'producer') {
    const lineName = cfg.items.lines.find((line) => line.id === item.line)?.name ?? '原料'
    return {
      title: `${producerName(cfg, item.producerId)}（等级 ${item.level}）`,
      usage: cfg.copy.infoProducer.replace('{line}', lineName),
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
    const title = item.box === 'blue' ? '蓝宝箱' : item.box === 'purple' ? '紫礼盒' : '购物袋'
    return { title: `${title}（奖励）`, usage: item.box === 'blue' ? '点开得到体力瓶。' : '点开得到一些棋子。' }
  }
  return { title: `${cfg.items.chestName}（宝箱）`, usage: '点一下拆出体力。' }
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

export function tryAdvanceStory(state: GameState, cfg: GameConfig, hotspot: boolean): boolean {
  if (state.phase !== 'story' || !hotspot) return false
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
  let level = 1
  const thresholds = cfg.economy.levelTaskThresholds
  for (let i = 0; i < thresholds.length; i++) {
    if (count >= thresholds[i]) level = i + 2
  }
  return level
}

export function xpThresholds(cfg: GameConfig): number[] {
  return cfg.economy.levelTaskThresholds.map((count) => count * cfg.economy.xpPerTask)
}

export function levelForXp(xp: number, cfg: GameConfig): number {
  let level = 1
  const thresholds = xpThresholds(cfg)
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i + 2
  }
  return level
}

function grantProducer(state: GameState, cfg: GameConfig, rng: Rng, id: string): GameEvent[] {
  if (state.hasProducer[id] || producerLevelOwned(state, id) > 0) return []
  const def = cfg.producers.find((p) => p.id === id)
  if (!def) return []
  state.hasProducer[id] = true
  state.newestLine = def.line
  state.orderBias = def.line
  state.producerLesson = id
  const made = makeProducer(state, id, cfg, cfg.economy.producerSpawnLevel)
  const spot = findEmpty(state)[0]
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
    if (order.scripted) continue
    if (order.slots.some((slot) => slot.filled)) continue
    const next = generateOrder(state, cfg, rng)
    if (next) state.orders[i] = next
    return
  }
}

export function reconcileLevel(state: GameState, cfg: GameConfig, _rng: Rng): GameEvent[] {
  const events: GameEvent[] = []
  const should = levelForXp(state.xp, cfg)
  while (state.level < should) {
    state.level += 1
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
  for (const reward of modal.rewards) {
    if (cfg.producers.some((entry) => entry.id === reward.id)) {
      events.push(...grantProducer(state, cfg, rng, reward.id).filter((event) => event.type !== 'toast'))
    } else if (reward.id === 'gem') {
      const gem = makeGem(state, 1)
      queueReward(state, gem)
      events.push({ type: 'grant', kind: 'box', name: reward.name, row: -1, col: -1, pending: true })
    } else if (reward.id === 'chest') {
      const chest = makeChest(state)
      if (state.chestLesson === 0) state.chestLesson = 1
      queueReward(state, chest)
      events.push({ type: 'grant', kind: 'chest', name: reward.name, row: -1, col: -1, pending: true })
    } else if (reward.id === 'blue' || reward.id === 'purple' || reward.id === 'bag') {
      queueReward(state, makeRewardBox(state, cfg, rng, reward.id))
      events.push({ type: 'grant', kind: 'box', name: reward.name, row: -1, col: -1, pending: true })
    }
  }
  state.levelModal = state.levelQueue.shift() ?? null
  return { ok: true, events }
}

function rollBoxDrops(state: GameState, cfg: GameConfig, rng: Rng, box: 'blue' | 'purple' | 'bag'): LootDrop[] {
  if (box === 'blue') return cfg.economy.blueBoxPotions.map((energy) => ({ item: makePotion(state, tierForEnergy(cfg, energy)) }))
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

export function makeRewardBox(state: GameState, cfg: GameConfig, rng: Rng, box: 'blue' | 'purple' | 'bag'): Item {
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
  if (state.chestLesson === 2) state.chestLesson = 3
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
  else {
    state.board[pos.row][pos.col] = makeProduct(state, buried.line, buried.level)
    noteUnlock(state, buried.line, buried.level)
  }
  revealAround(state, pos.row, pos.col)
  if (cfg && (atStep(state, cfg, 'giftTap') || atStep(state, cfg, 'giftRush'))) advanceTutorial(state, cfg)
  const level = buried.kind === 'product' ? buried.level : buried.kind === 'coin' ? 1 : buried.kind === 'gem' ? buried.tier : buried.tier
  const line = buried.kind === 'product' ? buried.line : buried.kind
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
  return !!item && (item.kind === 'chest' || (item.kind === 'rewardBox' && item.box !== 'smile'))
}

function findBoardBox(state: GameState): Pos | null {
  for (let row = 0; row < state.board.length; row++) {
    for (let col = 0; col < (state.board[row]?.length ?? 0); col++) {
      if (isLootBox(state.board[row]?.[col])) return { row, col }
    }
  }
  return null
}

export function resolveGuides(state: GameState, cfg?: GameConfig): string[] {
  const notes: string[] = []
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
  if (next.choices?.length) {
    const picked = next.choices.findIndex((entry) => entry.id === choice)
    state.decorate = { taskId: next.id, index: picked >= 0 ? picked : 0 }
  } else startBuildStory(state, cfg, next.id)
  logAction(state, now, 'build')
  const events: GameEvent[] = [{ type: 'build', taskId: next.id, name: next.name }]
  events.push(...reconcileLevel(state, cfg, rng))
  events.push(...checkStepGrants(state, cfg, rng))
  const firstId = cfg.buildings.steps[0]?.tasks[0]?.id
  if (state.phase === 'opening' && firstId && state.tasksDone.includes(firstId)) {
    state.phase = 'play'
    state.openingStep = cfg.copy.tutorial.length
    fillOrders(state, cfg, rng)
  }
  return { ok: true, events }
}

export function refreshGuide(state: GameState, cfg: GameConfig, view: 'board' | 'house'): void {
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
}

export function serialize(state: GameState, cfg: GameConfig): string {
  const data: SaveFile = { v: 2, state, economy: cfg.economy }
  return JSON.stringify(data)
}

export function hydrate(raw: string, cfg: GameConfig): GameState | null {
  try {
    const data = JSON.parse(raw) as SaveFile
    if (!data || data.v !== 2 || !data.state || !Array.isArray(data.state.board)) return null
    if (data.state.board.length !== ROWS) return null
    if (!data.state.board.every((row) => Array.isArray(row) && row.length === COLS)) return null
    if (data.economy) cfg.economy = { ...cfg.economy, ...data.economy }
    const state = data.state
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
    state.storyStep ??= 0
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
    const fixProducer = (item: Item | null) => {
      if (item?.kind === 'producer' && (item.level == null || item.level < 1)) item.level = 1
    }
    for (const row of state.board) for (const item of row) fixProducer(item)
    for (const item of state.pending) fixProducer(item)
    for (const item of state.rewards) fixProducer(item)
    for (const lock of state.locks) if (!lock.veil) lock.veil = 'half'
    state.hasProducer ||= {}
    state.locks ||= []
    state.levelQueue ||= []
    state.levelModal ??= null
    state.smileModal ??= null
    state.smiles ??= 0
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
    return { title: producerName(cfg, item.producerId), level: '母棋', text }
  }
  if (item.kind === 'potion') {
    return {
      title: potionName(cfg, item.tier),
      level: cnLevel(item.tier),
      text: cfg.copy.potion.replace('{energy}', String(potionEnergy(cfg, item.tier))),
    }
  }
  if (item.kind === 'rewardBox') {
    const text = item.box === 'blue' ? cfg.copy.blue : item.box === 'purple' ? cfg.copy.purple : cfg.copy.bag
    const title = item.box === 'blue' ? '蓝宝箱' : item.box === 'purple' ? '紫礼盒' : '购物袋'
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
