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

  it('有出场段时先播完，再在循环段里转', () => {
    const sheet = {
      ...staticSheet('ajiang', 'frame.webp'),
      frames: 29,
      fps: 12,
      introStart: 0,
      introEnd: 28,
      loopStart: 20,
      loopEnd: 28,
    }
    const frameMs = 1000 / 12
    expect(spriteFrameIndex(sheet, 0, 0)).toBe(0)
    expect(spriteFrameIndex(sheet, frameMs * 5, 0)).toBe(5)
    expect(spriteFrameIndex(sheet, frameMs * 29, 0)).toBe(20)
    expect(spriteFrameIndex(sheet, frameMs * 29 + frameMs * 9, 0)).toBe(20)
  })

  it('逐帧时长从第 1 帧循环，0 秒帧用调参毫秒', () => {
    const sheet = {
      ...staticSheet('bao', 'frame.webp'),
      frames: 13,
      fps: 0,
      frameDurations: [70, 0, 0, 0, 0, 0, 0, 70, 70, 70, 70, 70, 70],
      zeroFrameMs: 33,
    }
    expect(spriteFrameIndex(sheet, 0, 0)).toBe(0)
    expect(spriteFrameIndex(sheet, 70, 0)).toBe(1)
    expect(spriteFrameIndex(sheet, 70 + 33 * 3, 0)).toBe(4)
    expect(spriteFrameIndex(sheet, 70 + 33 * 6, 0)).toBe(7)
    const loop = 70 + 33 * 6 + 70 * 6
    expect(spriteFrameIndex(sheet, loop, 0)).toBe(0)
    expect(spriteFrameIndex(sheet, loop + 71, 0)).toBe(1)
  })
})