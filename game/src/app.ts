import { tutorialHand } from './coach'
import { createSfx, type Sfx } from './audio'
import { defaultConfig, resetEconomy } from './config'
import { partAt, render } from './draw'
import { createFx, type Fx } from './fx'
import { clamp } from './format'
import {
  cellAt,
  cellCenter,
  guideHole,
  chainCardRect,
  chainCloseRect,
  chainPopRect,
  decorPopupRects,
  talkRect,
  contains,
  hitTest,
  hudAnchors,
  layout,
  levelClaimRect,
  smileDismissRect,
  type Frame,
  type Hit,
} from './layout'
import {
  advanceDialogue,
  advanceOpening,
  advanceStory,
  applyAdRefill,
  advanceBuildStory,
  advanceGuide,
  applyFreeRefill,
  arrangeOrders,
  buyEnergyWithGems,
  collectLock,
  confirmDecor,
  atStep,
  guideIsLocking,
  guideLockKey,
  guideSpot,
  beatVisit,
  buildTask,
  canClaimDaily,
  canMerge,
  lineCap,
  producerCap,
  activeOverlay,
  dismissDetail,
  dismissNotice,
  pumpMint,
  canSell,
  claimDailyChest,
  claimLevelModal,
  clearSale,
  completeOrder,
  createGame,
  currentTutorial,
  dismissStuckGuide,
  enterKitchen,
  finishTutorial,
  guardedDrop,
  hydrate,
  inProducerGrace,
  lineColor,
  nextTask,
  occupied,
  openChest,
  openRewardBox,
  openSmilePrize,
  pokeGift,
  previewDecor,
  reopenDecor,
  orderSatisfied,
  orderStripAction,
  reconcileLevel,
  refreshGuide,
  refreshProducers,
  resolveGuides,
  rushProducer,
  rushGift,
  sellItem,
  serialize,
  skipOpening,
  settleGifts,
  skipStory,
  scrollOrders,
  smilesVisible,
  startVisit,
  storageTakeIndex,
  storeItem,
  syncEnergy,
  takeFromStorage,
  takeReward,
  tapConsumable,
  tapProducer,
  collectBoardProduct,
  dropItem,
  cycleSpawnMult,
  claimShopDaily,
  claimShopPack,
  tutorialAllowsInspect,
  tutorialDropOk,
  undoSale,
} from './logic/sim'
import type { Platform } from './platform/types'
import { SLIDERS, sliderValue } from './tuner'
import type { ActionResult, GameState, Item, Pos, Rng } from './types'

const SAVE_KEY = 'jiangnan.save.v1'

interface Pointer {
  id: number
  x: number
  y: number
  sx: number
  sy: number
  hit: Hit
  moved: boolean
  camX: number
  camY: number
  scroll: number
  orderScroll: number
  downAt: number
}

