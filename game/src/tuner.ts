import economySeed from './data/economy.json'
import type { GameConfig } from './types'

export interface SliderSpec {
  id: string
  label: string
  min: number
  max: number
  step: number
  get(cfg: GameConfig): number
  set(cfg: GameConfig, value: number): void
  text(value: number): string
}

function setThreshold(index: number): (cfg: GameConfig, value: number) => void {
  return (cfg, value) => {
    const next = cfg.economy.levelTaskThresholds.slice()
    next[index] = Math.round(value)
    for (let i = 1; i < next.length; i++) {
      if (next[i] <= next[i - 1]) next[i] = next[i - 1] + 1
    }
    for (let i = next.length - 2; i >= 0; i--) {
      if (next[i] >= next[i + 1]) next[i] = next[i + 1] - 1
    }
    cfg.economy.levelTaskThresholds = next
  }
}

export const SLIDERS: SliderSpec[] = [
  {
    id: 'anim',
    label: '动画时长',
    min: 120,
    max: 900,
    step: 10,
    get: (c) => c.economy.animMs,
    set: (c, v) => {
      c.economy.animMs = v
    },
    text: (v) => `${Math.round(v)} 毫秒`,
  },
  {
    id: 'hit',
    label: '卡帧',
    min: 0,
    max: 180,
    step: 5,
    get: (c) => c.economy.hitStopMs,
    set: (c, v) => {
      c.economy.hitStopMs = v
    },
    text: (v) => `${Math.round(v)} 毫秒`,
  },
  {
    id: 'snap',
    label: '吸附强度',
    min: 0,
    max: 100,
    step: 1,
    get: (c) => c.economy.snapStrength * 100,
    set: (c, v) => {
      c.economy.snapStrength = v / 100
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'regen',
    label: '体力恢复',
    min: 5,
    max: 300,
    step: 5,
    get: (c) => c.economy.energyRegenMs / 1000,
    set: (c, v) => {
      c.economy.energyRegenMs = Math.round(v * 1000)
    },
    text: (v) => `${Math.round(v)} 秒/点`,
  },
  {
    id: 'cap',
    label: '体力上限',
    min: 20,
    max: 200,
    step: 5,
    get: (c) => c.economy.energyMax,
    set: (c, v) => {
      c.economy.energyMax = v
    },
    text: (v) => `${Math.round(v)}`,
  },
    {
    id: 'reward',
    label: '订单报酬',
    min: 0.2,
    max: 3,
    step: 0.1,
    get: (c) => c.economy.orderRewardScale,
    set: (c, v) => {
      c.economy.orderRewardScale = Math.round(v * 10) / 10
    },
    text: (v) => `${v.toFixed(1)} 倍`,
  },
  {
    id: 'price',
    label: '修缮价格',
    min: 0.2,
    max: 3,
    step: 0.1,
    get: (c) => c.economy.buildPriceScale,
    set: (c, v) => {
      c.economy.buildPriceScale = Math.round(v * 10) / 10
    },
    text: (v) => `${v.toFixed(1)} 倍`,
  },
  {
    id: 'xp',
    label: '每件经验',
    min: 5,
    max: 40,
    step: 1,
    get: (c) => c.economy.xpPerTask,
    set: (c, v) => {
      c.economy.xpPerTask = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'lv2',
    label: '二级门槛',
    min: 1,
    max: 8,
    step: 1,
    get: (c) => c.economy.levelTaskThresholds[0] ?? 2,
    set: setThreshold(0),
    text: (v) => `${Math.round(v)} 件`,
  },
  {
    id: 'lv3',
    label: '三级门槛',
    min: 2,
    max: 12,
    step: 1,
    get: (c) => c.economy.levelTaskThresholds[1] ?? 5,
    set: setThreshold(1),
    text: (v) => `${Math.round(v)} 件`,
  },
  {
    id: 'lv4',
    label: '四级门槛',
    min: 3,
    max: 16,
    step: 1,
    get: (c) => c.economy.levelTaskThresholds[2] ?? 9,
    set: setThreshold(2),
    text: (v) => `${Math.round(v)} 件`,
  },
  {
    id: 'lv5',
    label: '五级门槛',
    min: 4,
    max: 20,
    step: 1,
    get: (c) => c.economy.levelTaskThresholds[3] ?? 12,
    set: setThreshold(3),
    text: (v) => `${Math.round(v)} 件`,
  },
  {
    id: 'lv6',
    label: '六级门槛',
    min: 4,
    max: 24,
    step: 1,
    get: (c) => c.economy.levelTaskThresholds[4] ?? 10,
    set: setThreshold(4),
    text: (v) => `${Math.round(v)} 件`,
  },
  {
    id: 'lv7',
    label: '七级门槛',
    min: 4,
    max: 24,
    step: 1,
    get: (c) => c.economy.levelTaskThresholds[5] ?? 11,
    set: setThreshold(5),
    text: (v) => `${Math.round(v)} 件`,
  },
  {
    id: 'lv8',
    label: '八级门槛',
    min: 4,
    max: 24,
    step: 1,
    get: (c) => c.economy.levelTaskThresholds[6] ?? 12,
    set: setThreshold(6),
    text: (v) => `${Math.round(v)} 件`,
  },
  {
    id: 'earlyUntil',
    label: '前期订单到',
    min: 1,
    max: 8,
    step: 1,
    get: (c) => c.economy.earlyOrderUntil,
    set: (c, v) => {
      c.economy.earlyOrderUntil = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 级`,
  },
  {
    id: 'earlyA',
    label: 'A型订单',
    min: 0,
    max: 100,
    step: 5,
    get: (c) => c.economy.earlyOrderAChance * 100,
    set: (c, v) => {
      c.economy.earlyOrderAChance = v / 100
    },
    text: (v) => `${Math.round(v)}%`,
  },
  {
    id: 'earlyALv',
    label: 'A型等级',
    min: 3,
    max: 6,
    step: 1,
    get: (c) => c.economy.earlyOrderALevel,
    set: (c, v) => {
      c.economy.earlyOrderALevel = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 级`,
  },
  {
    id: 'smileCount',
    label: '笑脸赠棋',
    min: 5,
    max: 30,
    step: 1,
    get: (c) => c.economy.smilePrizeCount,
    set: (c, v) => {
      c.economy.smilePrizeCount = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 个`,
  },
  {
    id: 'giftRush',
    label: '礼物加速',
    min: 0,
    max: 10,
    step: 1,
    get: (c) => c.economy.giftRushGems,
    set: (c, v) => {
      c.economy.giftRushGems = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 钻`,
  },
  {
    id: 'guideLv',
    label: '建造引导到',
    min: 1,
    max: 8,
    step: 1,
    get: (c) => c.economy.guideUntilLevel,
    set: (c, v) => {
      c.economy.guideUntilLevel = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 级前`,
  },
  {
    id: 'guideShows',
    label: '引导次数',
    min: 0,
    max: 8,
    step: 1,
    get: (c) => c.economy.guideShows,
    set: (c, v) => {
      c.economy.guideShows = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 次`,
  },
  {
    id: 'chainWeight',
    label: '新母棋订单',
    min: 1,
    max: 8,
    step: 1,
    get: (c) => c.economy.newChainWeight,
    set: (c, v) => {
      c.economy.newChainWeight = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 倍`,
  },
  {
    id: 'w2',
    label: '五点瓶',
    min: 0,
    max: 100,
    step: 1,
    get: (c) => c.economy.chestWeights[0]?.weight ?? 0,
    set: (c, v) => {
      if (c.economy.chestWeights[0]) c.economy.chestWeights[0].weight = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'w6',
    label: '十点瓶',
    min: 0,
    max: 100,
    step: 1,
    get: (c) => c.economy.chestWeights[1]?.weight ?? 0,
    set: (c, v) => {
      if (c.economy.chestWeights[1]) c.economy.chestWeights[1].weight = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'w15',
    label: '二十点瓶',
    min: 0,
    max: 100,
    step: 1,
    get: (c) => c.economy.chestWeights[2]?.weight ?? 0,
    set: (c, v) => {
      if (c.economy.chestWeights[2]) c.economy.chestWeights[2].weight = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'w40',
    label: '四十点瓶',
    min: 0,
    max: 100,
    step: 1,
    get: (c) => c.economy.chestWeights[3]?.weight ?? 0,
    set: (c, v) => {
      if (c.economy.chestWeights[3]) c.economy.chestWeights[3].weight = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'idle',
    label: '软提示空闲',
    min: 1,
    max: 20,
    step: 1,
    get: (c) => c.economy.idleHintMs / 1000,
    set: (c, v) => {
      c.economy.idleHintMs = Math.round(v * 1000)
    },
    text: (v) => `${Math.round(v)} 秒`,
  },
  {
    id: 'lockPulse',
    label: '锁格闪烁',
    min: 0,
    max: 1,
    step: 0.05,
    get: (c) => c.economy.lockPulse,
    set: (c, v) => {
      c.economy.lockPulse = Math.round(v * 100) / 100
    },
    text: (v) => v.toFixed(2),
  },
  {
    id: 'ajiangFps',
    label: '阿桨帧率',
    min: 4,
    max: 24,
    step: 1,
    get: (c) => c.economy.ajiangFps ?? 12,
    set: (c, v) => {
      c.economy.ajiangFps = v
    },
    text: (v) => `${Math.round(v)} fps`,
  },
  {
    id: 'ajiangIntroStart',
    label: '阿桨出场起帧',
    min: 0,
    max: 28,
    step: 1,
    get: (c) => c.economy.ajiangIntroStart ?? 0,
    set: (c, v) => {
      c.economy.ajiangIntroStart = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'ajiangIntroEnd',
    label: '阿桨出场止帧',
    min: 0,
    max: 28,
    step: 1,
    get: (c) => c.economy.ajiangIntroEnd ?? 28,
    set: (c, v) => {
      c.economy.ajiangIntroEnd = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'ajiangLoopStart',
    label: '阿桨循环起帧',
    min: 0,
    max: 28,
    step: 1,
    get: (c) => c.economy.ajiangLoopStart ?? 20,
    set: (c, v) => {
      c.economy.ajiangLoopStart = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'baoZero',
    label: '0秒帧时长',
    min: 16,
    max: 70,
    step: 1,
    get: (c) => c.economy.baoZeroFrameMs ?? 33,
    set: (c, v) => {
      c.economy.baoZeroFrameMs = v
    },
    text: (v) => `${Math.round(v)} 毫秒`,
  },
  {
    id: 'testGuests',
    label: '测试：指定订单客人',
    min: 0,
    max: 1,
    step: 1,
    get: (c) => c.economy.testOrderGuests ?? 0,
    set: (c, v) => {
      c.economy.testOrderGuests = v >= 1 ? 1 : 0
    },
    text: (v) => (v >= 1 ? '阿桨 + 鲍大叔' : '关'),
  },
  {
    id: 'ajiangLoopEnd',
    label: '阿桨循环止帧',
    min: 0,
    max: 28,
    step: 1,
    get: (c) => c.economy.ajiangLoopEnd ?? 28,
    set: (c, v) => {
      c.economy.ajiangLoopEnd = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'guestCanvas',
    label: '客人画布比例',
    min: 0.2,
    max: 0.45,
    step: 0.01,
    get: (c) => c.economy.guestCanvasScale ?? 0.29,
    set: (c, v) => {
      c.economy.guestCanvasScale = Math.round(v * 100) / 100
    },
    text: (v) => v.toFixed(2),
  },
  {
    id: 'speed4Level',
    label: 'x4解锁等级',
    min: 1,
    max: 40,
    step: 1,
    get: (c) => c.economy.speed4Level ?? 20,
    set: (c, v) => {
      c.economy.speed4Level = v
    },
    text: (v) => `${Math.round(v)} 级`,
  },
  {
    id: 'smileGoal',
    label: '笑脸开奖',
    min: 4,
    max: 20,
    step: 1,
    get: (c) => c.economy.smileGoal,
    set: (c, v) => {
      c.economy.smileGoal = v
    },
    text: (v) => `${Math.round(v)} 个`,
  },
  {
    id: 'smileWait',
    label: '笑脸出现',
    min: 0,
    max: 600,
    step: 10,
    get: (c) => Math.min(600, c.economy.smileUiAfterMs / 1000),
    set: (c, v) => {
      c.economy.smileUiAfterMs = Math.round(v * 1000)
    },
    text: (v) => `${Math.round(v)} 秒`,
  },
  {
    id: 'adMax',
    label: '广告每日',
    min: 0,
    max: 10,
    step: 1,
    get: (c) => c.economy.adDailyMax,
    set: (c, v) => {
      c.economy.adDailyMax = v
    },
    text: (v) => `${Math.round(v)} 次`,
  },
  {
    id: 'orderXp',
    label: '交单经验',
    min: 0,
    max: 40,
    step: 1,
    get: (c) => c.economy.orderXp,
    set: (c, v) => {
      c.economy.orderXp = v
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'chestTimes',
    label: '宝箱单倍率',
    min: 1,
    max: 5,
    step: 0.5,
    get: (c) => c.economy.chestRewardTimes,
    set: (c, v) => {
      c.economy.chestRewardTimes = v
    },
    text: (v) => `${v.toFixed(1)} 倍`,
  },
  {
    id: 'chestBonus',
    label: '宝箱单赠棋',
    min: 0,
    max: 12,
    step: 1,
    get: (c) => c.economy.chestBonusItems,
    set: (c, v) => {
      c.economy.chestBonusItems = v
    },
    text: (v) => `${Math.round(v)} 个`,
  },
  {
    id: 'storageCap',
    label: '暂存容量',
    min: 1,
    max: 24,
    step: 1,
    get: (c) => c.economy.storageCapacity,
    set: (c, v) => {
      c.economy.storageCapacity = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 格`,
  },
  ...[1, 2, 3, 4, 5].map((tier) => ({
    id: `potion${tier}`,
    label: `${tier}级体力`,
    min: 1,
    max: 200,
    step: 1,
    get: (c: GameConfig) => c.items.potions.find((potion) => potion.tier === tier)?.energy ?? 0,
    set: (c: GameConfig, v: number) => {
      const potion = c.items.potions.find((entry) => entry.tier === tier)
      if (potion) potion.energy = Math.round(v)
    },
    text: (v: number) => `${Math.round(v)}`,
  })),
  ...[1, 2, 3, 4].map((tier) => ({
    id: `gem${tier}`,
    label: `${tier}级钻石`,
    min: 1,
    max: 50,
    step: 1,
    get: (c: GameConfig) => c.items.gems.find((gem) => gem.tier === tier)?.amount ?? 0,
    set: (c: GameConfig, v: number) => {
      const gem = c.items.gems.find((entry) => entry.tier === tier)
      if (gem) gem.amount = Math.round(v)
    },
    text: (v: number) => `${Math.round(v)}`,
  })),
  ...[0, 1, 2, 3, 4].map((index) => ({
    id: `gemPrice${index}`,
    label: index === 4 ? '钻石价封顶' : `第${index + 1}次钻价`,
    min: 0,
    max: 200,
    step: 1,
    get: (c: GameConfig) => c.economy.energyGemPrices[index] ?? 0,
    set: (c: GameConfig, v: number) => {
      c.economy.energyGemPrices[index] = Math.round(v)
    },
    text: (v: number) => `${Math.round(v)} 钻`,
  })),
  {
    id: 'gemEnergy',
    label: '钻石换体力',
    min: 10,
    max: 200,
    step: 5,
    get: (c) => c.economy.energyGemAmount,
    set: (c, v) => {
      c.economy.energyGemAmount = Math.round(v)
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'roundBase',
    label: '4级一轮体力',
    min: 40,
    max: 400,
    step: 10,
    get: (c) => c.economy.producerRoundBase,
    set: (c, v) => {
      c.economy.producerRoundBase = Math.round(v)
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'roundStep',
    label: '每级多体力',
    min: 0,
    max: 80,
    step: 5,
    get: (c) => c.economy.producerRoundStep,
    set: (c, v) => {
      c.economy.producerRoundStep = Math.round(v)
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'roundCool',
    label: '母棋冷却',
    min: 10,
    max: 300,
    step: 10,
    get: (c) => c.economy.producerRoundCooldownMs / 1000,
    set: (c, v) => {
      c.economy.producerRoundCooldownMs = Math.round(v * 1000)
    },
    text: (v) => `${Math.round(v)} 秒`,
  },
  {
    id: 'mainChance',
    label: '主子棋概率',
    min: 0,
    max: 100,
    step: 5,
    get: (c) => c.economy.producerMainChance * 100,
    set: (c, v) => {
      c.economy.producerMainChance = v / 100
    },
    text: (v) => `${Math.round(v)}%`,
  },
  {
    id: 'sideLevel',
    label: '副子棋等级',
    min: 4,
    max: 10,
    step: 1,
    get: (c) => c.economy.producerSideLevel,
    set: (c, v) => {
      c.economy.producerSideLevel = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 级`,
  },
  {
    id: 'plantCool',
    label: '花盆冷却',
    min: 1,
    max: 120,
    step: 1,
    get: (c) => c.economy.plantCooldownMs / 60000,
    set: (c, v) => {
      c.economy.plantCooldownMs = Math.round(v * 60000)
    },
    text: (v) => `${Math.round(v)} 分钟`,
  },
  {
    id: 'plantBurst',
    label: '花盆一次出',
    min: 1,
    max: 12,
    step: 1,
    get: (c) => c.economy.plantBurst,
    set: (c, v) => {
      c.economy.plantBurst = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 个`,
  },
  {
    id: 'consumeTaps',
    label: '消耗母棋次数',
    min: 1,
    max: 12,
    step: 1,
    get: (c) => c.economy.consumableTaps,
    set: (c, v) => {
      c.economy.consumableTaps = Math.round(v)
    },
    text: (v) => `${Math.round(v)} 次`,
  },
  {
    id: 'shopEnergy',
    label: '每日体力礼包',
    min: 10,
    max: 200,
    step: 10,
    get: (c) => c.economy.shopDailyEnergy,
    set: (c, v) => {
      c.economy.shopDailyEnergy = Math.round(v)
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'coinMax',
    label: '满级金币',
    min: 10,
    max: 200,
    step: 5,
    get: (c) => c.items.lines.find((line) => line.id === 'coin')?.levels.at(-1)?.coins ?? 50,
    set: (c, v) => {
      const level = c.items.lines.find((line) => line.id === 'coin')?.levels.at(-1)
      if (level) level.coins = Math.round(v)
    },
    text: (v) => `${Math.round(v)}`,
  },
  {
    id: 'gemMax',
    label: '满级钻石',
    min: 5,
    max: 50,
    step: 1,
    get: (c) => c.items.lines.find((line) => line.id === 'gemline')?.levels.at(-1)?.coins ?? 15,
    set: (c, v) => {
      const level = c.items.lines.find((line) => line.id === 'gemline')?.levels.at(-1)
      if (level) level.coins = Math.round(v)
    },
    text: (v) => `${Math.round(v)}`,
  },

  ...([1, 2, 4, 8] as const).flatMap((mult) => {
    const tier = (c: GameConfig) => c.economy.spawnTable.find((entry) => entry.mult === mult)
    const cost: SliderSpec = {
      id: `multCost${mult}`,
      label: `${mult}倍体力`,
      min: 1,
      max: 20,
      step: 1,
      get: (c) => tier(c)?.cost ?? mult,
      set: (c, v) => {
        const row = tier(c)
        if (row) row.cost = Math.round(v)
      },
      text: (v) => `${Math.round(v)}`,
    }
    const seeded = economySeed.spawnTable.find((entry) => entry.mult === mult)?.weights ?? []
    const weights = seeded.map((entry, index) => ({
      id: `mult${mult}p${index}`,
      label: `${mult}倍出${entry.level}级`,
      min: 0,
      max: 100,
      step: 1,
      get: (c: GameConfig) => Math.round((tier(c)?.weights[index]?.p ?? 0) * 100),
      set: (c: GameConfig, v: number) => {
        const row = tier(c)?.weights[index]
        if (row) row.p = v / 100
      },
      text: (v: number) => `${Math.round(v)}%`,
    }))
    const gate: SliderSpec | null = mult === 8 ? {
      id: 'mult8on',
      label: '8倍开关',
      min: 0,
      max: 1,
      step: 1,
      get: (c) => (tier(c)?.enabled ? 1 : 0),
      set: (c, v) => {
        const row = tier(c)
        if (row) row.enabled = v >= 1
      },
      text: (v) => (v >= 1 ? '开' : '关'),
    } : null
    return gate ? [gate, cost, ...weights] : [cost, ...weights]
  }),
]

export function sliderValue(spec: SliderSpec, trackX: number, trackW: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - trackX) / Math.max(1, trackW)))
  const raw = spec.min + t * (spec.max - spec.min)
  const steps = Math.round((raw - spec.min) / spec.step)
  const value = Math.round((spec.min + steps * spec.step) * 1000) / 1000
  return Math.min(spec.max, Math.max(spec.min, value))
}
