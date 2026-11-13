import type { AudioContextLike } from './platform/types'

// 全部用振荡器现写，不载入采样。见 AUDIO_CREDITS.md。
export interface Sfx {
  unlock(): void
  merge(): void
  spawn(): void
  land(when: number): void
  coinStart(): void
  coinTick(when: number): void
  error(): void
  build(): void
  ui(): void
  now(): number
}

export function createSfx(getCtx: () => AudioContextLike | null): Sfx {
  let ctx: AudioContextLike | null = null
  const ensure = () => {
    if (!ctx) ctx = getCtx()
    if (ctx?.state === 'suspended') {
      try {
        const pending = ctx.resume?.()
        if (pending && typeof (pending as Promise<void>).catch === 'function') void (pending as Promise<void>).catch(() => {})
      } catch {
        /* 静音继续玩 */
      }
    }
    return ctx
  }

  const tone = (
    when: number,
    from: number,
    to: number,
    dur: number,
    type: 'sine' | 'triangle' | 'square',
    gain: number,
  ) => {
    const ac = ensure()
    if (!ac) return
    try {
      const osc = ac.createOscillator()
      const amp = ac.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(Math.max(40, from), when)
      if (Math.abs(to - from) > 1) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), when + dur)
      }
      amp.gain.setValueAtTime(gain, when)
      amp.gain.exponentialRampToValueAtTime(0.0001, when + dur)
      osc.connect(amp)
      amp.connect(ac.destination)
      osc.start(when)
      osc.stop(when + dur + 0.02)
    } catch {
      /* 个别环境没有 WebAudio */
    }
  }

  return {
    unlock() {
      ensure()
    },
    now() {
      return ensure()?.currentTime ?? 0
    },
    merge() {
      const t = this.now()
      tone(t, 740, 1240, 0.18, 'sine', 0.16)
      tone(t + 0.01, 1110, 1660, 0.16, 'triangle', 0.06)
    },
    spawn() {
      const t = this.now()
      tone(t, 420, 680, 0.12, 'sine', 0.1)
    },
    land(when: number) {
      tone(when, 560, 380, 0.07, 'sine', 0.07)
    },
    coinStart() {
      const t = this.now()
      tone(t, 980, 1320, 0.09, 'sine', 0.1)
      tone(t + 0.06, 1320, 1680, 0.1, 'sine', 0.07)
    },
    coinTick(when: number) {
      tone(when, 1680, 1880, 0.045, 'sine', 0.06)
    },
    error() {
      const t = this.now()
      tone(t, 240, 140, 0.16, 'sine', 0.1)
    },
    build() {
      const t = this.now()
      tone(t, 523, 523, 0.09, 'sine', 0.08)
      tone(t + 0.08, 659, 659, 0.09, 'sine', 0.08)
      tone(t + 0.16, 784, 784, 0.14, 'sine', 0.08)
    },
    ui() {
      tone(this.now(), 620, 860, 0.05, 'sine', 0.05)
    },
  }
}
