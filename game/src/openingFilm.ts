import v01 from './assets/opening/01.mp4'
import v02 from './assets/opening/02.mp4'
import v03 from './assets/opening/03.mp4'
import v04 from './assets/opening/04.mp4'
import tenseUrl from './assets/opening/tense.mp3'
import labelUrl from './assets/opening/label_jinmen.webp'
import handUrl from './assets/opening/hand.webp'
import dlg1 from './assets/opening/dlg_01.webp'
import dlg2 from './assets/opening/dlg_02.webp'
import dlg3 from './assets/opening/dlg_03.webp'
import dlg4 from './assets/opening/dlg_04.webp'
import tapUrl from './assets/opening/tap_text.webp'
import restartUrl from './assets/opening/btn_restart.webp'
import handRestartUrl from './assets/opening/hand_restart.webp'
import type { GameConfig } from './types'
import {
  BTN_RESTART,
  DLG_RUYUE,
  DLG_ZHAO,
  HAND_DOOR,
  HAND_RESTART,
  LABEL_JINMEN,
  TAP_TEXT,
  doorHotspot,
  filmFit,
  hitBox,
  openingHandPose,
  placeFilm,
  toFilm,
  type FilmBox,
  type FilmFit,
} from './openingLayout'

type Stage = 'intro' | 'door' | 'talk' | 'rain' | 'restart'

const DOOR_AT = 3
const TAP_FADE_MS = 280

function loadImage(src: string): HTMLImageElement | null {
  const Ctor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof Ctor !== 'function') return null
  const img = new Ctor()
  img.src = src
  return img
}

function makeVideo(src: string, loop: boolean): HTMLVideoElement | null {
  if (typeof document === 'undefined') return null
  const video = document.createElement('video')
  video.src = src
  video.loop = loop
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  video.setAttribute('muted', '')
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none'
  document.body.appendChild(video)
  video.load()
  return video
}

class OpeningFilm {
  private stage: Stage = 'intro'
  private dialog = 0
  private doorAt = 0
  private dimAt = 0
  private tapFadeAt = 0
  private restartAt = 0
  private tenseFadeAt = 0
  private started = false
  private soundOn = false
  private v1: HTMLVideoElement | null = null
  private v2: HTMLVideoElement | null = null
  private v3: HTMLVideoElement | null = null
  private v4: HTMLVideoElement | null = null
  private shown: HTMLVideoElement | null = null
  private pending: HTMLVideoElement | null = null
  private tense: HTMLAudioElement | null = null
  private tenseWanted = false
  private kicking = false
  private view = { w: 390, h: 844 }
  private readonly images = {
    label: loadImage(labelUrl),
    hand: loadImage(handUrl),
    dlg: [loadImage(dlg1), loadImage(dlg2), loadImage(dlg3), loadImage(dlg4)],
    tap: loadImage(tapUrl),
    restart: loadImage(restartUrl),
    handRestart: loadImage(handRestartUrl),
  }

  /** 先静音开播，浏览器允许时立刻开声；不行就等第一次触摸。 */
  ensure(now: number): void {
    if (this.started || typeof document === 'undefined') return
    this.started = true
    this.v1 = makeVideo(v01, false)
    this.v2 = makeVideo(v02, true)
    this.v3 = makeVideo(v03, true)
    this.v4 = makeVideo(v04, true)
    this.tense = new Audio(tenseUrl)
    this.tense.loop = true
    this.tense.preload = 'auto'
    this.shown = this.v1
    this.v1?.addEventListener('ended', () => {
      if (this.stage === 'door' || this.stage === 'intro') this.cue(this.v2)
    })
    void this.kick(this.v1, true)
    this.doorAt = now
  }

  /** 第一次触摸后再把 01、紧张底乐和 04 的声音打开。开声失败就保持静音，下次触摸再试。 */
  unlockSound(): void {
    if (this.soundOn) return
    const clip = this.stage === 'rain' || this.stage === 'restart' ? this.v4 : this.v1
    void this.unmute(clip)
    if (this.tenseWanted && this.tense && this.tenseFadeAt === 0) void this.unmuteAudio(this.tense)
  }

