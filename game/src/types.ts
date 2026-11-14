export const COLS = 7
export const ROWS = 9

export interface LevelDef {
  level: number
  name: string
  orderable: boolean
  coins: number
  big?: boolean
  producer?: boolean
  cooldownMs?: number
  drops?: number[]
}

export interface LineDef {
  id: string
  name: string
  color: string
  levels: LevelDef[]
  /** 点一下收进账户，不进订单。 */
  collect?: 'coin' | 'gem'
}

export interface PotionDef {
  tier: number
  name: string
  energy: number
}

export interface GemDef {
  tier: number
  name: string
  amount: number
}

export interface ProducerDef {
  id: string
  name: string
  line: string
  grant: string
  /** normal 花体力；netSource 出渔网；plant 不花体力；consumable 点完消失。 */
  kind?: 'normal' | 'netSource' | 'plant' | 'consumable'
  side?: string
}

export interface ChoiceDef {
  id: string
  name: string
}

export interface TaskDef {
  id: string
  name: string
  price: number
  part: string
  choices?: ChoiceDef[]
}

export interface StepDef {
  id: string
  name: string
  tasks: TaskDef[]
}

export interface NormBox {
  x: number
  y: number
  w: number
  h: number
}

export interface CharacterDef {
  id: string
  name: string
  role: string
  当前衣装?: string
  portrait?: string
  /** 立绘里头顶的位置，0 到 1。有立绘时用来把头顶贴到订单区上沿。 */
  crown?: number
  /** 有立绘时是图片里的脸；没有立绘时是客人框里的脸。 */
  face?: NormBox
}

export interface BoardTheme {
  mat: string
  cellLight: string
  cellDark: string
  cellLine: string
  covered: string
  half: string
  ready: string
}

export type ComicEnter =
  | 'fade-push'
  | 'pop'
  | 'slide-right'
  | 'fade-face'
  | 'slide-left'
  | 'pop-right'
  | 'pop-big'
  | 'rise'
  | 'fade'
  | 'push'
  | 'slide-slant'
  | 'slow-push'

export interface ComicPanel {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** 页内叠放，小的在下面。 */
  z?: number
}

export interface ComicBeat {
  kind: 'line' | 'sila' | 'hold'
  panel: string
  enter?: ComicEnter
  ms?: number
  speaker?: string
  text?: string
  x?: number
  y?: number
  w?: number
  cue?: 'crickets' | 'hmm' | 'snore' | 'hmph' | 'tear'
}

export interface ComicPage {
  panels: ComicPanel[]
  beats: ComicBeat[]
}

export interface OpeningScript {
  width: number
  height: number
  pages: ComicPage[]
}

export interface ChestWeight {
  energy: number
  weight: number
}

export interface Economy {
  energyMax: number
  energyRegenMs: number
  energyCost: number
  startEnergy: number
  startCoins: number
  xpPerTask: number
  levelTaskThresholds: number[]
  levelRewards: { level: number; rewards: LevelRewardEntry[] }[]
  freeRefill: number
  adEnergy: number
  adDailyMax: number
  chestWeights: ChestWeight[]
  newbieChestFixed: boolean
  newbieChestCount: number
  newbieChest: number[]
  producerCharges: number
  producerCooldownMs: number
  producerL2Chance: number
  orderRewardScale: number
  buildPriceScale: number
  bigOrderL3Times: number
  l3Coins: number
  animMs: number
  hitStopMs: number
  snapStrength: number
  dailyChestFromDay: number
  orderXp: number
  bigOrderXp: number
  chestRewardTimes: number
  chestBonusItems: number
  chestOrderChance: number
  smileGoal: number
  smilePrizeMin: number
  smilePrizeMax: number
  smileUiAfterMs: number
  idleHintMs: number
  lockPulse: number
  sellPrices: number[]
  producerMaxLevel: number
  producerSpawnLevel: number
  producerGraceMs: number
  producerChargesByLevel: number[]
  energyGemPrices: number[]
  energyGemAmount: number
  lateProducerChance: number
  storageUnlockLevel: number
  earlyOrderUntil: number
  earlyOrderAChance: number
  earlyOrderALevel: number
  earlyOrderBMin: number
  earlyOrderBMax: number
  earlyOrderCoinFloor: number
  smilePrizeCount: number
  smilePieceMin: number
  smilePieceMax: number
  giftRushGems: number
  guideUntilLevel: number
  guideShows: number
  newChainWeight: number
  mixLineChance: number
  boxCoin: number
  boxGem: number
  giftCooldownMs: number
  producerRoundBase: number
  producerRoundStep: number
  producerRoundCooldownMs: number
  producerOutputLevel: number
  producerSideLevel: number
  producerMainChance: number
  plantOutputLevel: number
  plantBurst: number
  plantCooldownMs: number
  consumableTaps: number
  basketLowChance: number
  netFishCount: number
  netMaxLevel: number
  firstProducerLevel: number
  shopDailyEnergy: number
  shopPackGems: number
  shopPackEnergy: number
  smileUnlockLevel: number
  /** 达到这个等级，倍速按钮才出现 x4。x8 不进循环。 */
  speed4Level: number
  /** 客人 1024 画布缩到设计稿上的比例。0.29 时宽约 297。 */
  guestCanvasScale: number
  ajiangFps: number
  ajiangIntroStart: number
  ajiangIntroEnd: number
  ajiangLoopStart: number
  ajiangLoopEnd: number
  spawn1High: number
  spawn2Mid: number
  spawnTable: { mult: 1 | 2 | 4 | 8; cost: number; enabled: boolean; weights: { level: number; p: number }[] }[]
  purpleBoxCount: number
  bagBoxCount: number
  blueBoxPotions: number[]
  storageCapacity: number
}