export function startGame(platform: Platform): void {
  const cfg = defaultConfig()
  let state = createGame(platform.now(), cfg)
  const saved = platform.storageGet(SAVE_KEY)
  if (saved) {
    const loaded = hydrate(saved, cfg)
    if (loaded) state = loaded
  }
  const rng: Rng = () => Math.random()
  reconcileLevel(state, cfg, rng)
  startVisit(state, platform.now())

  const fx = createFx()
  const sfx = createSfx(() => platform.audio())
  let view: 'board' | 'house' = 'board'
  let modal: 'energy' | null = null
  let tuner = false
  let tunerScroll = 0
  let cam = { x: 700, y: 980, scale: 0.85 }
  let camReady = false
  let dirty = false
  let lastSave = 0
  let frozenAccum = 0
  let hitStopUntil = 0
  let hitStopAt = 0
  let lastAnim = 0
  let dragId = -1
  let selected: { row: number; col: number } | null = null
  let orderScroll = 0
  let chain: { line: string; level: number; source: 'order' | 'producer' } | null = null
  let orderFocus: { line: string; level: number } | null = null
  let lastInput = platform.now()
  let guideKey = ''
  let guideSince = platform.now()
  let guideMisses = 0
  const pointers = new Map<number, Pointer>()
  let pinch: { dist: number; scale: number } | null = null
  let frame = makeFrame()

  function animAt(real: number): number {
    if (real < hitStopUntil) return hitStopAt
    return real - frozenAccum
  }

  function startHitStop(real: number, ms: number): void {
    if (ms <= 0) return
    if (real < hitStopUntil) {
      const extra = real + ms - hitStopUntil
      if (extra > 0) {
        hitStopUntil += extra
        frozenAccum += extra
      }
      return
    }
    hitStopAt = real - frozenAccum
    hitStopUntil = real + ms
    frozenAccum += ms
  }

  function snapDuration(): number {
    return 280 - clamp(cfg.economy.snapStrength, 0, 1) * 230
  }

  function toast(message: string): void {
    fx.toasts.push({ text: message, birth: platform.now(), dur: 1600 })
    if (fx.toasts.length > 3) fx.toasts.shift()
  }

  function floatAt(message: string, x: number, y: number, color: string): void {
    fx.floaters.push({ text: message, x, y, birth: animAt(platform.now()), dur: 700, color })
  }

  function saveNow(): void {
    beatVisit(state, platform.now())
    platform.storageSet(SAVE_KEY, serialize(state, cfg))
    dirty = false
    lastSave = platform.now()
  }

  function mark(): void {
    dirty = true
  }

  function rushShown(): boolean {
    if (atStep(state, cfg, 'giftRush')) return true
    const picked = selected
    if (!picked) return false
    const now = platform.now()
    const item = state.board[picked.row]?.[picked.col]
    if (item?.kind === 'producer' && item.charges <= 0 && item.cooldownUntil > now && !inProducerGrace(state, cfg)) return true
    const lock = state.locks.find((entry) => entry.row === picked.row && entry.col === picked.col)
    return !item && !!lock && lock.cover === 'gift' && lock.giftUntil != null && lock.giftUntil > now
  }

  function mode(): 'story' | 'board' | 'house' {
    if (state.phase === 'story') return 'story'
    if (view === 'house') return 'house'
    return 'board'
  }

  function makeFrame(): Frame {
    const size = platform.size()
    const current = mode()
    return layout({
      w: size.w,
      h: size.h,
      insetTop: platform.insets.top,
      insetBottom: platform.insets.bottom,
      mode: current,
      orderCount: state.orders.length,
      orderSlots: state.orders.map((order) => order.slots.length),
      orderScroll,
      showHint: false,
      showSheet: false,
      showSkip: state.phase === 'story' || state.buildStory != null,
      showDaily: current === 'board' && state.phase === 'play' && canClaimDaily(state, platform.now(), cfg),
      showHouseBtn: true,
      showStorage: state.storageLesson >= 4,
      storageHot: state.storageOpen,
      showSmile: smilesVisible(state, cfg, platform.now()),
      showRush: rushShown(),
      choiceCount: 0,
      tuner,
      tunerScroll,
      modal: modal != null,
      help: state.showHelp && !tuner && modal == null,
      showEnter: atStep(state, cfg, 'enter'),
      showInfo: false,
      showShop: state.level >= 3,
      shop: activeOverlay(state) === 'shop',
      detail: activeOverlay(state) === 'detail',
    })
  }

  function ensureCam(): void {
    if (camReady || frame.map.h <= 0) return
    cam.x = 700
    cam.y = 980
    cam.scale = clamp(Math.min(frame.map.w / 640, frame.map.h / 860), 0.35, 2.6)
    camReady = true
  }

  function fly(item: Item, fromX: number, fromY: number, toX: number, toY: number, hide: Pos[], ease: 'snap' | 'spawn'): void {
    fx.flyers.push({
      item,
      fromX,
      fromY,
      toX,
      toY,
      hide,
      ease,
      birth: animAt(platform.now()),
      dur: ease === 'spawn' ? cfg.economy.animMs : snapDuration(),
    })
  }

  function burst(x: number, y: number, color: string): void {
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.25
      const speed = 90 + Math.random() * 170
      fx.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        birth: animAt(platform.now()),
        life: cfg.economy.animMs * 0.9,
        color,
        r: 2 + Math.random() * 2.4,
      })
    }
    if (fx.particles.length > 140) fx.particles.splice(0, fx.particles.length - 140)
  }

  function spawnCoins(from: { x: number; y: number }, to: { x: number; y: number }, amount: number, real: number): void {
    if (amount <= 0) return
    const n = Math.min(8, Math.max(4, Math.round(Math.sqrt(amount))))
    const base = Math.floor(amount / n)
    let rest = amount
    const dur = cfg.economy.animMs * 1.15
    const stagger = 42
    const hit = cfg.economy.hitStopMs
    for (let i = 0; i < n; i++) {
      const value = i === n - 1 ? rest : base
      rest -= value
      fx.coins.push({
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        birth: animAt(real),
        dur,
        delay: i * stagger,
        value,
        bend: (i - (n - 1) / 2) * 28,
      })
      sfx.coinTick(sfx.now() + (hit + i * stagger + dur) / 1000)
    }
    fx.incoming += amount
  }

  function present(result: ActionResult, opt?: { silent?: boolean; coinFrom?: { x: number; y: number } }): void {
    const real = platform.now()
    if (!result.ok && !opt?.silent) sfx.error()
    for (const event of result.events) {
      if (event.type === 'merge') {
        sfx.merge()
        startHitStop(real, cfg.economy.hitStopMs)
        const point = cellCenter(frame, event.row, event.col)
        fx.pops.push({ row: event.row, col: event.col, birth: animAt(real), dur: cfg.economy.animMs })
        burst(point.x, point.y, event.kind === 'product' ? lineColor(cfg, event.line) : '#2f6ea8')
      } else if (event.type === 'spawn') {
        const item = state.board[event.row][event.col]
        const from = cellCenter(frame, event.fromRow, event.fromCol)
        const to = cellCenter(frame, event.row, event.col)
        if (item) fly(item, from.x, from.y, to.x, to.y, [{ row: event.row, col: event.col }], 'spawn')
        sfx.spawn()
        sfx.land(sfx.now() + cfg.economy.animMs / 1000)
        const energy = hudAnchors(frame).energy
        floatAt('-1', energy.x, energy.y, '#9c2f2f')
      } else if (event.type === 'deliver') {
        sfx.coinStart()
        startHitStop(real, cfg.economy.hitStopMs)
        const from = opt?.coinFrom ?? { x: frame.w / 2, y: frame.hud.y + frame.hud.h + 80 }
        spawnCoins(from, hudAnchors(frame).coin, event.coins, real)
        if (event.dialogue) fx.banner = { text: event.dialogue, until: real + 2400 }
      } else if (event.type === 'toast') {
        toast(event.text)
      } else if (event.type === 'needEnergy') {
        modal = 'energy'
        fx.energyFlash = real + 700
      } else if (event.type === 'drink') {
        sfx.ui()
        const point = cellCenter(frame, event.row, event.col)
        floatAt(`+${event.amount}`, point.x, point.y, '#2c7a58')
      } else if (event.type === 'refill') {
        sfx.build()
        const energy = hudAnchors(frame).energy
        floatAt(`+${event.amount}`, energy.x, energy.y, '#2c7a58')
      } else if (event.type === 'build') {
        sfx.build()
        fx.coinPunch = animAt(real)
      } else if (event.type === 'levelup') {
        fx.banner = { text: event.text, until: real + 2400 }
        sfx.build()
      } else if (event.type === 'grant' && !event.pending) {
        fx.pops.push({ row: event.row, col: event.col, birth: animAt(real), dur: cfg.economy.animMs })
      } else if (event.type === 'openChest') {
        sfx.spawn()
      } else if (event.type === 'takeReward') {
        const item = state.board[event.row][event.col]
        const to = cellCenter(frame, event.row, event.col)
        const from = {
          x: frame.rewardTray.x + frame.rewardTray.w / 2,
          y: frame.rewardTray.y + frame.rewardTray.h / 2,
        }
        if (item) fly(item, from.x, from.y, to.x, to.y, [{ row: event.row, col: event.col }], 'spawn')
        sfx.spawn()
      } else if (event.type === 'placePending') {
        const item = state.board[event.row][event.col]
        const to = cellCenter(frame, event.row, event.col)
        const from = {
          x: frame.pendingBtn.x + frame.pendingBtn.w / 2,
          y: frame.pendingBtn.y + frame.pendingBtn.h / 2,
        }
        if (item) fly(item, from.x, from.y, to.x, to.y, [{ row: event.row, col: event.col }], 'spawn')
        sfx.spawn()
      }
    }
    if (result.ok) mark()
  }

  function updateHover(x: number, y: number): void {
    if (!fx.drag) {
      fx.hover = null
      return
    }
    const item = fx.drag.pending ? state.pending[fx.drag.index ?? 0] : state.board[fx.drag.row]?.[fx.drag.col]
    if (!item) {
      fx.hover = null
      return
    }
    for (let i = 0; i < frame.orders.length; i++) {
      if (contains(frame.orders[i], x, y)) {
        fx.hover = { kind: 'order', index: i }
        return
      }
    }
    const cell = cellAt(frame, x, y)
    if (!cell) {
      fx.hover = null
      return
    }
    const other = state.board[cell.row][cell.col]
    const cap = item.kind === 'producer' ? producerCap(cfg, item.producerId) : item.kind === 'product' ? lineCap(cfg, item.line) : 11
    fx.hover = { kind: 'cell', row: cell.row, col: cell.col, merge: !!other && canMerge(item, other, cap) }
  }

  function finishDrag(x: number, y: number): void {
    const drag = fx.drag
    fx.drag = null
    fx.hover = null
    if (!drag) return
    clearSale(state)
    if (drag.pending) {
      const index = drag.index ?? 0
      const held = state.pending[index]
      const back = { x: frame.pendingBtn.x + frame.pendingBtn.w / 2, y: frame.pendingBtn.y + frame.pendingBtn.h / 2 }
      const cell = cellAt(frame, x, y)
      if (!held || !cell) {
        if (held) fly(held, x, y, back.x, back.y, [], 'snap')
        return
      }
      const result = takeFromStorage(state, cfg, cell, index)
      if (!result.ok) {
        fly(held, x, y, back.x, back.y, [], 'snap')
        return
      }
      present(result)
      return
    }
    const item = state.board[drag.row]?.[drag.col]
    if (!item) return
    const from = { row: drag.row, col: drag.col }
    const origin = cellCenter(frame, from.row, from.col)
    const snapBack = () => fly(item, x, y, origin.x, origin.y, [from], 'snap')
    if (contains(frame.pendingBtn, x, y) && state.storageOpen) {
      const result = storeItem(state, cfg, from)
      if (!result.ok) snapBack()
      else {
        const to = { x: frame.pendingBtn.x + frame.pendingBtn.w / 2, y: frame.pendingBtn.y + frame.pendingBtn.h / 2 }
        fly(item, x, y, to.x, to.y, [from], 'snap')
        present(result)
      }
      return
    }
    const cell = cellAt(frame, x, y)
    if (!cell || (cell.row === from.row && cell.col === from.col)) {
      snapBack()
      return
    }
    if (state.phase === 'opening' && !tutorialDropOk(state, cfg, from, cell)) {
      snapBack()
      return
    }
    const result = guardedDrop(state, from, cell, cfg)
    if (!result.ok) {
      snapBack()
      return
    }
    const dest = cellCenter(frame, cell.row, cell.col)
    const event = result.events[0]
    if (event?.type === 'move') fly(item, x, y, dest.x, dest.y, [cell], 'snap')
    else if (event?.type === 'swap') {
      const other = state.board[from.row]?.[from.col]
      fly(item, x, y, dest.x, dest.y, [cell], 'snap')
      if (other) fly(other, dest.x, dest.y, origin.x, origin.y, [from], 'snap')
    }
    present(result)
  }

  function activate(hit: Hit): void {
    const now = platform.now()
    if (hit.kind === 'enter') {
      enterKitchen(state, cfg)
      sfx.ui()
      mark()
      return
    }
    if (hit.kind === 'sell') {
      if (state.phase !== 'play') return
      if (state.sale) {
        const spot = { row: state.sale.row, col: state.sale.col }
        const result = undoSale(state)
        if (result.ok) selected = spot
        present(result)
        return
      }
      if (!selected || !canSell(state, state.board[selected.row]?.[selected.col] ?? null)) return
      const result = sellItem(state, cfg, selected)
      if (result.ok) selected = null
      present(result)
      return
    }
    if (hit.kind === 'chain') {
      if (state.phase !== 'play' || !selected) return
      const item = state.board[selected.row]?.[selected.col]
      if (item?.kind !== 'producer') return
      chain = { line: item.line, level: item.level, source: 'producer' }
      sfx.ui()
      return
    }
    if (hit.kind === 'house') {
      clearSale(state)
      if (atStep(state, cfg, 'build')) finishTutorial(state, cfg, rng)
      view = 'house'
      frame = makeFrame()
      ensureCam()
      sfx.ui()
      mark()
      return
    }
    if (hit.kind === 'complete') {
      clearSale(state)
      const order = state.orders[hit.index]
      const rect = frame.orders[hit.index]
      if (!order || !rect || !orderSatisfied(state, order)) return
      present(completeOrder(state, order.id, cfg, rng, now), {
        coinFrom: { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
      })
      return
    }
    if (hit.kind === 'skip') {
      sfx.ui()
      if (state.phase === 'story') {
        skipStory(state)
        mark()
        return
      }
      const early = state.openingStep < cfg.copy.tutorial.length
      skipOpening(state, cfg, rng)
      if (!early) toast('可以自由合成了')
      view = 'board'
      mark()
      return
    }
    if (hit.kind === 'story') {
      advanceStory(state, cfg)
      sfx.ui()
      mark()
      return
    }
    if (hit.kind === 'hotspot') {
      sfx.ui()
      advanceOpening(state, cfg)
      mark()
      return
    }
    if (hit.kind === 'sheet') {
      const task = cfg.buildings.steps[0]?.tasks[0]
      if (!task) return
      present(buildTask(state, task.id, null, cfg, rng, now))
      return
    }
    if (hit.kind === 'helpOk') {
      state.showHelp = false
      sfx.ui()
      mark()
      return
    }
    if (hit.kind === 'modalPrimary') {
      const result = state.freeRefillUsed ? buyEnergyWithGems(state, cfg, now) : applyFreeRefill(state, cfg, now)
      if (result.ok) modal = null
      present(result)
      return
    }
    if (hit.kind === 'modalGhost') {
      if (state.freeRefillUsed) {
        const result = applyAdRefill(state, cfg, now)
        if (result.ok) modal = null
        present(result)
        return
      }
      modal = null
      sfx.ui()
      return
    }
    if (hit.kind === 'modalClose') {
      modal = null
      return
    }
    if (hit.kind === 'mult') {
      const next = cycleSpawnMult(state, cfg)
      toast(`产出 ${next} 倍`)
      mark()
      return
    }
    if (hit.kind === 'shop') {
      state.shopOpen = true
      mark()
      return
    }
    if (hit.kind === 'shopClose') {
      state.shopOpen = false
      if (state.guide === 'smile') state.guide = 'none'
      mark()
      return
    }
    if (hit.kind === 'shopDaily') {
      present(claimShopDaily(state, cfg, platform.now()))
      mark()
      return
    }
    if (hit.kind === 'shopPack') {
      present(claimShopPack(state, cfg))
      mark()
      return
    }
    if (hit.kind === 'detailClose') {
      dismissDetail(state)
      mark()
      return
    }
    if (hit.kind === 'tune' || hit.kind === 'tunerClose') {
      tuner = hit.kind === 'tune'
      sfx.ui()
      return
    }
    if (hit.kind === 'tunerExport') {
      const payload = {
        economy: cfg.economy,
        items: cfg.items,
        producers: cfg.producers,
        orders: cfg.orders,
        buildings: cfg.buildings,
        characters: cfg.characters,
        stats: state.stats,
      }
      platform.exportText('jiangnan-config.json', JSON.stringify(payload, null, 2))
      toast(platform.kind === 'wx' ? '配置已复制' : '已导出 JSON')
      sfx.ui()
      return
    }
    if (hit.kind === 'tunerReset') {
      resetEconomy(cfg)
      reconcileLevel(state, cfg, rng)
      toast('已恢复默认数值')
      sfx.ui()
      mark()
      return
    }
    if (hit.kind === 'tunerWipe') {
      platform.storageSet(SAVE_KEY, '')
      state = createGame(platform.now(), cfg)
      view = 'board'
      modal = null
      tuner = false
      selected = null
      chain = null
      toast('已从剧情重开')
      mark()
      return
    }
    if (hit.kind === 'tunerNewbie') {
      cfg.economy.newbieChestFixed = !cfg.economy.newbieChestFixed
      sfx.ui()
      mark()
      return
    }
    if (hit.kind === 'back') {
      view = 'board'
      sfx.ui()
      return
    }
    if (hit.kind === 'zoom') {
      if (hit.dir === 0) {
        camReady = false
        frame = makeFrame()
        ensureCam()
      } else {
        const cx = frame.map.x + frame.map.w / 2
        const cy = frame.map.y + frame.map.h / 2
        zoomAt(cx, cy, hit.dir > 0 ? 1.12 : 0.89)
      }
      sfx.ui()
      return
    }
    if (hit.kind === 'build' || hit.kind === 'choice') {
      const task = nextTask(state, cfg)
      if (!task) return
      const choice = hit.kind === 'choice' ? (task.choices?.[hit.index]?.id ?? null) : null
      present(buildTask(state, task.id, choice, cfg, rng, now))
      return
    }
    if (hit.kind === 'daily') {
      present(claimDailyChest(state, now, cfg))
      return
    }
    if (hit.kind === 'reward') {
      present(takeReward(state))
      resolveGuides(state, cfg)
      return
    }
    if (hit.kind === 'rush' || hit.kind === 'adRush') {
      const picked = selected
      if (!picked) return
      const lock = state.locks.find((entry) => entry.row === picked.row && entry.col === picked.col)
      const mode = atStep(state, cfg, 'giftRush') ? 'free' : hit.kind === 'adRush' ? 'ad' : 'gem'
      if (lock?.cover === 'gift' && !state.board[picked.row]?.[picked.col]) present(rushGift(state, picked, cfg, mode))
      else present(rushProducer(state, picked, cfg, mode))
      return
    }
    if (hit.kind === 'pending') return
    if (hit.kind === 'order' || hit.kind === 'orderStrip' || hit.kind === 'orderIcon') return
    if (hit.kind === 'cell') {
      orderFocus = null
      clearSale(state)
      const lock = state.locks.find((entry) => entry.row === hit.row && entry.col === hit.col)
      if (lock?.cover === 'gift' && !state.board[hit.row][hit.col]) {
        state.armed = null
        state.chainPop = null
        selected = { row: hit.row, col: hit.col }
        present(pokeGift(state, hit, cfg, now))
        return
      }
      if (lock && !state.board[hit.row][hit.col]) {
        state.armed = null
        state.chainPop = null
        if (state.phase === 'opening') return
        if (lock.buried.kind === 'coin' || lock.buried.kind === 'gem') {
          present(collectLock(state, hit))
          return
        }
        selected = { row: hit.row, col: hit.col }
        return
      }
      const item = state.board[hit.row]?.[hit.col]
      if (!item) {
        selected = null
        state.armed = null
        state.chainPop = null
        return
      }
      if (item.kind === 'potion' || item.kind === 'gem') {
        const result = tapConsumable(state, hit, cfg, now)
        if (result.reason === 'arm') {
          selected = { row: hit.row, col: hit.col }
          return
        }
        selected = null
        present(result)
        return
      }
      state.armed = null
      state.chainPop = null
      const already = selected?.row === hit.row && selected?.col === hit.col
      selected = { row: hit.row, col: hit.col }
      if (!already) {
        if (state.mintStep === 'select' && item.kind === 'producer' && item.producerId === 'bev') state.mintStep = 'produce'
        return
      }
      if (item.kind === 'producer') {
        present(tapProducer(state, hit, cfg, rng, now))
      } else if (item.kind === 'product' && cfg.items.lines.some((line) => line.id === item.line && line.collect)) {
        const result = collectBoardProduct(state, hit, cfg)
        if (result.ok) selected = null
        present(result)
      } else if (item.kind === 'rewardBox') present(openRewardBox(state, hit, cfg, rng))
      else if (item.kind === 'chest') {
        const seen = new Set(occupied(state).map((cell) => cell.item.uid))
        const result = openChest(state, hit, cfg, rng)
        present(result)
        for (const cell of occupied(state)) {
          if (cell.item.kind === 'potion' && !seen.has(cell.item.uid)) {
            fx.pops.push({ row: cell.row, col: cell.col, birth: animAt(now), dur: cfg.economy.animMs })
          }
        }
      } else if (!tutorialAllowsInspect(state)) {
        return
      } else {
        selected = { row: hit.row, col: hit.col }
      }
    }
  }

  function zoomAt(sx: number, sy: number, factor: number): void {
    const cx = frame.map.x + frame.map.w / 2
    const cy = frame.map.y + frame.map.h / 2
    const worldX = cam.x + (sx - cx) / cam.scale
    const worldY = cam.y + (sy - cy) / cam.scale
    cam.scale = clamp(cam.scale * factor, 0.35, 2.6)
    cam.x = worldX - (sx - cx) / cam.scale
    cam.y = worldY - (sy - cy) / cam.scale
  }

  function noteGuide(now: number): void {
    const key = guideLockKey(state)
    if (key === guideKey) return
    guideKey = key
    guideSince = now
    guideMisses = 0
  }

  function tutorialBlocks(hit: Hit): boolean {
    if (activeOverlay(state) === 'mint' && state.mintStep && state.mintStep !== 'off' && state.mintStep !== 'talk' && state.mintStep !== 'wait') {
      if (state.mintStep === 'select' || state.mintStep === 'produce') {
        if (hit.kind !== 'cell') return true
        const item = state.board[hit.row]?.[hit.col]
        return !(item?.kind === 'producer' && item.producerId === 'bev' && item.level >= 5)
      }
      if (state.mintStep === 'merge') {
        if (hit.kind !== 'cell') return true
        const item = state.board[hit.row]?.[hit.col]
        return !(item?.kind === 'product' && item.line === 'mint')
      }
      if (state.mintStep === 'deliver') return hit.kind !== 'complete'
    }
    if (state.phase !== 'opening') return false
    if (hit.kind === 'skip') return false
    const step = currentTutorial(cfg, state)
    if (!step || step.type === '对话') return false
    const onCell = (row: number, col: number) => hit.kind === 'cell' && hit.row === row && hit.col === col
    if (step.id === 'merge') {
      const a = cfg.board.roles.mergeA
      const b = cfg.board.roles.mergeB
      return !(onCell(a.row, a.col) || onCell(b.row, b.col))
    }
    if (step.id === 'mergeC' || step.id === 'unlock') {
      if (hit.kind !== 'cell') return true
      const item = state.board[hit.row]?.[hit.col]
      const target = cfg.board.roles.unlock
      return !(item?.kind === 'producer' || onCell(target.row, target.col))
    }
    if (step.id === 'mergeD') {
      if (hit.kind !== 'cell') return true
      const item = state.board[hit.row]?.[hit.col]
      const target = cfg.board.roles.mergeD
      return !(item?.kind === 'producer' || (target && onCell(target.row, target.col)))
    }
    return true
  }

  function onDown(x: number, y: number, id: number): void {
    sfx.unlock()
    lastInput = platform.now()
    if (guideSpot(state, cfg) === 'reward') orderScroll = 0
    frame = makeFrame()
    if (view === 'house' && state.decorate) {
      const popup = decorPopupRects(frame)
      if (contains(popup.ok, x, y)) {
        present(confirmDecor(state, cfg))
        return
      }
      const swatch = popup.swatches.findIndex((rect) => contains(rect, x, y))
      if (swatch >= 0) {
        previewDecor(state, swatch)
        mark()
        return
      }
    }
    if (state.buildStory) {
      if (hitTest(frame, x, y)?.kind === 'skip') state.buildStory = null
      else advanceBuildStory(state, cfg)
      mark()
      return
    }
    const overlay = activeOverlay(state)
    if (overlay === 'level') {
      if (contains(levelClaimRect(frame), x, y)) present(claimLevelModal(state, cfg, rng))
      return
    }
    if (overlay === 'smile') {
      if (contains(smileDismissRect(frame), x, y)) state.smileModal = null
      return
    }
    if (overlay === 'detail') {
      const hit = hitTest(frame, x, y)
      if (hit?.kind === 'detailClose') {
        dismissDetail(state)
        mark()
      }
      return
    }
    if (overlay === 'talk') {
      if (contains(talkRect(frame).ok, x, y)) {
        if (state.notice) dismissNotice(state)
        else advanceGuide(state, cfg)
        mark()
      }
      return
    }
    if (!overlay && state.smiles >= cfg.economy.smileGoal && contains(frame.smileSlot, x, y)) {
      present(openSmilePrize(state, cfg, rng))
      return
    }
    if (chain) {
      if (!contains(chainCardRect(frame), x, y) || contains(chainCloseRect(frame), x, y)) chain = null
      return
    }
    const step = currentTutorial(cfg, state)
    let hit = hitTest(frame, x, y) ?? { kind: 'swallow' as const }
    const hole = state.phase === 'opening' ? null : guideHole(frame, state, cfg)
    noteGuide(platform.now())
    if (guideIsLocking(state, cfg)) {
      const aimed =
        hit.kind === 'tune' ||
        (state.phase === 'opening' && hit.kind === 'skip') ||
        (hole ? contains(hole, x, y) : !tutorialBlocks(hit))
      if (!aimed) {
        guideMisses += 1
        if (guideMisses >= 3 || platform.now() - guideSince > 8000) {
          dismissStuckGuide(state, cfg)
          mark()
          hit = hitTest(frame, x, y) ?? { kind: 'swallow' as const }
        } else if (hole && !contains(hole, x, y)) {
          return
        } else if (tutorialBlocks(hit)) {
          return
        }
      }
    } else if (!overlay && hole && hit.kind !== 'tune' && !contains(hole, x, y)) {
      return
    }
    if (state.phase === 'story') {
      if (hit.kind === 'skip') {
        skipStory(state)
        sfx.ui()
        mark()
      } else if (hit.kind === 'hotspot') {
        advanceStory(state, cfg)
        sfx.ui()
        mark()
      }
      return
    }
    if (view === 'board' && state.phase === 'play' && state.storageLesson === 1) {
      if (hit.kind === 'skip') state.storageLesson = 4
      else if (hit.kind !== 'tune') state.storageLesson = 2
      mark()
      return
    }
    if (view === 'board' && state.phase === 'play' && state.storageLesson > 1 && state.storageLesson < 4 && hit.kind === 'skip') {
      state.storageLesson = 4
      mark()
      return
    }
    if (view === 'board' && state.phase === 'play' && (state.storageLesson === 2 || state.storageLesson === 3)) {
      if (hit.kind !== 'cell' && hit.kind !== 'pending' && hit.kind !== 'skip') return
    }
    if (step?.type === '对话' && hit.kind !== 'skip') {
      advanceDialogue(state, cfg)
      sfx.ui()
      mark()
      return
    }
    if (tutorialBlocks(hit)) return
    pointers.set(id, { id, x, y, sx: x, sy: y, hit, moved: false, camX: cam.x, camY: cam.y, scroll: tunerScroll, orderScroll, downAt: platform.now() })
    if (pointers.size >= 2 && view === 'house') {
      fx.drag = null
      dragId = -1
      const pts = [...pointers.values()]
      pinch = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, scale: cam.scale }
    }
  }

  function onMove(x: number, y: number, id: number): void {
    const pointer = pointers.get(id)
    if (!pointer) return
    pointer.x = x
    pointer.y = y
    if (!pointer.moved && Math.hypot(x - pointer.sx, y - pointer.sy) > 8) pointer.moved = true
    if (pinch && pointers.size >= 2 && view === 'house') {
      const pts = [...pointers.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1
      cam.scale = clamp(pinch.scale * (dist / pinch.dist), 0.35, 2.6)
      return
    }
    const hit = pointer.hit
    if (hit.kind === 'slider' && tuner) {
      const spec = SLIDERS[hit.index]
      const row = frame.sliders.find((entry) => entry.index === hit.index)
      if (spec && row) {
        spec.set(cfg, sliderValue(spec, row.trackX, row.trackW, x))
        reconcileLevel(state, cfg, rng)
        mark()
      }
      return
    }
    if (pointer.hit.kind === 'tunerScroll' && pointer.moved) {
      tunerScroll = clamp(pointer.scroll - (y - pointer.sy), 0, frame.tunerMaxScroll)
      return
    }
    if (pointer.hit.kind === 'map' && pointer.moved && view === 'house') {
      cam.x = pointer.camX - (x - pointer.sx) / cam.scale
      cam.y = pointer.camY - (y - pointer.sy) / cam.scale
      return
    }
    if (
      pointer.moved &&
      (pointer.hit.kind === 'order' || pointer.hit.kind === 'orderStrip' || pointer.hit.kind === 'orderIcon' || pointer.hit.kind === 'complete')
    ) {
      orderScroll = scrollOrders(pointer.orderScroll, x - pointer.sx, frame.orderMaxScroll)
      return
    }
    if (pointer.moved && pointer.hit.kind === 'pending' && dragId < 0 && state.pending.length) {
      fx.drag = { row: -1, col: -1, x, y, pending: true, index: storageTakeIndex(state, cfg) }
      dragId = id
    }
    if (pointer.moved && pointer.hit.kind === 'cell' && dragId < 0 && frame.mode === 'board' && !tuner && !modal) {
      const item = state.board[pointer.hit.row]?.[pointer.hit.col]
      if (item) {
        state.armed = null
        state.chainPop = null
        fx.drag = { row: pointer.hit.row, col: pointer.hit.col, x, y }
        dragId = id
      }
    }
    if (fx.drag && dragId === id) {
      fx.drag.x = x
      fx.drag.y = y
      updateHover(x, y)
    }
  }

  function onUp(x: number, y: number, id: number): void {
    const pointer = pointers.get(id)
    pointers.delete(id)
    if (pointers.size < 2) pinch = null
    if (!pointer) return
    if (fx.drag && dragId === id) {
      finishDrag(x, y)
      dragId = -1
      return
    }
    const strip =
      pointer.hit.kind === 'order' ||
      pointer.hit.kind === 'orderStrip' ||
      pointer.hit.kind === 'orderIcon' ||
      pointer.hit.kind === 'complete'
    if (strip) {
      const action = orderStripAction({
        moved: pointer.moved,
        dx: x - pointer.sx,
        onComplete: pointer.hit.kind === 'complete',
        onIcon: pointer.hit.kind === 'orderIcon',
      })
      if (action === 'complete' && pointer.hit.kind === 'complete') activate(pointer.hit)
      if (action === 'icon' && pointer.hit.kind === 'orderIcon' && state.phase === 'play') {
        const order = state.orders[pointer.hit.order]
        const slot = order?.slots[pointer.hit.slot]
        if (slot) {
          selected = null
          orderFocus = { line: slot.line, level: slot.level }
        }
      }
      return
    }
    if (!pointer.moved) {
      if (state.chainPop && frame.mode === 'board') {
        const pop = chainPopRect(frame)
        if (contains(pop.close, x, y) || contains(pop.card, x, y)) {
          if (contains(pop.close, x, y)) {
            state.chainPop = null
            state.armed = null
          }
          return
        }
      }
      if (view === 'house' && state.decorate) {
        const popup = decorPopupRects(frame)
        if (contains(popup.ok, x, y)) {
          present(confirmDecor(state, cfg))
          return
        }
        const swatch = popup.swatches.findIndex((rect) => contains(rect, x, y))
        if (swatch >= 0) {
          previewDecor(state, swatch)
          mark()
          return
        }
        if (pointer.hit.kind !== 'back') return
      }
      const held = platform.now() - pointer.downAt
      if (held > 480 && view === 'house' && pointer.hit.kind === 'map') {
        const taskId = partAt(frame, cam, x, y)
        if (taskId && reopenDecor(state, cfg, taskId)) {
          sfx.ui()
          mark()
          return
        }
      }
      activate(pointer.hit)
    } else if (pointer.hit.kind === 'slider') saveNow()
  }

  platform.onPointer(onDown, onMove, onUp)
  platform.onWheel((x, y, dy) => {
    if (tuner) {
      frame = makeFrame()
      tunerScroll = clamp(tunerScroll + dy * 0.45, 0, frame.tunerMaxScroll)
      return
    }
    if (view === 'house' && contains(frame.map, x, y)) zoomAt(x, y, dy > 0 ? 0.92 : 1.08)
  })
  platform.onKey((key) => {
    if (key === 'Escape') {
      if (tuner) tuner = false
      else if (modal) modal = null
      else if (state.showHelp) {
        state.showHelp = false
        mark()
      } else if (view === 'house') view = 'board'
      return
    }
    if ((key === 't' || key === 'T') && !modal) tuner = !tuner
  })
  platform.onHide(() => {
    beatVisit(state, platform.now())
    saveNow()
  })
  platform.onShow(() => {
    startVisit(state, platform.now())
    syncEnergy(state, platform.now(), cfg)
  })
  platform.bindResize(() => {
    frame = makeFrame()
  })

  let lastPlay = platform.now()
  const tick = () => {
    const real = platform.now()
    settleGifts(state, cfg, real)
    arrangeOrders(state, real)
    resolveGuides(state, cfg)
    noteGuide(real)
    if (guideIsLocking(state, cfg) && real - guideSince > 8000) {
      dismissStuckGuide(state, cfg)
      mark()
    }
    if (guideSpot(state, cfg) === 'reward') orderScroll = 0
    refreshGuide(state, cfg, view)
    pumpMint(state)
    if (atStep(state, cfg, 'giftRush')) {
      const gift = cfg.board.roles.gift
      selected = { row: gift.row, col: gift.col }
    }
    const playDt = Math.min(1000, Math.max(0, real - lastPlay))
    lastPlay = real
    state.playedMs += playDt
    syncEnergy(state, real, cfg)
    refreshProducers(state, real, cfg)
    beatVisit(state, real)
    fx.incoming = Math.min(fx.incoming, Math.max(0, state.coins))
    const anim = animAt(real)
    const dt = Math.min(0.05, Math.max(0, (anim - lastAnim) / 1000))
    lastAnim = anim
    if (dt > 0) {
      for (const particle of fx.particles) {
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
        particle.vy += 420 * dt
      }
    }
    fx.particles = fx.particles.filter((particle) => anim - particle.birth < particle.life)
    for (const coin of fx.coins) {
      if (coin.done) continue
      if (anim - coin.birth - coin.delay >= coin.dur) {
        coin.done = true
        const cut = Math.min(coin.value, fx.incoming)
        fx.incoming = Math.max(0, fx.incoming - cut)
        if (cut > 0) fx.coinPunch = anim
      }
    }
    fx.coins = fx.coins.filter((coin) => !coin.done)
    if (fx.coins.length === 0 && fx.incoming <= 0) fx.ghostOrder = null
    fx.flyers = fx.flyers.filter((flyer) => anim - flyer.birth < flyer.dur)
    fx.pops = fx.pops.filter((pop) => anim - pop.birth < pop.dur)
    fx.floaters = fx.floaters.filter((floater) => anim - floater.birth < floater.dur)
    fx.toasts = fx.toasts.filter((entry) => real - entry.birth < entry.dur)
    if (fx.banner && real > fx.banner.until) fx.banner = null
    frame = makeFrame()
    if (view === 'house') ensureCam()
    const ctx = platform.canvas.getContext('2d')
    if (ctx) {
      const dpr = platform.dpr || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      render({
        ctx,
        frame,
        state,
        cfg,
        realNow: real,
        animNow: anim,
        fx,
        cam,
        modal,
        hintText: '',
        selected,
        orderFocus,
        chain,
        showHand:
          state.phase === 'play' &&
          !state.levelModal &&
          !state.smileModal &&
          !tuner &&
          real - lastInput > cfg.economy.idleHintMs,
      })
    }
    if (dirty && real - lastSave > 500) saveNow()
    platform.raf(tick)
  }
  lastAnim = animAt(platform.now())
  platform.raf(tick)

  const debug = {
    get state() {
      return state
    },
    setView(next: 'board' | 'house') {
      view = next
      frame = makeFrame()
    },
    select(row: number, col: number) {
      selected = { row, col }
    },
    drop(from: Pos, to: Pos) {
      return dropItem(state, from, to, cfg)
    },
    produce(row: number, col: number) {
      return tapProducer(state, { row, col }, cfg, Math.random, platform.now())
    },
    get cfg() {
      return cfg
    },
    get frame() {
      return frame
    },
    get view() {
      return view
    },
    get fx() {
      return fx
    },
    cellCenter(row: number, col: number) {
      return cellCenter(frame, row, col)
    },
    orders() {
      return frame.orders
    },
    hand(now?: number) {
      return tutorialHand(cfg, state, frame, now ?? Date.now())
    },
    hotspot() {
      return frame.hotspot
    },
    skip() {
      return frame.skip.w > 0 ? frame.skip : frame.sheetSkip
    },
    buttons() {
      return {
        house: frame.houseBtn,
        back: frame.backBtn,
        build: frame.buildBtn,
        sheet: frame.sheetBtn,
        tune: frame.tuneBtn,
        pending: frame.pendingBtn,
      }
    },
  }
  ;(globalThis as { __JIANGNAN__?: typeof debug }).__JIANGNAN__ = debug
}

export type { Fx, Sfx, GameState }
