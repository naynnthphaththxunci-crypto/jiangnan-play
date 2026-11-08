import { startGame } from './app'
import { createWebPlatform } from './platform/web'

const canvas = document.querySelector('#game')
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('找不到画布')
startGame(createWebPlatform(canvas))
