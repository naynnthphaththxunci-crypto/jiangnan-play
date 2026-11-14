import { describe, expect, it } from 'vitest'
import { spriteFrameIndex, staticSheet } from '../src/sprite'

describe('角色序列帧接口', () => {
  it('静态原画永远停在第 0 帧，填了帧数才会往下播', () => {
    const still = staticSheet('guest', 'guest.webp')
    expect(spriteFrameIndex(still, 10_000)).toBe(0)
    const sheet = { ...still, frames: 4, columns: 4, fps: 8, frameWidth: 64, frameHeight: 64 }
    expect(spriteFrameIndex(sheet, 0)).toBe(0)
    expect(spriteFrameIndex(sheet, 125)).toBe(1)
    expect(spriteFrameIndex(sheet, 500)).toBe(0)
  })
})