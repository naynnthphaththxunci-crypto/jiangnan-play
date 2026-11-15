import { describe, expect, it } from 'vitest'
import { guestClip, guestFrameAt } from '../src/guestClips'

describe('客人序列帧时间轴', () => {
  it('鲍大叔 15 槽来回，第 1 张在接缝连着两槽', () => {
    const clip = guestClip('fisherman')
    expect(clip?.sequence).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1])
    expect(clip?.durations).toEqual([140, 140, 160, 140, 140, 140, 140, 140, 140, 140, 160, 160, 160, 140, 140])
    expect(guestFrameAt('fisherman', 0)?.image).toBe(1)
    expect(guestFrameAt('fisherman', 140 + 140 + 159)?.image).toBe(3)
    expect(guestFrameAt('fisherman', 1000)?.image).toBe(8)
    expect(guestFrameAt('fisherman', 2179)?.image).toBe(1)
    expect(guestFrameAt('fisherman', 2180)?.image).toBe(1)
  })

  it('阿桨 18 槽来回，每槽 200 毫秒', () => {
    const clip = guestClip('boatman')
    expect(clip?.sequence).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 9, 8, 7, 6, 5, 4, 3, 2])
    expect(clip?.durations).toEqual(Array.from({ length: 18 }, () => 200))
    expect(guestFrameAt('boatman', 0)?.image).toBe(1)
    expect(guestFrameAt('boatman', 1800)?.image).toBe(10)
    expect(guestFrameAt('boatman', 2000)?.image).toBe(9)
    expect(guestFrameAt('boatman', 3600)?.image).toBe(1)
  })

  it('金老爷、柳砚、暹罗猫按顺序播完再循环', () => {
    expect(guestClip('squire')?.sequence).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
    expect(guestClip('squire')?.durations.every((ms) => ms === 80)).toBe(true)
    expect(guestFrameAt('squire', 80 * 12)?.image).toBe(13)
    expect(guestFrameAt('squire', 80 * 25)?.image).toBe(1)

    expect(guestClip('scholar')?.sequence).toHaveLength(23)
    expect(guestClip('scholar')?.durations.every((ms) => ms === 130)).toBe(true)
    expect(guestFrameAt('scholar', 130 * 11)?.image).toBe(12)
    expect(guestFrameAt('scholar', 130 * 23)?.image).toBe(1)

    expect(guestClip('siamese')?.sequence).toHaveLength(20)
    expect(guestClip('siamese')?.durations.every((ms) => ms === 110)).toBe(true)
    expect(guestFrameAt('siamese', 110 * 10)?.image).toBe(11)
    expect(guestFrameAt('siamese', 110 * 20)?.image).toBe(1)
  })

  it('陆老伯不再有序列帧', () => {
    expect(guestClip('teaGuest')).toBeNull()
  })
})