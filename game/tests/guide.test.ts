import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import { cellRect, contains, guideHole, hitTest, layout, type LayoutInput } from '../src/layout'
import { SIDE_ICON_LEVEL } from '../src/hechengLayout'
import type { GameState } from '../src/types'
import {
  advanceGuide,
  createGame,
  skipStory,
  currentTutorial,
  dismissStuckGuide,
  guideIsLocking,
  findEmpty,
  guideSpot,
  hydrate,
  makePotion,
  makeProducer,
  makeProduct,
  makeChest,
  mulberry32,
  openChest,
  openSmilePrize,
  pokeGift,
  refreshGuide,
  resolveGuides,
  rushGift,
  rushProducer,
  serialize,
  storeItem,
  takeFromStorage,
  takeReward,
  tapProducer,
} from '../src/logic/sim'

function fill(state: GameState, leave = 0) {
  findEmpty(state)
    .slice(leave)
    .forEach((spot) => {
      state.board[spot.row][spot.col] = makePotion(state, 1)
    })
}

function stepOf(id: string) {
  return defaultConfig().copy.tutorial.findIndex((step) => step.id === id)
}

function frame(partial: Partial<LayoutInput> = {}) {
  return layout({
    w: 390,
    h: 844,
    insetTop: 0,
    insetBottom: 0,
    mode: 'board',
    orderCount: 1,
    orderSlots: [1],
    orderScroll: 0,
    showHint: false,
    showSheet: false,
    showSkip: false,
    showDaily: false,
    showHouseBtn: true,
    showStorage: true,
    showSmile: true,
    showRush: false,
    choiceCount: 0,
    tuner: false,
    tunerScroll: 0,
    modal: false,
    help: false,
    showEnter: false,
    showInfo: true,
    ...partial,
  })
}

