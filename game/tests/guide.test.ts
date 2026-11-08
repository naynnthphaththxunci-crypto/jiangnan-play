import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../src/config'
import { contains, guideHole, hitTest, layout, type LayoutInput } from '../src/layout'
import type { GameState } from '../src/types'
import {
  advanceGuide,
  createGame,
  currentTutorial,
  findEmpty,
  guideSpot,
  hydrate,
  makePotion,
  makeProducer,
  makeProduct,
  makeRewardBox,
  mulberry32,
  openRewardBox,
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
  it('手指和点击用同一个矩形', () => {
    const cfg = defaultConfig()
    const board = frame({ showRush: true })
    const state = createGame(1, cfg)
    state.phase = 'play'
    state.locks = []
    state.rewards = [makeRewardBox(state, cfg, mulberry32(1), 'blue')]
    state.chestLesson = 1
    expect(guideHole(board, state, cfg)).toBe(board.rewardTray)
    expect(hitTest(board, board.rewardTray.x + 2, board.rewardTray.y + 2)?.kind).toBe('reward')

    expect(takeReward(state).ok).toBe(true)
    const cell = state.chestCell!
    expect(guideHole(board, state, cfg)).toEqual(board && { x: board.board.x + cell.col * board.board.cell, y: board.board.y + cell.row * board.board.cell, w: board.board.cell, h: board.board.cell })
    const chestHit = hitTest(board, board.board.x + cell.col * board.board.cell + 2, board.board.y + cell.row * board.board.cell + 2)
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
    expect(hitTest(house, house.buildBtn.x + 2, house.buildBtn.y + 2)?.kind).toBe('build')
    state.guide = 'backBtn'
    expect(guideHole(house, state, cfg)).toBe(house.backBtn)
    expect(hitTest(house, house.backBtn.x + 2, house.backBtn.y + 2)?.kind).toBe('back')

    state.guide = 'none'
    state.phase = 'opening'
    state.openingStep = stepOf('giftRush')
    const gift = cfg.board.roles.gift
    const giftLock = state.locks.find((lock) => lock.row === gift.row && lock.col === gift.col)
    if (giftLock) {
      giftLock.cover = 'gift'
      giftLock.giftUntil = 9_000
    }
    const rush = frame({ showRush: true })
    expect(guideHole(rush, state, cfg)).toBe(rush.rushBtn)
    expect(contains(rush.rushBtn, rush.rushBtn.x + rush.rushBtn.w / 2, rush.rushBtn.y + rush.rushBtn.h / 2)).toBe(true)
    expect(hitTest(rush, rush.rushBtn.x + 2, rush.rushBtn.y + 2)?.kind).toBe('rush')
  })

  it('宝箱引导：正常、只剩一格、棋盘满、刷新', () => {
    const cfg = defaultConfig()
    const normal = createGame(1, cfg)
    normal.phase = 'play'
    normal.locks = []
    normal.rewards = [makeProduct(normal, 'food', 2), makeRewardBox(normal, cfg, mulberry32(1), 'blue')]
    normal.chestLesson = 1
    resolveGuides(normal, cfg)
    expect(normal.rewards[0]?.kind).toBe('rewardBox')
    expect(takeReward(normal).ok).toBe(true)
    expect(normal.chestLesson).toBe(2)
    expect(openRewardBox(normal, normal.chestCell!, cfg, mulberry32(1)).ok).toBe(true)
    expect(normal.chestLesson).toBe(3)

    const few = createGame(2, cfg)
    few.phase = 'play'
    few.locks = []
    fill(few, 1)
    few.rewards = [makeRewardBox(few, cfg, mulberry32(2), 'blue')]
    few.chestLesson = 1
    expect(takeReward(few).ok).toBe(true)
    expect(few.chestLesson).toBe(2)
    fill(few, 0)
    expect(openRewardBox(few, few.chestCell!, cfg, mulberry32(2)).ok).toBe(true)
    expect(few.chestLesson).toBe(3)

    const full = createGame(3, cfg)
    full.phase = 'play'
    fill(full, 0)
    full.rewards = [makeRewardBox(full, cfg, mulberry32(3), 'blue')]
    full.chestLesson = 1
    expect(takeReward(full).reason).toBe('full')
    expect(full.chestLesson).toBe(3)
    expect(full.rewards.some((item) => item.kind === 'rewardBox')).toBe(true)
    expect(guideSpot(full, cfg)).toBeNull()

    const stuck = hydrate(serialize(full, cfg), defaultConfig())
    expect(stuck?.chestLesson).toBe(3)
    const mid = createGame(4, cfg)
    mid.phase = 'play'
    mid.locks = []
    mid.rewards = [makeRewardBox(mid, cfg, mulberry32(4), 'blue')]
    mid.chestLesson = 1
    const resumed = hydrate(serialize(mid, cfg), defaultConfig())
    expect(resumed?.chestLesson).toBe(1)
    expect(guideSpot(resumed!, defaultConfig())).toBe('reward')
    expect(takeReward(resumed!).ok).toBe(true)
  })

  it('新母棋引导：正常、只剩一格、棋盘满、刷新', () => {
    const cfg = defaultConfig()
    const normal = createGame(1, cfg)
    const spot = cfg.board.roles.producer
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
    const fewProducer = few.board[cfg.board.roles.producer.row]?.[cfg.board.roles.producer.col]
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
    expect(build.guide).toBe('repairBtn')
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
    expect(back.guide).toBe('backTalk')
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
    expect(guideSpot(state, cfg)).toBe('rush')
    fill(state, 1)
    expect(guideSpot(state, cfg)).toBe('rush')
    fill(state, 0)
    expect(rushGift(state, gift, cfg, 'free').ok).toBe(true)
    expect(currentTutorial(cfg, state)?.id).not.toBe('giftRush')

    const cooled = createGame(2, cfg)
    cooled.phase = 'play'
    const producer = cfg.board.roles.producer
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
    making.openingStep = stepOf('produce')
    fill(making, 1)
    expect(currentTutorial(cfg, making)?.id).toBe('produce')
    fill(making, 0)
    expect(resolveGuides(making, cfg)).toContain('produce')
    expect(currentTutorial(cfg, making)?.id).not.toBe('produce')
    const makingSave = createGame(11, cfg)
    makingSave.phase = 'opening'
    makingSave.openingStep = stepOf('produce')
    fill(makingSave, 0)
    const loaded = hydrate(serialize(makingSave, cfg), defaultConfig())
    expect(currentTutorial(defaultConfig(), loaded!)?.id).not.toBe('produce')
  })
})