  status(): {
    stage: Stage
    dialog: number
    clip: string
    time: number
    paused: boolean
    muted: boolean
    soundOn: boolean
    art: boolean
  } {
    const clip = this.shown === this.v1 ? '01' : this.shown === this.v2 ? '02' : this.shown === this.v3 ? '03' : this.shown === this.v4 ? '04' : ''
    const art = [this.images.label, this.images.hand, this.images.tap, this.images.restart, ...this.images.dlg]
    return {
      stage: this.stage,
      dialog: this.dialog,
      clip,
      time: this.v1?.currentTime ?? 0,
      paused: this.v1?.paused ?? true,
      muted: this.shown?.muted ?? true,
      soundOn: this.soundOn,
      art: art.every((img) => (img?.naturalWidth ?? 0) > 0),
    }
  }

  tap(x: number, y: number, now: number, cfg: GameConfig): 'none' | 'enter' {
    this.unlockSound()
    if (this.stage === 'intro') return 'none'
    if (this.stage === 'door') {
      if (this.inDesign(x, y, doorHotspot(cfg.economy.openingHitPad ?? 160))) this.enterTalk(now)
      return 'none'
    }
    if (this.stage === 'talk') {
      if (this.dialog >= 3) this.enterRain(now)
      else this.dialog += 1
      return 'none'
    }
    if (this.stage === 'rain') {
      if (this.tapFadeAt === 0) this.tapFadeAt = now
      return 'none'
    }
    if (this.stage === 'restart' && this.inDesign(x, y, BTN_RESTART)) return 'enter'
    return 'none'
  }

  stop(): void {
    for (const video of [this.v1, this.v2, this.v3, this.v4]) video?.pause()
    if (this.tense) {
      this.tense.pause()
      this.tense.currentTime = 0
    }
    this.tenseWanted = false
  }

