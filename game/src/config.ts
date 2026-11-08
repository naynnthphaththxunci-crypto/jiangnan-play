import itemsJson from './data/items.json'
import producersJson from './data/producers.json'
import ordersJson from './data/orders.json'
import buildingsJson from './data/buildings.json'
import economyJson from './data/economy.json'
import charactersJson from './data/characters.json'
import openingJson from './data/opening.json'
import boardJson from './data/board.json'
import copyJson from './data/copy.json'
import storiesJson from './data/buildStories.json'
import themeJson from './data/theme.json'
import type { GameConfig } from './types'

const RAW = {
  items: itemsJson,
  producers: producersJson.list,
  orders: ordersJson,
  buildings: buildingsJson,
  characters: charactersJson.list,
  opening: openingJson.steps,
  economy: economyJson,
  board: boardJson,
  boardTheme: themeJson,
  copy: copyJson,
  stories: storiesJson,
}

export function defaultConfig(): GameConfig {
  return JSON.parse(JSON.stringify(RAW)) as GameConfig
}

export function resetEconomy(cfg: GameConfig): void {
  const next = defaultConfig()
  cfg.economy = next.economy
}

export function hostessCostume(cfg: GameConfig): string {
  const hostess = cfg.characters.find((c) => c.id === 'ruyue')
  return hostess?.当前衣装 ?? '布衣'
}
