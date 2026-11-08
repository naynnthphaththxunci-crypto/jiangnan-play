import { startGame } from './app'
import { runBoot } from './boot'
import { createWebPlatform } from './platform/web'

const canvas = document.querySelector('#game')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('找不到画布')
const platform = createWebPlatform(canvas)
void runBoot(canvas).then((dismiss) => {
  startGame(platform)
  requestAnimationFrame(() => requestAnimationFrame(dismiss))
})