export interface GameConfig {
  items: { lines: LineDef[]; potions: PotionDef[]; gems: GemDef[]; chestName: string }
  producers: ProducerDef[]
  orders: {
    maxActive: number
    twoSlotChance: number
    bigChance: number
    customersByLine: Record<string, string[]>
    talk: Record<string, { normal: string; big: string }>
  }
  buildings: { steps: StepDef[] }
  characters: CharacterDef[]
  opening: OpeningScript
  stories: Record<string, { speaker: string; text: string }[]>
  economy: Economy
  board: BoardFile
  boardTheme: BoardTheme
  copy: {
    daughterName: string
    productRaw: string
    productOrder: string
    producer: string
    producerCool: string
    lock: string
    gift: string
    potion: string
    chest: string
    blue: string
    purple: string
    bag: string
    bagPiece: string
    infoMerge: string
    infoProducer: string
    infoUse: string
    infoChain: string
    infoCoin: string
    infoSold: string
    producerExtra: string
    storageLesson: string[]
    tutorial: { id: string; type: '操作' | '对话'; gesture: 'tap' | 'drag' | 'none'; text: string }[]
  }
}

export interface ProductItem {
  uid: string
  kind: 'product'
  line: string
  level: number
  tag?: 'bag'
}

export interface ProducerItem {
  uid: string
  kind: 'producer'
  producerId: string
  line: string
  level: number
  charges: number
  cooldownUntil: number
}

export interface PotionItem {
  uid: string
  kind: 'potion'
  tier: number
}

export interface LootDrop {
  item?: Item
  coins?: number
  gems?: number
}

export interface ChestItem {
  uid: string
  kind: 'chest'
  drops?: LootDrop[]
}

export interface RewardBoxItem {
  uid: string
  kind: 'rewardBox'
  box: 'blue' | 'purple' | 'bag' | 'smile'
  n?: number
  drops?: LootDrop[]
}

export interface GemItem {
  uid: string
  kind: 'gem'
  tier: number
}

export type Item = ProductItem | ProducerItem | PotionItem | ChestItem | RewardBoxItem | GemItem

export interface SaleUndo {
  item: Item
  row: number
  col: number
  coins: number
}

export interface CellLock {
  row: number
  col: number
  cover: 'sand' | 'web' | 'gift'
  veil?: 'full' | 'half'
  giftUntil?: number
  /** 变成半遮掩时立刻发放，并露出下面的物品。 */
  prize?: { energy?: number; coins?: number; gems?: number; chest?: boolean }
  buried:
    | { kind: 'product'; line: string; level: number }
    | { kind: 'producer'; id: string; level: number }
    | { kind: 'coin'; amount: number; line?: string; level?: number }
    | { kind: 'gem'; tier: number; line?: string; level?: number }
    | { kind: 'potion'; tier: number; line?: string; level?: number }
}

export interface BoardFile {
  open: { row: number; col: number; item?: { kind: 'product'; line: string; level: number } | { kind: 'producer'; id: string } }[]
  locks: CellLock[]
  roles: {
    mergeA: Pos
    mergeB: Pos
    unlock: Pos
    mergeD: Pos
    producer: Pos
    gift: Pos
    bagSpot: Pos
  }
}

export interface OrderSlot {
  line: string
  level: number
  filled: boolean
}