describe('强制引导', () => {
  it('新玩家开局奖励框是空的，绿书和任务板要到五级，宝箱高亮贴着按钮', () => {
    const cfg = defaultConfig()
    const state = createGame(1, cfg)
    skipStory(state)
    resolveGuides(state, cfg)
    expect(state.rewards).toEqual([])
    expect(state.chestLesson).toBe(0)
    expect(state.level).toBeLessThan(SIDE_ICON_LEVEL)
    expect(guideSpot(state, cfg)).toBeNull()

    const hidden = frame({ showStory: false, showTask: false, showChest: false })
    expect(hidden.storyBtn.w).toBe(0)
    expect(hidden.taskBtn.w).toBe(0)
    expect(hidden.chestBtn.w).toBe(0)
    expect(hidden.rewardTray.w).toBe(0)

    const book = frame({ showStory: true, showTask: true, showChest: false })
    expect(book.storyBtn.w).toBeGreaterThan(0)
    expect(book.taskBtn.w).toBeGreaterThan(0)
    expect(book.chestBtn.w).toBe(0)

    const onlyChest = frame({ showStory: false, showTask: false, showChest: true })
    expect(onlyChest.chestBtn.x).toBeCloseTo(book.storyBtn.x, 3)
    expect(onlyChest.chestBtn.y).toBeCloseTo(book.storyBtn.y, 3)
    expect(onlyChest.chestBtn.w).toBeCloseTo(book.storyBtn.w, 3)
    expect(onlyChest.rewardTray).toBe(onlyChest.chestBtn)
    expect(onlyChest.chestIcon.x).toBeGreaterThan(onlyChest.chestBtn.x)
    expect(onlyChest.chestIcon.y).toBeGreaterThan(onlyChest.chestBtn.y)
    expect(onlyChest.chestIcon.x + onlyChest.chestIcon.w).toBeLessThan(onlyChest.chestBtn.x + onlyChest.chestBtn.w + 1)

    state.phase = 'play'
    state.chestLesson = 1
    const chestHole = guideHole(onlyChest, state, cfg)!
    expect(chestHole.x).toBeLessThanOrEqual(onlyChest.chestBtn.x + 0.5)
    expect(chestHole.y).toBeLessThanOrEqual(onlyChest.chestBtn.y + 0.5)
    expect(chestHole.x + chestHole.w).toBeGreaterThanOrEqual(onlyChest.chestBtn.x + onlyChest.chestBtn.w - 0.5)
    expect(chestHole.y + chestHole.h).toBeGreaterThanOrEqual(onlyChest.chestBtn.y + onlyChest.chestBtn.h - 0.5)
    const spot = {
      x: onlyChest.chestBtn.x + onlyChest.chestBtn.w / 2,
      y: onlyChest.chestBtn.y + onlyChest.chestBtn.h / 2,
    }
    expect(hitTest(onlyChest, spot.x, spot.y)?.kind).toBe('reward')
    expect(hitTest(onlyChest, onlyChest.energyPlus.x + 2, onlyChest.energyPlus.y + 2)?.kind).toBe('refill')

    const both = frame({ showStory: true, showTask: true, showChest: true })
    expect(both.chestBtn.y).toBeGreaterThan(both.storyBtn.y + both.storyBtn.h * 0.6)
    const bothHole = guideHole(both, state, cfg)!
    expect(bothHole.x).toBeLessThanOrEqual(both.chestBtn.x + 0.5)
    expect(bothHole.x + bothHole.w).toBeGreaterThanOrEqual(both.chestBtn.x + both.chestBtn.w - 0.5)
    expect(both.rewardTray).toBe(both.chestBtn)
  })

  it('手指和点击用同一个矩形', () => {
    const cfg = defaultConfig()
    const board = frame({ showRush: true })
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.locks = []
    state.rewards = [makeChest(state)]
    state.chestLesson = 1
    const rewardHole = guideHole(board, state, cfg)!
    expect(rewardHole.x).toBeLessThanOrEqual(board.rewardTray.x + 0.5)
    expect(rewardHole.y).toBeLessThanOrEqual(board.rewardTray.y + 0.5)
    expect(rewardHole.x + rewardHole.w).toBeGreaterThanOrEqual(board.rewardTray.x + board.rewardTray.w - 0.5)
    expect(rewardHole.y + rewardHole.h).toBeGreaterThanOrEqual(board.rewardTray.y + board.rewardTray.h - 0.5)
    expect(hitTest(board, board.rewardTray.x + 2, board.rewardTray.y + 2)?.kind).toBe('reward')

    expect(takeReward(state).ok).toBe(true)
    const cell = state.chestCell!
    const hole = cellRect(board, cell.row, cell.col)
    expect(guideHole(board, state, cfg)).toEqual(hole)
    const chestHit = hitTest(board, hole.x + hole.w / 2, hole.y + hole.h / 2)
    expect(chestHit).toMatchObject({ kind: 'cell', row: cell.row, col: cell.col })

    state.chestLesson = 3
    state.producerLesson = 'food'
    expect(guideHole(board, state, cfg)?.w).toBe(board.board.cell)
    state.producerLesson = null
    state.guide = 'buildBtn'
    expect(guideHole(board, state, cfg)).toBe(board.houseBtn)
    expect(hitTest(board, board.houseBtn.x + 2, board.houseBtn.y + 2)?.kind).toBe('house')
    state.guide = 'smile'
    state.smiles = cfg.economy.smileGoal
    expect(guideHole(board, state, cfg)).toBe(board.smileSlot)

    const house = frame({ mode: 'house' })
    state.guide = 'repairBtn'
    expect(guideHole(house, state, cfg)).toBe(house.buildBtn)
    const build = house.houseBtn
    expect(hitTest(house, build.x + build.w / 2, build.y + build.h / 2)?.kind).toBe('back')
    state.guide = 'backBtn'
    expect(guideHole(house, state, cfg)).toBe(house.backBtn)

    state.guide = 'none'
    const rush = frame({ showRush: true })
    expect(contains(rush.rushBtn, rush.rushBtn.x + rush.rushBtn.w / 2, rush.rushBtn.y + rush.rushBtn.h / 2)).toBe(true)
    expect(hitTest(rush, rush.rushBtn.x + 2, rush.rushBtn.y + 2)?.kind).toBe('rush')
  })

  it('宝箱引导：正常、只剩一格、棋盘满、刷新', () => {
    const cfg = defaultConfig()
    const normal = createGame(1, cfg)
    normal.phase = 'play'
    normal.locks = []
    normal.rewards = [makeProduct(normal, 'food', 2), makeChest(normal)]
    normal.chestLesson = 1
    const energyBefore = normal.energy
    resolveGuides(normal, cfg)
    expect(normal.rewards[0]?.kind).toBe('chest')
    expect(takeReward(normal).ok).toBe(true)
    expect(normal.energy).toBe(energyBefore)
    expect(normal.chestLesson).toBe(2)
    expect(openChest(normal, normal.chestCell!, cfg, mulberry32(1)).ok).toBe(true)
    expect(normal.chestLesson).toBe(3)

    const few = createGame(2, cfg)
    few.phase = 'play'
    few.locks = []
    fill(few, 1)
    few.rewards = [makeChest(few)]
    few.chestLesson = 1
    expect(takeReward(few).ok).toBe(true)
    expect(few.chestLesson).toBe(2)
    fill(few, 0)
    expect(openChest(few, few.chestCell!, cfg, mulberry32(2)).reason).toBe('full')
    expect(few.chestLesson).toBe(2)
    expect(few.board[few.chestCell!.row]?.[few.chestCell!.col]?.kind).toBe('chest')

    const full = createGame(3, cfg)
    full.phase = 'play'
    fill(full, 0)
    full.rewards = [makeChest(full)]
    full.chestLesson = 1
    expect(takeReward(full).reason).toBe('full')
    expect(full.chestLesson).toBe(3)
    expect(full.rewards.some((item) => item.kind === 'chest')).toBe(true)
    expect(guideSpot(full, cfg)).toBeNull()

    const stuck = hydrate(serialize(full, cfg), defaultConfig())
    expect(stuck?.chestLesson).toBe(3)
    const mid = createGame(4, cfg)
    mid.phase = 'play'
    mid.locks = []
    mid.rewards = [makeChest(mid)]
    mid.chestLesson = 1
    const resumed = hydrate(serialize(mid, cfg), defaultConfig())
    expect(resumed?.chestLesson).toBe(1)
    expect(guideSpot(resumed!, defaultConfig())).toBe('reward')
    expect(takeReward(resumed!).ok).toBe(true)
  })

  it('新母棋引导：正常、只剩一格、棋盘满、刷新', () => {
    const cfg = defaultConfig()
    const normal = createGame(1, cfg)
    const spot = { row: 3, col: 1 }
    normal.phase = 'play'
    normal.locks = []
    const starter = normal.board[spot.row]?.[spot.col]
    if (starter?.kind === 'producer') {
      starter.level = 4
      starter.charges = 200
    }
    normal.producerLesson = 'food'
    const before = normal.energy
    expect(tapProducer(normal, spot, cfg, () => 0.9, 10).ok).toBe(true)
    expect(normal.energy).toBe(before)
    expect(normal.producerLesson).toBeNull()

    const few = createGame(2, cfg)
    few.phase = 'play'
    few.locks = []
    fill(few, 1)
    const fewProducer = few.board[spot.row]?.[spot.col]
    if (fewProducer?.kind === 'producer') {
      fewProducer.level = 4
      fewProducer.charges = 200
    }
    few.producerLesson = 'food'
    expect(guideSpot(few, cfg)).toBe('producer')
    expect(tapProducer(few, spot, cfg, () => 0.9, 10).ok).toBe(true)
    expect(few.producerLesson).toBeNull()

    const full = createGame(3, cfg)
    full.phase = 'play'
    fill(full, 0)
    full.producerLesson = 'food'
    expect(tapProducer(full, spot, cfg, () => 0.9, 10).reason).toBe('full')
    expect(full.producerLesson).toBeNull()

    const queued = createGame(5, cfg)
    queued.phase = 'play'
    queued.locks = []
    fill(queued, 1)
    queued.producerLesson = 'bamboo'
    queued.rewards = [makeProducer(queued, 'bamboo', cfg, 3)]
    const kept = hydrate(serialize(queued, cfg), defaultConfig())
    expect(kept?.producerLesson).toBe('bamboo')
    expect(guideSpot(kept!, defaultConfig())).toBe('reward')

    const queuedFull = createGame(12, cfg)
    queuedFull.phase = 'play'
    fill(queuedFull, 0)
    queuedFull.producerLesson = 'bamboo'
    queuedFull.rewards = [makeProducer(queuedFull, 'bamboo', cfg, 3)]
    expect(hydrate(serialize(queuedFull, cfg), defaultConfig())?.producerLesson).toBeNull()

    const saved = createGame(4, cfg)
    saved.phase = 'play'
    saved.locks = []
    saved.producerLesson = 'food'
    const resumed = hydrate(serialize(saved, cfg), defaultConfig())
    expect(resumed?.producerLesson).toBe('food')
    expect(guideSpot(resumed!, defaultConfig())).toBe('producer')
  })

  it('建造、返回、笑脸：满盘和刷新仍能走完', () => {
    const cfg = defaultConfig()
    const rich = () => {
      const state = createGame(1, cfg)
      state.phase = 'play'
      state.lesson = 'free'
      state.coins = 99999
      return state
    }
    const build = rich()
    build.guide = 'buildTalk'
    advanceGuide(build, cfg)
    expect(build.guide).toBe('buildBtn')
    fill(build, 1)
    expect(guideSpot(build, cfg)).toBe('build')
    fill(build, 0)
    expect(guideSpot(build, cfg)).toBe('build')
    refreshGuide(build, cfg, 'house')
    expect(build.guide).toBe('none')
    refreshGuide(build, cfg, 'board')
    expect(build.guide).toBe('none')

    const parked = rich()
    parked.guide = 'buildBtn'
    expect(hydrate(serialize(parked, cfg), defaultConfig())?.guide).toBe('buildBtn')

    const back = rich()
    back.coins = 0
    back.guide = 'backBtn'
    fill(back, 0)
    expect(guideSpot(back, cfg)).toBe('back')
    refreshGuide(back, cfg, 'board')
    expect(back.guide).toBe('none')
    advanceGuide(back, cfg)
    expect(back.guide).toBe('none')
    const backSaved = rich()
    backSaved.guide = 'backBtn'
    expect(hydrate(serialize(backSaved, cfg), defaultConfig())?.guide).toBe('backBtn')

    const smile = createGame(3, cfg)
    smile.phase = 'play'
    smile.smiles = cfg.economy.smileGoal
    smile.guide = 'smile'
    expect(openSmilePrize(smile, cfg, mulberry32(1)).ok).toBe(true)
    expect(smile.guide).toBe('none')
    const smileFull = createGame(4, cfg)
    smileFull.phase = 'play'
    fill(smileFull, 0)
    smileFull.smiles = cfg.economy.smileGoal
    smileFull.guide = 'smile'
    expect(guideSpot(smileFull, cfg)).toBe('smile')
    expect(openSmilePrize(smileFull, cfg, mulberry32(2)).ok).toBe(true)
    expect(smileFull.guide).toBe('none')
    const smileMid = createGame(5, cfg)
    smileMid.phase = 'play'
    smileMid.smiles = cfg.economy.smileGoal
    smileMid.guide = 'smile'
    expect(hydrate(serialize(smileMid, cfg), defaultConfig())?.guide).toBe('smile')
  })

  it('礼物加速、仓库和产出引导在满盘时结束或能继续', () => {
    const cfg = defaultConfig()
    const gift = cfg.board.roles.gift
    const state = createGame(1, cfg)
    state.phase = 'opening'
    state.openingStep = stepOf('giftRush')
    const planted = state.locks.find((lock) => lock.row === gift.row && lock.col === gift.col)
    if (planted) planted.cover = 'gift'
    pokeGift(state, gift, cfg, 1_000)
    const lock = state.locks.find((entry) => entry.row === gift.row && entry.col === gift.col)!
    lock.giftUntil = 1_000 + cfg.economy.giftCooldownMs
    state.openingStep = stepOf('giftRush')
    expect(pokeGift(state, gift, cfg, 2_000).reason).toBe('cooling')
    expect(state.giftPrompt).toBeNull()
    fill(state, 0)
    expect(rushGift(state, gift, cfg, 'free').ok).toBe(true)

    const cooled = createGame(2, cfg)
    cooled.phase = 'play'
    const producer = { row: 3, col: 1 }
    const item = cooled.board[producer.row]?.[producer.col]
    if (item?.kind === 'producer') {
      item.charges = 0
      item.cooldownUntil = 9_000
    }
    cooled.playedMs = cfg.economy.producerGraceMs
    cooled.gems = 0
    fill(cooled, 0)
    expect(rushProducer(cooled, producer, cfg, 'gem').reason).toBe('gems')
    expect(rushProducer(cooled, producer, cfg, 'ad').ok).toBe(true)

    const stored = createGame(6, cfg)
    stored.phase = 'play'
    stored.locks = []
    stored.level = 5
    stored.storageOpen = true
    stored.storageLesson = 2
    const flour = { row: cfg.board.roles.mergeA.row, col: cfg.board.roles.mergeA.col }
    expect(storeItem(stored, cfg, flour).ok).toBe(true)
    expect(stored.storageLesson).toBe(3)
    expect(takeFromStorage(stored, cfg, flour, 0).ok).toBe(true)
    expect(stored.storageLesson).toBe(4)

    const tight = createGame(7, cfg)
    tight.phase = 'play'
    tight.locks = []
    tight.level = 5
    tight.storageOpen = true
    tight.storageLesson = 3
    tight.pending = [makeProduct(tight, 'food', 2)]
    fill(tight, 1)
    expect(takeFromStorage(tight, cfg, findEmpty(tight)[0]!, 0).ok).toBe(true)
    expect(tight.storageLesson).toBe(4)

    const blocked = createGame(8, cfg)
    blocked.phase = 'play'
    blocked.level = 5
    blocked.storageLesson = 3
    blocked.pending = [makeProduct(blocked, 'food', 2)]
    fill(blocked, 0)
    expect(resolveGuides(blocked, cfg)).toContain('storage')
    expect(blocked.storageLesson).toBe(4)
    const blockedSave = createGame(9, cfg)
    blockedSave.phase = 'play'
    blockedSave.level = 5
    blockedSave.storageLesson = 3
    fill(blockedSave, 0)
    expect(hydrate(serialize(blockedSave, cfg), defaultConfig())?.storageLesson).toBe(4)

    const making = createGame(10, cfg)
    making.phase = 'opening'
    making.openingStep = 0
    fill(making, 0)
    expect(currentTutorial(cfg, making)?.id).toBe('merge')
    expect(resolveGuides(making, cfg)).not.toContain('produce')
    expect(currentTutorial(cfg, making)?.id).toBe('merge')
    const makingSave = createGame(11, cfg)
    makingSave.phase = 'opening'
    makingSave.storySeen = true
    makingSave.openingStep = 0
    const loaded = hydrate(serialize(makingSave, cfg), cfg)
    expect(currentTutorial(cfg, loaded!)?.id).toBe('merge')
  })

  it('对不上的开局引导和坏存档不会锁死', () => {
    const cfg = defaultConfig()
    const broken = createGame(1, cfg)
    broken.phase = 'opening'
    broken.storySeen = true
    broken.openingStep = 0
    for (const row of broken.board) {
      for (let col = 0; col < row.length; col++) {
        if (row[col]?.kind === 'producer') row[col] = null
      }
    }
    resolveGuides(broken, cfg)
    expect(broken.phase).toBe('play')
    expect(guideSpot(broken, cfg)).toBeNull()

    const saved = createGame(2, cfg)
    saved.phase = 'play'
    saved.locks = []
    saved.chestLesson = 1
    saved.rewards = []
    saved.producerLesson = 'boat'
    saved.mintStep = 'select'
    saved.guide = 'smile'
    saved.smiles = 0
    const loaded = hydrate(serialize(saved, cfg), defaultConfig())
    expect(loaded?.chestLesson).toBe(3)
    expect(loaded?.producerLesson).toBeNull()
    expect(loaded?.mintStep).toBe('off')
    expect(loaded?.guide).toBe('none')

    const stale = createGame(12, cfg)
    stale.phase = 'opening'
    stale.storySeen = true
    stale.openingStep = 9
    resolveGuides(stale, cfg)
    expect(stale.phase).toBe('play')

    const live = createGame(3, cfg)
    live.phase = 'play'
    live.chestLesson = 1
    live.rewards = [makeChest(live)]
    dismissStuckGuide(live, cfg)
    expect(live.chestLesson).toBe(3)
    expect(guideIsLocking(live, cfg)).toBe(false)
  })
})
