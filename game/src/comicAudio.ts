import tenseUrl from './assets/audio/bed-tense.mp3'
import gentleUrl from './assets/audio/bed-gentle.mp3'
import rainUrl from './assets/audio/bed-rain.mp3'
import cricketsUrl from './assets/audio/sfx-crickets.mp3'
import hmmUrl from './assets/audio/sfx-hmm.mp3'
import snoreUrl from './assets/audio/sfx-snore.mp3'
import hmphUrl from './assets/audio/sfx-hmph.mp3'
import tearUrl from './assets/audio/sfx-tear.mp3'
import { comicBed, comicCue, type ComicBed, type ComicCue } from './comic'
import type { OpeningScript } from './types'

const FILES: Record<string, string> = {
  tense: tenseUrl,
  gentle: gentleUrl,
  rain: rainUrl,
  crickets: cricketsUrl,
  hmm: hmmUrl,
  snore: snoreUrl,
  hmph: hmphUrl,
  tear: tearUrl,
}

const LEVEL: Record<string, number> = {
  tense: 0.42,
  gentle: 0.38,
  rain: 0.28,
  crickets: 0.16,
  hmm: 0.85,
  snore: 0.62,
  hmph: 0.8,
  tear: 0.9,
}

const FADE = 0.65

interface Loop {
  gain: GainNode
  source: AudioBufferSourceNode | null
}

export interface ComicAudio {
  preload(): void
  whenReady(): Promise<void>
  sync(script: OpeningScript, step: number, active: boolean): void
  setMuted(muted: boolean): void
  trace(): string[]
}

export function createComicAudio(getCtx: () => AudioContext | null): ComicAudio {
  const raw = new Map<string, Promise<ArrayBuffer | null>>()
  const buffers = new Map<string, AudioBuffer>()
  const traceLog: string[] = []
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let muted = false
  let lastStep = -1
  let bed: ComicBed | null = null
  let active = false
  const loops = new Map<string, Loop>()
  let oneShot: AudioBufferSourceNode | null = null
  let ambience: AudioBufferSourceNode | null = null
  let inflight: Promise<void> | null = null
  let pendingCue: ComicCue | null = null
  let lastScript: OpeningScript | null = null
  let stopToken = 0

  const note = (line: string) => {
    traceLog.push(line)
    if (traceLog.length > 40) traceLog.shift()
  }

  const grab = (name: string) => {
    const url = FILES[name]
    if (!url) return Promise.resolve(null)
    let job = raw.get(name)
    if (!job) {
      job = fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .catch(() => null)
      raw.set(name, job)
    }
    return job
  }

  const ramp = (node: GainNode, to: number, seconds = FADE) => {
    if (!ctx) return
    const now = ctx.currentTime
    const from = node.gain.value
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(from, now)
    node.gain.linearRampToValueAtTime(to, now + seconds)
  }

  const ensure = () => {
    if (ctx) return ctx
    ctx = getCtx()
    if (!ctx) return null
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
    for (const name of ['tense', 'gentle', 'rain']) {
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(master)
      loops.set(name, { gain, source: null })
    }
    return ctx
  }

  const decodeAll = () => {
    if (inflight) return inflight
    const audio = ensure()
    if (!audio) return Promise.resolve()
    inflight = Promise.all(
      Object.keys(FILES).map(async (name) => {
        if (buffers.has(name)) return
        const data = await grab(name)
        if (!data || data.byteLength < 32) return
        try {
          const buf = await audio.decodeAudioData(data.slice(0))
          buffers.set(name, buf)
        } catch {
          note(`decode-fail:${name}`)
        }
      }),
    ).then(() => {
      if (active) applyBed()
      if (pendingCue && buffers.has(pendingCue) && lastScript && comicCue(lastScript, lastStep) === pendingCue) {
        const cue = pendingCue
        pendingCue = null
        playCue(cue)
      } else {
        pendingCue = null
      }
    })
    return inflight
  }

  const startLoop = (name: string) => {
    const audio = ensure()
    const loop = loops.get(name)
    const buf = buffers.get(name)
    if (!audio || !loop || !buf || loop.source) return
    const source = audio.createBufferSource()
    source.buffer = buf
    source.loop = true
    source.connect(loop.gain)
    source.start()
    loop.source = source
  }

  const applyBed = () => {
    startLoop('tense')
    startLoop('gentle')
    startLoop('rain')
    const wantTense = active && bed === 'tense' ? LEVEL.tense : 0
    const wantGentle = active && bed === 'gentle' ? LEVEL.gentle : 0
    const wantRain = active && bed === 'gentle' ? LEVEL.rain : 0
    const tense = loops.get('tense')
    const gentle = loops.get('gentle')
    const rain = loops.get('rain')
    if (tense?.source) ramp(tense.gain, wantTense)
    if (gentle?.source) ramp(gentle.gain, wantGentle)
    if (rain?.source) ramp(rain.gain, wantRain)
  }

  const playCue = (cue: ComicCue) => {
    if (muted) {
      note(`silent:${cue}`)
      return
    }
    const audio = ensure()
    const buf = buffers.get(cue)
    if (!buf) {
      pendingCue = cue
      note(`wait:${cue}`)
      return
    }
    if (!audio || !master) {
      note(`miss:${cue}`)
      return
    }
    const layered = cue === 'crickets'
    const previous = layered ? ambience : oneShot
    if (previous) {
      try {
        previous.stop()
      } catch {
        /* 已经停了 */
      }
      if (layered) ambience = null
      else oneShot = null
    }
    const source = audio.createBufferSource()
    const gain = audio.createGain()
    gain.gain.value = LEVEL[cue] ?? 0.5
    source.buffer = buf
    source.connect(gain)
    gain.connect(master)
    source.start()
    if (layered) ambience = source
    else oneShot = source
    source.onended = () => {
      if (oneShot === source) oneShot = null
      if (ambience === source) ambience = null
    }
    note(`play:${cue}`)
  }

  return {
    preload() {
      for (const name of Object.keys(FILES)) void grab(name)
    },
    whenReady() {
      return decodeAll()
    },
    setMuted(next) {
      muted = next
      const audio = ensure()
      if (audio && master) ramp(master, next ? 0 : 1, 0.12)
      note(next ? 'mute' : 'unmute')
    },
    sync(script, step, storyActive) {
      const audio = ensure()
      if (audio?.state === 'suspended') {
        const pending = audio.resume()
        if (pending && typeof pending.catch === 'function') void pending.catch(() => {})
      }
      void decodeAll()
      active = storyActive
      lastScript = script
      bed = storyActive ? comicBed(script, step) : null
      applyBed()
      if (!storyActive) {
        for (const source of [oneShot, ambience]) {
          if (!source) continue
          try {
            source.stop()
          } catch {
            /* 已经停了 */
          }
        }
        oneShot = null
        ambience = null
        if (lastStep !== -2) note('stop')
        lastStep = -2
        const token = ++stopToken
        setTimeout(() => {
          if (token !== stopToken || active) return
          for (const loop of loops.values()) {
            try {
              loop.source?.stop()
            } catch {
              /* 已经停了 */
            }
            loop.source = null
          }
        }, (FADE + 0.08) * 1000)
        return
      }
      stopToken += 1
      if (step !== lastStep) {
        const cue = comicCue(script, step)
        if (cue) playCue(cue)
        if (bed) note(`bed:${bed}`)
        lastStep = step
      }
    },
    trace() {
      return traceLog.slice()
    },
  }
}
