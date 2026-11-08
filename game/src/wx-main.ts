import { startGame } from './app'
import { createWxPlatform } from './platform/wx'

startGame(createWxPlatform())