  draw(ctx: CanvasRenderingContext2D, viewW: number, viewH: number, now: number, cfg: GameConfig): void {
    this.view = { w: viewW, h: viewH }
    this.ensure(now)
    this.advance(now, cfg)
    const fit = filmFit(viewW, viewH)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, viewW, viewH)
    this.paintVideo(ctx, fit)
    if (this.stage === 'talk') {
      const ms = Math.max(1, cfg.economy.openingDimMs ?? 600)
      const alpha = Math.max(0, Math.min(0.6, ((now - this.dimAt) / ms) * 0.6))
      ctx.fillStyle = `rgba(0,0,0,${alpha})`
      ctx.fillRect(0, 0, viewW, viewH)
      this.paintImage(ctx, fit, this.images.dlg[this.dialog] ?? null, this.dialog % 2 === 0 ? DLG_RUYUE : DLG_ZHAO, 1)
      this.paintImage(ctx, fit, this.images.tap, TAP_TEXT, 1)
      return
    }
    if (this.stage === 'rain' || this.stage === 'restart') {
      const fade = this.tapFadeAt === 0 ? 1 : Math.max(0, 1 - (now - this.tapFadeAt) / TAP_FADE_MS)
      if (fade > 0.02) this.paintImage(ctx, fit, this.images.tap, TAP_TEXT, fade)
      if (this.stage === 'restart') {
        this.paintImage(ctx, fit, this.images.restart, BTN_RESTART, 1)
        this.paintHand(ctx, fit, this.images.handRestart, HAND_RESTART, now, this.restartAt)
      }
      return
    }
    if (this.stage === 'door') {
      const fade = Math.max(0, Math.min(1, (now - this.doorAt) / 280))
      this.paintImage(ctx, fit, this.images.label, LABEL_JINMEN, fade)
      this.paintHand(ctx, fit, this.images.hand, HAND_DOOR, now, this.doorAt)
    }
  }

  private advance(now: number, _cfg: GameConfig): void {
    const intro = this.v1
    if ((this.stage === 'intro' || this.stage === 'door') && intro && intro.paused && !intro.ended) void this.kick(intro, true)
    if (this.stage === 'intro' && intro && intro.currentTime >= DOOR_AT) this.enterDoor(now)
    if ((this.stage === 'intro' || this.stage === 'door') && intro?.ended) this.cue(this.v2)
    if (this.stage === 'rain' && this.tapFadeAt > 0 && now - this.tapFadeAt >= TAP_FADE_MS) {
      this.stage = 'restart'
      this.restartAt = now
    }
    this.fadeTense(now)
    if (this.pending && this.pending.readyState >= 2 && (this.pending.currentTime > 0.02 || this.pending.loop)) {
      if (this.shown && this.shown !== this.pending) this.shown.pause()
      this.shown = this.pending
      this.pending = null
    }
  }

  private enterDoor(now: number): void {
    this.stage = 'door'
    this.doorAt = now
    this.tenseWanted = true
    if (this.tense) {
      this.tense.volume = 1
      this.tense.muted = !this.soundOn
      void this.tense.play().catch(() => undefined)
    }
  }

  private enterTalk(now: number): void {
    this.stage = 'talk'
    this.dialog = 0
    this.dimAt = now
    this.v1?.pause()
    this.v2?.pause()
    this.cue(this.v3)
  }

  private enterRain(now: number): void {
    this.stage = 'rain'
    this.tenseFadeAt = now
    this.v3?.pause()
    if (this.v4) {
      try {
        this.v4.currentTime = 0
      } catch {
        /* 还没载入时忽略 */
      }
      void this.kick(this.v4, this.soundOn)
      this.cue(this.v4)
    }
  }

  private fadeTense(now: number): void {
    if (!this.tense || this.tenseFadeAt === 0) return
    const t = (now - this.tenseFadeAt) / 350
    this.tense.volume = Math.max(0, 1 - t)
    if (t >= 1) {
      this.tense.pause()
      this.tenseFadeAt = 0
      this.tenseWanted = false
    }
  }

  private cue(next: HTMLVideoElement | null): void {
    if (!next || next === this.shown || next === this.pending) return
    if (next.ended) {
      try {
        next.currentTime = 0
      } catch {
        /* 还没载入时忽略 */
      }
    }
    void next.play().catch(() => undefined)
    this.pending = next
  }

  /** 先静音把画面播起来。withSound 为真时再试着开声，被拦就保持静音。 */
  private async kick(video: HTMLVideoElement | null, withSound: boolean): Promise<void> {
    if (!video || this.kicking) return
    this.kicking = true
    try {
      if (video.paused) {
        video.muted = true
        try {
          await video.play()
        } catch {
          return
        }
      }
    } finally {
      this.kicking = false
    }
    if (withSound) await this.unmute(video)
  }

  private async unmute(video: HTMLVideoElement | null): Promise<void> {
    if (!video) return
    if (video.paused) {
      video.muted = true
      try {
        await video.play()
      } catch {
        return
      }
    }
    video.muted = false
    try {
      await video.play()
      this.soundOn = true
    } catch {
      video.muted = true
    }
  }

  private async unmuteAudio(audio: HTMLAudioElement): Promise<void> {
    audio.muted = false
    try {
      await audio.play()
      this.soundOn = true
    } catch {
      audio.muted = true
    }
  }

  private paintVideo(ctx: CanvasRenderingContext2D, fit: FilmFit): void {
    const video = this.shown
    if (!video || video.readyState < 2) return
    ctx.drawImage(video, fit.x, fit.y, fit.w, fit.h)
  }

  private paintImage(
    ctx: CanvasRenderingContext2D,
    fit: FilmFit,
    img: HTMLImageElement | null,
    box: FilmBox,
    alpha: number,
  ): void {
    if (!img || alpha <= 0 || (img.naturalWidth || 0) <= 0) return
    const dest = placeFilm(fit, box)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(img, dest.x, dest.y, dest.w, dest.h)
    ctx.restore()
  }

  private paintHand(
    ctx: CanvasRenderingContext2D,
    fit: FilmFit,
    img: HTMLImageElement | null,
    box: FilmBox,
    now: number,
    startedAt: number,
  ): void {
    if (!img || (img.naturalWidth || 0) <= 0) return
    const pose = openingHandPose(now, startedAt)
    const dest = placeFilm(fit, box)
    const cx = dest.x + dest.w / 2
    const cy = dest.y + dest.h / 2
    ctx.save()
    ctx.translate(cx, cy + pose.dy * fit.scale)
    ctx.scale(pose.scale, pose.scale)
    ctx.drawImage(img, -dest.w / 2, -dest.h / 2, dest.w, dest.h)
    ctx.restore()
  }

  private inDesign(x: number, y: number, box: FilmBox): boolean {
    const view = this.viewSize()
    const fit = filmFit(view.w, view.h)
    const point = toFilm(fit, x, y)
    return hitBox(box, point.x, point.y)
  }

  private viewSize(): { w: number; h: number } {
    return this.view
  }
}

let film: OpeningFilm | null = null

export function openingFilm(): OpeningFilm {
  if (!film) film = new OpeningFilm()
  return film
}

export function resetOpeningFilm(): void {
  film?.stop()
  film = null
}
