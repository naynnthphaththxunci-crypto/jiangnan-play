import src from './assets/ui/order_tray.png'
import rewardSrc from './assets/ui/order_reward.png'

let image: HTMLImageElement | null = null
let reward: HTMLImageElement | null = null

function load(current: HTMLImageElement | null, srcUrl: string): HTMLImageElement | null {
  const host = globalThis as { Image?: new () => HTMLImageElement; document?: Document }
  if (!host.document || typeof host.Image !== 'function') return null
  if (!current) {
    current = new host.Image()
    current.src = srcUrl
  }
  return current
}

export function orderTrayImage(): HTMLImageElement | null {
  image = load(image, src)
  return image
}

export function orderRewardImage(): HTMLImageElement | null {
  reward = load(reward, rewardSrc)
  return reward
}