export interface Order {
  id: string
  customerId: string
  slots: OrderSlot[]
  big: boolean
  scripted?: boolean
  chest?: boolean
  readyAt?: number
}

export interface LevelRewardEntry {
  id: string
  name: string
  producerLevel?: number
  energy?: number
  gems?: number
}

export interface LevelModal {
  level: number
  rewards: LevelRewardEntry[]
}

export interface Visit {
  start: number
  ms: number
}

export interface ActionLog {
  t: number
  type: string
  energy: number
  level: number
}

export interface GameState {
  board: (Item | null)[][]
  orders: Order[]
  pending: Item[]
  coins: number
  energy: number
  energyTs: number
  xp: number
  level: number
  tasksDone: string[]
  decoration: string | null
  styles: Record<string, string>
  decorate: { taskId: string; index: number } | null
  rewards: Item[]
  gems: number
  gemBuys: number
  playedMs: number
  armed: { row: number; col: number } | null
  chainPop: { kind: 'potion' | 'gem'; tier: number } | null
  guide: 'none' | 'buildTalk' | 'buildBtn' | 'repairBtn' | 'backBtn' | 'backTalk' | 'smile'
  guidedTask: string | null
  notice: { text: string } | null
  giftPrompt: { row: number; col: number } | null
  giftFreeUsed: boolean
  buildStory: { taskId: string; index: number } | null
  buildGuideCount: number
  backGuideCount: number
  chestLesson: number
  chestCell: { row: number; col: number } | null
  producerLesson: string | null
  newestLine: string | null
  unlocked: Record<string, number>
  seen: Record<string, number[]>
  producerSeen: Record<string, number[]>
  storageLesson: number
  sale: SaleUndo | null
  hasProducer: Record<string, boolean>
  chestsOpened: number
  freeRefillUsed: boolean
  dailyChestDate: string | null
  firstPlayDate: string
  showHelp: boolean
  locks: CellLock[]
  phase: 'story' | 'opening' | 'play'
  openingStep: number
  storyStep: number
  storySeen: boolean
  soundMuted: boolean
  storageOpen: boolean
  bagPhase: 'place' | 'merge'
  smiles: number
  adDay: string
  adUsedToday: number
  playStartedAt: number
  levelModal: LevelModal | null
  levelQueue: LevelModal[]
  smileModal: { names: string[] } | null
  orderBias: string | null
  spawnMult: 1 | 2 | 4 | 8
  mintStep: 'off' | 'talk' | 'wait' | 'select' | 'produce' | 'merge' | 'deliver'
  shopOpen: boolean
  shopClaimDate: string | null
  shopPackClaimed: boolean
  detailLine: string | null
  meatGuided: boolean
  bevGuided: boolean
  mintGuided: boolean
  idCounter: number
  orderCounter: number
  stats: {
    producerTaps: number
    ordersDone: number
    adClicks: number
    visits: Visit[]
    log: ActionLog[]
  }
}

export interface Pos {
  row: number
  col: number
}

export type Rng = () => number

export type GameEvent =
  | { type: 'spawn'; row: number; col: number; fromRow: number; fromCol: number }
  | { type: 'placePending'; row: number; col: number }
  | { type: 'merge'; row: number; col: number; line: string; level: number; kind: 'product' | 'potion' }
  | { type: 'move'; fromRow: number; fromCol: number; toRow: number; toCol: number }
  | { type: 'swap'; aRow: number; aCol: number; bRow: number; bCol: number }
  | {
      type: 'deliver'
      orderId: string
      coins: number
      xp: number
      smiles: number
      big: boolean
      chest: boolean
      customerId: string
      dialogue?: string
    }
  | { type: 'unlock'; row: number; col: number; line: string; level: number }
  | { type: 'smile'; count: number }
  | { type: 'levelup'; level: number; text: string }
  | { type: 'toast'; text: string }
  | { type: 'needEnergy' }
  | { type: 'refill'; amount: number; mode: 'free' | 'ad' | 'gem' }
  | { type: 'takeReward'; row: number; col: number }
  | { type: 'drink'; amount: number; row: number; col: number }
  | { type: 'openChest'; row: number; col: number; count: number }
  | { type: 'build'; taskId: string; name: string }
  | { type: 'grant'; kind: 'producer' | 'chest' | 'box'; name: string; row: number; col: number; pending: boolean }
  | { type: 'cooldown'; remainMs: number }
  | { type: 'bounce' }

export interface ActionResult {
  ok: boolean
  reason?: string
  events: GameEvent[]
}
