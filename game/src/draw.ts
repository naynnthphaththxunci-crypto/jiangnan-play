import { hostessCostume } from './config'
import { formatDuration, formatMs } from './format'
import { easeInOut, easeOutBack, easeOutCubic, popScale, type Flyer, type Fx } from './fx'
import { hintHand, storageLessonHand, tutorialHand } from './coach'
import { cellRect, chainCardRect, chainCloseRect, chainPopRect, decorPopupRects, detailCard, guideHole, levelClaimRect, shopRects, smileDismissRect, talkRect, trackRatio, type Frame, type Rect } from './layout'
import {
  allTasks,
  atStep,
  canSell,
  cnLevel,
  currentTutorial,
  gemAmount,
  gemEnergyPrice,
  gemName,
  glowingLocks,
  INFO_EMPTY,
  activeOverlay,
  inProducerGrace,
  infoCaption,
  lineChain,
  lineColor,
  lockAt,
  potionEnergy,
  potionName,
  nextTask,
  orderMarks,
  orderPayout,
  orderSatisfied,
  slotChecked,
  pickHint,
  producerCanSpawn,
  producerCooldown,
  producerTapCostsEnergy,
  producerName,
  producerChain,
  producerOfLine,
  producerOutputs,
  productName,
  sellPriceOf,
  smilesVisible,
  taskPrice,
} from './logic/sim'
import { itemSprite, PIECE_FILL, potionSprite, producerBoltPlace, producerPieceName, producerPlace, producerSprite, PRODUCER_CELL_W, spriteContent, type ArtBox } from './itemArt'
import tutorialHandUrl from './assets/ui/tutorial_hand.png'
import iconBoltUrl from './assets/ui/stamina_bolt.webp'
import { firstOrderGuestPortrait, guestPortrait, portraitReady } from './portraits'
import { drawAvatar, drawCharacter } from './cast'
import { hechengImage, speedArtId } from './hechengArt'
import { selectBreathScale, selectFrameRect } from './selectFrame'
import { curtainBambooPlace, curtainBitmaps, curtainDrop, curtainPlace } from './curtain'
import { arrowPoke, homePlaces, type HomeBox } from './homeLayout'
import { homeArt, type HomeArtId } from './homeArt'
import { designToScreen } from './hechengLayout'
import { orderTickPlace } from './orderTick'
import { COMIC_FONT, comicCursor, comicFontReady, comicPanelImage, comicPrompt, comicSilaImage, wrapComicText } from './comic'
import { openingFilm } from './openingFilm'
import { SLIDERS } from './tuner'
import { COLS, ROWS, type ComicEnter, type GameConfig, type GameState, type Item, type OpeningScript } from './types'

export const FONT = '"WenQuanYi Micro Hei", "Noto Sans CJK SC", "Droid Sans Fallback", sans-serif'

const PAL = {
  paper: '#f4ead8',
  paperDeep: '#e7d7bc',
  cell: '#fbf6ec',
  ink: '#2a2118',
  soft: '#6f6254',
  line: '#e0d2ba',
  coin: '#b8432f',
  energy: '#2c7a58',
  gold: '#b8892c',
  white: '#fffaf3',
  danger: '#9c2f2f',
  potion: '#2f6ea8',
  chest: '#8a552c',
}

export interface RenderModel {
  ctx: CanvasRenderingContext2D
  frame: Frame
  state: GameState
  cfg: GameConfig
  realNow: number
  animNow: number
  fx: Fx
  cam: { x: number; y: number; scale: number }
  modal: 'energy' | null
  hintText: string
  selected: { row: number; col: number } | null
  /** 这次选中开始的时间。呼吸从这里算两个来回。 */
  selectedAt: number
  orderFocus: { line: string; level: number } | null
  showHand: boolean
  chain: { line: string; level: number; source: 'order' | 'producer' } | null
  comicHand: 'first' | 'idle' | 'off'
  /** 合成页和建造页之间的竹帘。progress 0 在屏幕外，1 盖满并停住。 */
  curtain: { progress: number } | null
  /** 调参里「全部恢复默认」正在等第二次确认。 */
  confirmReset?: boolean
  settingsOpen?: boolean
  settingsAt?: number
}

export function render(model: RenderModel): void {
  const { ctx, frame } = model
  ctx.clearRect(0, 0, frame.w, frame.h)
  ctx.fillStyle = frame.mode === 'board' ? '#000' : PAL.paper
  ctx.fillRect(0, 0, frame.w, frame.h)
  if (frame.mode === 'story') {
    drawStory(model)
    return
  }
  if (frame.mode === 'house') {
    drawHouse(model)
  } else {
    drawHecheng(model)
    drawHint(model)
    drawBoard(model)
    drawChainPop(model)
    drawFx(model)
    drawInfo(model)
    drawSheet(model)
    drawTutorial(model)
    drawLesson(model)
    drawStorageLesson(model)
    drawHand(model)
  }
  if (frame.showHelp) drawHelp(model)
  const overlay = activeOverlay(model.state)
  if (overlay === 'level') drawLevelModal(model)
  else if (overlay === 'smile') drawSmileModal(model)
  else if (overlay === 'shop') drawShop(model)
  else if (overlay === 'detail') drawDetail(model)
  else if (overlay === 'talk') {
    if (model.state.notice) drawNotice(model)
    else drawGuide(model)
  } else if (overlay === 'mint') drawMintGuide(model)
  else drawGuide(model)
  drawBuildStory(model)
  if (frame.showModal && model.modal) drawEnergyModal(model)
  if (model.chain) drawChain(model)
  if (frame.showTuner) drawTuner(model)
  drawHudTools(model)
  drawToasts(model)
  drawCurtain(model)
}

function drawCurtain(model: RenderModel): void {
  const job = model.curtain
  if (!job) return
  const { ctx, frame, cfg } = model
  const place = curtainPlace(frame.w, frame.h)
  const bamboo = curtainBambooPlace(frame.w, frame.h)
  const travel = Math.max(0, bamboo.y + bamboo.h)
  const bounce = Math.max(0, cfg.economy.curtainBounce ?? 0) * frame.h
  const drop = job.progress >= 1 ? 0 : curtainDrop(job.progress, travel, bounce)
  const { curtain, front } = curtainBitmaps()
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, 0, frame.w, frame.h)
  ctx.clip()
  const top = bamboo.y + drop
  ctx.fillStyle = '#000'
  if (top > 0) ctx.fillRect(0, 0, frame.w, top)
  if (bamboo.x > 0) ctx.fillRect(0, 0, bamboo.x, frame.h)
  if (bamboo.x + bamboo.w < frame.w) ctx.fillRect(bamboo.x + bamboo.w, 0, frame.w - (bamboo.x + bamboo.w), frame.h)
  const curtainReady = (curtain?.naturalWidth || 0) > 0
  if (curtainReady && curtain) {
    ctx.drawImage(curtain as CanvasImageSource, bamboo.x, bamboo.y + drop, bamboo.w, bamboo.h)
  } else if (top < frame.h) {
    ctx.fillStyle = '#c79a62'
    ctx.fillRect(0, Math.max(0, top), frame.w, frame.h - Math.max(0, top))
  }
  if ((front?.naturalWidth || 0) > 0 && front) {
    ctx.drawImage(front as CanvasImageSource, place.x, place.y, place.w, place.h)
  }
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'center',
  baseline: CanvasTextBaseline = 'middle',
  weight = 600,
): void {
  ctx.fillStyle = color
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(value, x, y)
}

function wrap(ctx: CanvasRenderingContext2D, value: string, maxW: number, size: number, weight = 500): string[] {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`
  const lines: string[] = []
  for (const para of value.split('\n')) {
    let cur = ''
    for (const ch of para) {
      const next = cur + ch
      if (ctx.measureText(next).width > maxW && cur) {
        lines.push(cur)
        cur = ch
      } else cur = next
    }
    lines.push(cur)
  }
  return lines
}

function button(ctx: CanvasRenderingContext2D, rect: Rect, label: string, kind: 'primary' | 'ghost' | 'gold'): void {
  if (rect.w <= 0) return
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10)
  ctx.fillStyle = kind === 'primary' ? PAL.danger : kind === 'gold' ? '#f6e7c2' : PAL.white
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = kind === 'primary' ? PAL.danger : PAL.ink
  ctx.stroke()
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(16, rect.h * 0.42), kind === 'primary' ? PAL.white : PAL.ink)
}

function drawNum(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number): void {
  ctx.font = `700 ${Math.round(size)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = Math.max(2, size * 0.16)
  ctx.strokeStyle = 'rgba(255,250,243,0.94)'
  ctx.strokeText(value, x, y)
  ctx.fillStyle = PAL.ink
  ctx.fillText(value, x, y)
}

function drawLevelShape(ctx: CanvasRenderingContext2D, level: number, x: number, y: number, r: number): void {
  if (level >= 6) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = PAL.gold
    ctx.stroke()
    return
  }
  const sides = [3, 4, 4, 5, 6][level - 1] ?? 4
  const rot = level === 3 ? Math.PI / 4 : -Math.PI / 2
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

function placedRect(box: Rect, place: ArtBox): Rect {
  const scale = box.w / PRODUCER_CELL_W
  return {
    x: box.x + place.x * scale,
    y: box.y + place.y * scale,
    w: place.w * scale,
    h: place.h * scale,
  }
}

function potionPieceFill(cfg: GameConfig, tier: number): number {
  const scales = cfg.economy.potionScales ?? [0.7, 0.77, 0.85, 0.92, 1]
  const index = Math.min(scales.length, Math.max(1, tier)) - 1
  return PIECE_FILL * (scales[index] ?? 1)
}

function drawFittedSprite(
  ctx: CanvasRenderingContext2D,
  sprite: CanvasImageSource & { complete?: boolean; naturalWidth?: number; naturalHeight?: number; src?: string },
  box: Rect,
  fill: number,
): void {
  const content = spriteContent(sprite)
  const fit = fill * Math.min(box.w, box.h)
  const longSide = Math.max(content.w, content.h)
  const drawW = fit / longSide
  const drawH = drawW
  const contentCx = (content.x + content.w / 2) * drawW
  const contentCy = (content.y + content.h / 2) * drawH
  ctx.drawImage(sprite, box.x + box.w / 2 - contentCx, box.y + box.h / 2 - contentCy, drawW, drawH)
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  cfg: GameConfig,
  item: Item,
  box: Rect,
  scale: number,
  alpha: number,
  now: number,
  unlimited = false,
): void {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h * 0.4
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)
  if (item.kind === 'producer') {
    const sprite = producerSprite(item.producerId, item.level)
    const place = producerPlace(item.producerId, item.level)
    if (sprite && place) {
      const rect = placedRect(box, place)
      ctx.drawImage(sprite as CanvasImageSource, rect.x, rect.y, rect.w, rect.h)
      ctx.restore()
      return
    }
  }
  const piece = item.kind === 'product' || item.kind === 'producer' ? item : null
  const sprite = piece ? itemSprite(piece.line, piece.level) : null
  if (sprite && piece) {
    drawFittedSprite(ctx, sprite, box, PIECE_FILL)
    const badge = Math.max(12, box.w * 0.28)
    roundRect(ctx, box.x + box.w - badge - 2, box.y + 2, badge, badge * 0.72, 4)
    ctx.fillStyle = 'rgba(42,33,24,0.82)'
    ctx.fill()
    text(ctx, String(piece.level), box.x + box.w - badge / 2 - 2, box.y + badge * 0.36 + 2, badge * 0.5, '#fff6e4')
  } else if (item.kind === 'product') {
    const r = box.w * (0.16 + item.level * 0.045)
    ctx.fillStyle = lineColor(cfg, item.line)
    drawLevelShape(ctx, item.level, cx, cy + box.h * 0.08, r)
    drawNum(ctx, String(item.level), cx, cy + box.h * 0.08, r * 0.92)
  } else if (item.kind === 'producer') {
    const inset = box.w * 0.12
    const body = { x: box.x + inset, y: box.y + inset, w: box.w - inset * 2, h: box.h - inset * 2 }
    roundRect(ctx, body.x, body.y, body.w, body.h, 8)
    ctx.fillStyle = '#d9d3cc'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = lineColor(cfg, item.line)
    ctx.stroke()
    drawNum(ctx, String(item.level), cx, cy + box.h * 0.05, Math.max(16, box.w * 0.32))
    if (!unlimited && item.charges <= 0 && item.cooldownUntil > now) {
      text(ctx, formatMs(item.cooldownUntil - now), cx, box.y + box.h * 0.82, Math.max(9, box.w * 0.14), PAL.danger)
    }
  } else if (item.kind === 'potion') {
    const art = potionSprite(item.tier)
    if (art) drawFittedSprite(ctx, art, box, potionPieceFill(cfg, item.tier))
  } else if (item.kind === 'gem') {
    const amount = gemAmount(cfg, item.tier)
    const r = box.w * (0.16 + item.tier * 0.04)
    ctx.fillStyle = '#d23b62'
    drawLevelShape(ctx, item.tier + 2, cx, cy, r)
    drawNum(ctx, String(amount), cx, cy, r * 0.7)
    text(ctx, '钻石', cx, box.y + box.h * 0.84, Math.max(10, box.w * 0.14), PAL.ink)
  } else if (item.kind === 'chest') {
    const art = hechengImage('chestIcon')
    if (art && (art.naturalWidth || 0) > 0) drawFittedSprite(ctx, art, box, 0.9)
    const left = item.drops?.length ?? 5
    const badge = Math.max(14, box.w * 0.3)
    roundRect(ctx, box.x + box.w - badge - 1, box.y + 2, badge, badge * 0.72, 4)
    ctx.fillStyle = 'rgba(42,33,24,0.82)'
    ctx.fill()
    text(ctx, String(left), box.x + box.w - badge / 2 - 1, box.y + badge * 0.36 + 2, badge * 0.46, '#fff6e4')
  } else if (item.kind === 'rewardBox') {
    const fill = item.box === 'purple' ? '#7a4ea3' : '#e07a3d'
    const label = item.box === 'purple' ? '紫盒' : '购物袋'
    const side = box.w * 0.58
    roundRect(ctx, cx - side / 2, cy - side / 2, side, side, 6)
    ctx.fillStyle = fill
    ctx.fill()
    text(ctx, label, cx, cy, Math.max(10, box.w * 0.16), PAL.white)
    if (item.drops) text(ctx, `×${item.drops.length}`, cx, box.y + box.h * 0.84, Math.max(10, box.w * 0.14), PAL.ink)
  }
  ctx.restore()
}

function drawStory(model: RenderModel): void {
  openingFilm().draw(model.ctx, model.frame.w, model.frame.h, model.realNow, model.cfg)
}

export function paintStoryBubble(
  ctx: CanvasRenderingContext2D,
  script: OpeningScript,
  step: number,
  fromStep: number,
  fadeAt: number,
  now: number,
): void {
  if (!comicFontReady()) return
  const fadeMs = 240
  const age = fadeAt > 0 ? now - fadeAt : fadeMs
  const fade = Math.max(0, Math.min(1, age / fadeMs))
  const current = comicPrompt(script, step)
  const previous = fromStep >= 0 ? comicPrompt(script, fromStep) : null
  const cursor = comicCursor(script, step)
  if (fade < 1 && previous && cursor && previous.page === cursor.page && previous.beat?.text) {
    paintComicBubble(ctx, script, previous.beat, false, 1 - fade, now)
  }
  if ((current.prompt === 'line' || current.prompt === 'start') && current.beat?.text) {
    paintComicBubble(ctx, script, current.beat, current.prompt === 'start', fade < 1 && previous ? fade : 1, now)
  }
}

export function paintComicPanels(
  ctx: CanvasRenderingContext2D,
  script: OpeningScript,
  pageIndex: number,
  beatIndex: number,
  now: number,
  beatAt: number,
  silaAt: number,
  animate: boolean,
  pushAt = 0,
): void {
  const page = script.pages[pageIndex]
  if (!page) return
  ctx.fillStyle = '#14110e'
  ctx.fillRect(0, 0, script.width, script.height)
  const shown = page.beats.slice(0, beatIndex + 1)
  const current = page.beats[beatIndex]
  const order: string[] = []
  for (const beat of shown) if (!order.includes(beat.panel)) order.push(beat.panel)
  order.sort((a, b) => (page.panels.find((item) => item.id === a)?.z ?? 0) - (page.panels.find((item) => item.id === b)?.z ?? 0))
  const fresh = shown.filter((beat) => beat.panel === current?.panel).length === 1
  for (const id of order) {
    const panel = page.panels.find((item) => item.id === id)
    const img = comicPanelImage(id)
    if (!panel || !img || (img.naturalWidth || 0) <= 0) continue
    const slow = page.beats.some((beat) => beat.enter === 'slow-push' && beat.panel === id)
    const posing = animate && current?.panel === id && (fresh || current.enter === 'push')
    const pose = slow
      ? enterPose('slow-push', pushAt > 0 ? now - pushAt : 0, 3000)
      : posing
        ? enterPose(current?.enter, now - beatAt, current?.ms ?? 450)
        : { alpha: 1, dx: 0, dy: 0, scale: 1, fx: 0.5, fy: 0.5 }
    const fullPage = (img.naturalWidth || 0) >= script.width - 2 && (img.naturalHeight || 0) >= script.height - 2
    const cx = panel.x + panel.w * pose.fx
    const cy = panel.y + panel.h * pose.fy
    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.globalAlpha *= Math.max(0, Math.min(1, pose.alpha))
    ctx.translate(pose.dx, pose.dy)
    ctx.translate(cx, cy)
    ctx.scale(pose.scale, pose.scale)
    ctx.translate(-cx, -cy)
    if (fullPage) ctx.drawImage(img as CanvasImageSource, 0, 0, script.width, script.height)
    else ctx.drawImage(img as CanvasImageSource, panel.x, panel.y, panel.w, panel.h)
    ctx.restore()
  }
  if (!shown.some((beat) => beat.kind === 'sila')) return
  const sila = comicSilaImage()
  if (!sila || (sila.naturalWidth || 0) <= 0) return
  const popAge = silaAt > 0 ? now - silaAt : 999
  if (popAge < 0) return
  const sw = script.width * 0.7
  const sh = sw * ((sila.naturalHeight || 1) / (sila.naturalWidth || 1))
  const pop = popScale(popAge, 280)
  ctx.save()
  ctx.translate(384, 680)
  ctx.scale(pop, pop)
  ctx.drawImage(sila as CanvasImageSource, -sw / 2, -sh / 2, sw, sh)
  ctx.restore()
}

function enterPose(enter: ComicEnter | undefined, age: number, ms: number): { alpha: number; dx: number; dy: number; scale: number; fx: number; fy: number } {
  const dur = Math.max(280, ms)
  const t = Math.max(0, Math.min(1, age / dur))
  const ease = 1 - (1 - t) ** 3
  const overshoot = (from: number, peak: number) => {
    if (t < 0.7) return from + (peak - from) * (1 - (1 - t / 0.7) ** 3)
    const k = (t - 0.7) / 0.3
    return peak + (1 - peak) * (1 - (1 - k) ** 2)
  }
  const rest = { alpha: 1, dx: 0, dy: 0, scale: 1, fx: 0.5, fy: 0.5 }
  if (enter === 'slow-push') {
    const z = Math.max(0, Math.min(1, age / 3000))
    const ease = 1 - (1 - z) ** 3
    return { alpha: 1, dx: 0, dy: 0, scale: 1 + 0.08 * ease, fx: 0.3, fy: 0.55 }
  }
  if (enter === 'fade-push') {
    const z = Math.min(1, age / 500)
    return { alpha: Math.min(1, age / 400), dx: 0, dy: 0, scale: 1 + 0.07 * (1 - (1 - z) ** 3), fx: 0.82, fy: 0.42 }
  }
  if (enter === 'fade-face') {
    const z = Math.max(0, Math.min(1, (age - 180) / 500))
    return { alpha: Math.min(1, age / 300), dx: 0, dy: 0, scale: 1 + 0.09 * (1 - (1 - z) ** 3), fx: 0.78, fy: 0.42 }
  }
  if (enter === 'push') {
    const z = Math.min(1, age / dur)
    return { alpha: 1, dx: 0, dy: 0, scale: 1 + 0.06 * (1 - (1 - z) ** 3), fx: 0.55, fy: 0.28 }
  }
  if (age >= dur) return rest
  if (enter === 'pop') return { alpha: Math.min(1, age / 120), dx: 0, dy: 0, scale: overshoot(0.62, 1.06), fx: 0.5, fy: 0.55 }
  if (enter === 'slide-right') return { alpha: 1, dx: (1 - ease) * 240, dy: 0, scale: 1, fx: 0.5, fy: 0.5 }
  if (enter === 'slide-left') return { alpha: 1, dx: -(1 - ease) * 240, dy: 0, scale: 1, fx: 0.5, fy: 0.5 }
  if (enter === 'pop-right') return { alpha: Math.min(1, age / 100), dx: (1 - ease) * 170, dy: 0, scale: overshoot(0.78, 1.05), fx: 0.55, fy: 0.45 }
  if (enter === 'pop-big') return { alpha: Math.min(1, age / 80), dx: 0, dy: 0, scale: overshoot(0.7, 1.08), fx: 0.5, fy: 0.5 }
  if (enter === 'rise') return { alpha: Math.min(1, age / 280), dx: 0, dy: (1 - ease) * 170, scale: 1, fx: 0.5, fy: 0.35 }
  if (enter === 'fade') return { alpha: Math.min(1, age / dur), dx: 0, dy: 0, scale: 1, fx: 0.5, fy: 0.5 }
  if (enter === 'slide-slant') return { alpha: 1, dx: (1 - ease) * 260, dy: -(1 - ease) * 36, scale: 1, fx: 0.5, fy: 0.5 }
  return rest
}

export function paintMute(ctx: CanvasRenderingContext2D, rect: Rect, muted: boolean): void {
  if (rect.w <= 0) return
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10)
  ctx.fillStyle = PAL.white
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = PAL.ink
  ctx.stroke()
  const cx = rect.x + rect.w * 0.38
  const cy = rect.y + rect.h / 2
  const s = Math.min(rect.w, rect.h) * 0.22
  ctx.fillStyle = '#2a2118'
  ctx.beginPath()
  ctx.rect(cx - s * 0.35, cy - s * 0.45, s * 0.7, s * 0.9)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + s * 0.2, cy - s * 0.45)
  ctx.lineTo(cx + s * 1.15, cy - s * 1.15)
  ctx.lineTo(cx + s * 1.15, cy + s * 1.15)
  ctx.lineTo(cx + s * 0.2, cy + s * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = Math.max(1.4, s * 0.28)
  ctx.lineCap = 'round'
  if (muted) {
    ctx.strokeStyle = '#9c2f2f'
    ctx.beginPath()
    ctx.moveTo(cx + s * 1.5, cy - s * 1.05)
    ctx.lineTo(cx + s * 2.7, cy + s * 1.05)
    ctx.moveTo(cx + s * 2.7, cy - s * 1.05)
    ctx.lineTo(cx + s * 1.5, cy + s * 1.05)
    ctx.stroke()
  } else {
    ctx.strokeStyle = '#2a2118'
    ctx.beginPath()
    ctx.arc(cx + s * 1.35, cy, s * 0.85, -0.8, 0.8)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + s * 1.35, cy, s * 1.45, -0.7, 0.7)
    ctx.stroke()
  }
}

function paintComicBubble(
  ctx: CanvasRenderingContext2D,
  script: { width: number; height: number },
  beat: { speaker?: string; text?: string; x?: number; y?: number; w?: number },
  start: boolean,
  alpha: number,
  now: number,
): void {
  const line = beat.text
  if (!line || alpha <= 0.02) return
  const body = 27
  const lineH = body + 6
  const nameSize = 18
  const padX = 12
  const padY = 7
  ctx.save()
  ctx.globalAlpha *= alpha
  ctx.font = `400 ${body}px ${COMIC_FONT}`
  const maxW = Math.max(80, Math.min(beat.w ?? 420, script.width - 24))
  const lines = wrapComicText(line, maxW, (value) => ctx.measureText(value).width).slice(0, 3)
  const textW = Math.max(48, ...lines.map((row) => ctx.measureText(row).width))
  ctx.font = `700 ${nameSize}px ${COMIC_FONT}`
  const nameW = beat.speaker ? ctx.measureText(beat.speaker).width : 0
  const innerW = Math.max(textW, nameW)
  const nameH = beat.speaker ? nameSize + 2 : 0
  const foot = start ? 36 : 14
  const boxW = innerW + padX * 2
  const boxH = padY + nameH + lines.length * lineH + foot + padY
  let x = beat.x ?? 24
  let y = (beat.y ?? 24) - padY - nameH
  if (x < 8) x = 8
  if (y < 8) y = 8
  if (x + boxW > script.width - 8) x = Math.max(8, script.width - 8 - boxW)
  if (y + boxH > script.height - 8) y = Math.max(8, script.height - 8 - boxH)
  roundRect(ctx, x, y, boxW, boxH, 12)
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fill()
  let textY = y + padY
  if (beat.speaker) {
    ctx.font = `700 ${nameSize}px ${COMIC_FONT}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = '#f3d48a'
    ctx.fillText(beat.speaker, x + padX, textY)
    textY += nameH
  }
  ctx.font = `400 ${body}px ${COMIC_FONT}`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  for (const row of lines) {
    ctx.fillText(row, x + padX, textY + (lineH - body) / 2)
    textY += lineH
  }
  if (start) {
    const label = '开始营业'
    ctx.font = `700 22px ${COMIC_FONT}`
    const tw = ctx.measureText(label).width
    const bw = tw + 22
    const bh = 30
    const bx = x + boxW - bw - 8
    const by = y + boxH - bh - 8
    roundRect(ctx, bx, by, bw, bh, bh / 2)
    ctx.fillStyle = '#f3d48a'
    ctx.fill()
    ctx.fillStyle = '#2a2118'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, bx + bw / 2, by + bh / 2)
  } else {
    const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 160))
    const ax = x + boxW - 16
    const ay = y + boxH - 16
    ctx.globalAlpha *= blink
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(ax, ay + 6)
    ctx.lineTo(ax - 5.5, ay - 2)
    ctx.lineTo(ax + 5.5, ay - 2)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export function paintComicHand(ctx: CanvasRenderingContext2D, frame: Frame, caption: boolean): void {
  const x = frame.w / 2
  const y = frame.h * 0.42
  const hand = Math.max(54, frame.w * 0.16)
  paintHand(ctx, x, y, hand)
  if (!caption || !comicFontReady()) return
  const size = Math.max(16, frame.w * 0.046)
  const label = '点击屏幕继续'
  const textY = y + hand + size * 0.55
  ctx.font = `400 ${size}px ${COMIC_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(3, size * 0.16)
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'
  ctx.strokeText(label, x, textY)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, x, textY)
}

function pill(ctx: CanvasRenderingContext2D, rect: Rect, label: string, value: string, color: string): void {
  if (rect.w <= 0) return
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2)
  ctx.fillStyle = '#fffaf6'
  ctx.fill()
  ctx.lineWidth = Math.max(1, rect.h * 0.06)
  ctx.strokeStyle = '#e4d3bc'
  ctx.stroke()
  text(ctx, label, rect.x + rect.w * 0.1, rect.y + rect.h * 0.32, Math.max(9, rect.h * 0.32), PAL.soft, 'left')
  text(ctx, value, rect.x + rect.w * 0.1, rect.y + rect.h * 0.72, Math.max(13, rect.h * 0.5), color, 'left', 'middle', 700)
}

function resourcePill(ctx: CanvasRenderingContext2D, rect: Rect, mark: string, markColor: string, value: string, valueColor: string): void {
  if (rect.w <= 0) return
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2)
  ctx.fillStyle = '#fffaf6'
  ctx.fill()
  ctx.lineWidth = Math.max(1, rect.h * 0.06)
  ctx.strokeStyle = '#ead9c2'
  ctx.stroke()
  const r = rect.h * 0.36
  const cx = rect.x + r + rect.h * 0.12
  const cy = rect.y + rect.h / 2
  ctx.beginPath()
  ctx.fillStyle = markColor
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  text(ctx, mark, cx, cy, r * 1.15, PAL.white, 'center', 'middle', 700)
  text(ctx, value, rect.x + rect.w - rect.h * 0.28, cy, Math.max(15, rect.h * 0.52), valueColor, 'right', 'middle', 700)
}

const guestSeen = new Map<string, number>()

function blit(ctx: CanvasRenderingContext2D, id: Parameters<typeof hechengImage>[0], rect: Rect): void {
  if (rect.w <= 0 || rect.h <= 0) return
  const img = hechengImage(id)
  if (!img || (img.naturalWidth || 0) <= 0) return
  ctx.drawImage(img as CanvasImageSource, rect.x, rect.y, rect.w, rect.h)
}

function drawHecheng(model: RenderModel): void {
  const { ctx, frame, state, cfg, realNow } = model
  const scale = frame.w / 1080
  const top = frame.board.y - 714 * scale
  const bg = hechengImage('bg')
  if (bg && (bg.naturalWidth || 0) > 0) {
    let x = -324 * scale
    let y = top - 178 * scale
    let w = 1725 * scale
    let h = 2627 * scale
    if (y > -1) {
      const grow = y + 2
      const s = (h + grow) / h
      x -= (w * s - w) / 2
      y -= grow
      w *= s
      h *= s
    }
    ctx.drawImage(bg as CanvasImageSource, x, y, w, h)
    if (y + h < frame.h) {
      ctx.fillStyle = '#8a5a32'
      ctx.fillRect(0, y + h - 1, frame.w, frame.h - (y + h) + 1)
    }
  } else {
    ctx.fillStyle = '#1a1410'
    ctx.fillRect(0, 0, frame.w, frame.h)
  }
  const at = (box: Rect, anchor: 'top' | 'bottom' = 'top') => designToScreen(frame, box, anchor)
  const clipOrders = () => {
    ctx.beginPath()
    ctx.rect(frame.orderClip.x, frame.orderClip.y, frame.orderClip.w, frame.orderClip.h)
    ctx.clip()
  }
  const counterImg = hechengImage('counter')
  if (counterImg && (counterImg.naturalWidth || 0) > 0) {
    const counterY = top + 598 * scale
    const counterH = 324 * scale
    ctx.drawImage(counterImg as CanvasImageSource, 0, counterY, frame.w, counterH)
  }
  blit(ctx, 'board', at({ x: 7, y: 714, w: 1071, h: 1370 }))
  ctx.save()
  clipOrders()
  state.orders.forEach((order, index) => {
    const guest = frame.orderGuests[index]
    if (!guest) return
    const who = cfg.characters.find((entry) => entry.id === order.customerId)
    const firstOrder = order.scripted === true
    const portrait = firstOrder ? firstOrderGuestPortrait() : guestPortrait(who?.portrait)
    if (!guestSeen.has(order.id)) guestSeen.set(order.id, realNow)
    if ((who || firstOrder) && portrait && portraitReady(portrait)) {
      const portraitId = firstOrder ? 'xiaotao' : who?.portrait
      const table = frame.tableSlots[index]
      drawCharacter(ctx, portraitId, portrait, guest, realNow, 'contain', {
        startedAt: guestSeen.get(order.id),
        tableCenterX: table ? table.x + table.w / 2 : guest.x + guest.w / 2,
        nudgeX: cfg.economy.guestNudgeX ?? 0,
      })
    }
  })
  ctx.restore()
  ctx.save()
  clipOrders()
  frame.tableSlots.forEach((plate) => blit(ctx, 'plate', plate))
  state.orders.forEach((order, index) => {
    order.slots.forEach((slot, slotIndex) => {
      const icon = frame.orderIcons.find((entry) => entry.order === index && entry.slot === slotIndex)
      if (!icon) return
      const sprite = itemSprite(slot.line, slot.level)
      if (sprite) drawFittedSprite(ctx, sprite, icon.rect, 1)
      else {
        roundRect(ctx, icon.rect.x, icon.rect.y, icon.rect.w, icon.rect.h, 6)
        ctx.fillStyle = lineColor(cfg, slot.line)
        ctx.fill()
      }
      if (slotChecked(state, order, slotIndex)) {
        const r = Math.max(4, Math.min(7, icon.rect.h * 0.22))
        ctx.beginPath()
        ctx.fillStyle = '#fffaf3'
        ctx.arc(icon.rect.x + icon.rect.w - r - 1, icon.rect.y + icon.rect.h - r - 1, r, 0, Math.PI * 2)
        ctx.fill()
        text(ctx, '✓', icon.rect.x + icon.rect.w - r - 1, icon.rect.y + icon.rect.h - r - 1, r * 1.15, '#2c7a58')
      }
    })
    const payRect = frame.orderRewards[index]
    if (payRect) {
      blit(ctx, 'bubble', payRect)
      const pay = orderPayout(order, cfg)
      const cover = { x: payRect.x + payRect.w * 0.4, y: payRect.y + payRect.h * 0.16, w: payRect.w * 0.5, h: payRect.h * 0.62 }
      roundRect(ctx, cover.x, cover.y, cover.w, cover.h, 8)
      ctx.fillStyle = '#f6e4c4'
      ctx.fill()
      const rewardSize = Math.max(10, payRect.h * 0.28)
      text(ctx, `+${pay.coins}`, payRect.x + payRect.w * 0.72, payRect.y + payRect.h * 0.48, rewardSize, '#6a3a22', 'right', 'middle', 700)
    }
    if (orderSatisfied(state, order)) {
      const btn = frame.completes[index]
      if (btn) blit(ctx, 'complete', btn)
    }
  })
  ctx.restore()
  blit(ctx, 'stash', frame.pendingBtn)
  blit(ctx, 'info', frame.infoBar)
  blit(ctx, 'build', frame.houseBtn)
  const task = nextTask(state, cfg)
  const buildHot = state.phase === 'play' && state.guide === 'none' && task && state.coins >= taskPrice(task, cfg)
  if (frame.taskBtn.w > 0) {
    blit(ctx, 'taskFrame', frame.taskBtn)
    blit(ctx, 'taskIcon', frame.taskIcon)
    if (buildHot) blit(ctx, 'badgeTask', frame.badgeTask)
  }
  if (frame.chestBtn.w > 0) {
    blit(ctx, 'chestFrame', frame.chestBtn)
    blit(ctx, 'chestIcon', frame.chestIcon)
    blit(ctx, 'badgeSmall', frame.badgeChest)
    if (state.rewards.length > 1) {
      text(
        ctx,
        String(state.rewards.length),
        frame.badgeChest.x + frame.badgeChest.w / 2,
        frame.badgeChest.y + frame.badgeChest.h / 2,
        Math.max(9, frame.badgeChest.h * 0.46),
        '#fffaf3',
      )
    }
  }
  if (frame.storyBtn.w > 0) {
    blit(ctx, 'chestFrame', frame.storyBtn)
    blit(ctx, 'book', frame.bookIcon)
    if (!state.storySeen) blit(ctx, 'badgeSmall', frame.badgeStory)
  }
  blit(ctx, 'energy', frame.energySlot)
  blit(ctx, 'coin', frame.coinSlot)
  blit(ctx, 'gem', frame.gemSlot)
  const num = (rect: Rect, value: string, flash = false) => {
    text(ctx, value, rect.x + rect.w * 0.58 + 1, rect.y + rect.h / 2 + 1, rect.h * 0.42, 'rgba(40,24,12,0.45)', 'center', 'middle', 700)
    text(ctx, value, rect.x + rect.w * 0.58, rect.y + rect.h / 2, rect.h * 0.42, flash ? '#ffd0c8' : '#fffaf2', 'center', 'middle', 700)
  }
  num(frame.energySlot, String(state.energy), realNow < model.fx.energyFlash)
  const shown = Math.max(0, state.coins - model.fx.incoming)
  num(frame.coinSlot, String(shown))
  num(frame.gemSlot, String(state.gems))
  const avatar = frame.avatarSlot
  const avatarArt = {
    x: avatar.x + (12 / 149) * avatar.w,
    y: avatar.y + (15 / 149) * avatar.h,
    w: (125 / 149) * avatar.w,
    h: (126 / 149) * avatar.h,
  }
  const badge = {
    x: avatar.x + (102 / 149) * avatar.w,
    y: avatar.y + (100 / 149) * avatar.h,
    w: (47 / 149) * avatar.w,
    h: (47 / 149) * avatar.h,
  }
  const portrait = hechengImage('avatar')
  if (portrait) drawAvatar(ctx, portrait, avatarArt, realNow)
  blit(ctx, 'avatarFrame', avatar)
  blit(ctx, 'levelBadge', badge)
  const levelText = String(state.level)
  const levelSize = badge.w * (levelText.length >= 3 ? 0.34 : 0.46)
  ctx.lineWidth = Math.max(2, levelSize * 0.16)
  ctx.strokeStyle = '#6a3a22'
  ctx.font = `700 ${Math.round(levelSize)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(levelText, badge.x + badge.w / 2, badge.y + badge.h / 2)
  ctx.fillStyle = '#fffaf2'
  ctx.fillText(levelText, badge.x + badge.w / 2, badge.y + badge.h / 2)
  const goal = Math.max(1, cfg.economy.smileGoal)
  const ratio = Math.max(0, Math.min(1, state.smiles / goal))
  const full = state.smiles >= goal
  blit(ctx, full ? 'smileFull' : 'smile', frame.smileSlot)
  if (!full && ratio > 0) {
    const cx = frame.smileSlot.x + frame.smileSlot.w / 2
    const cy = frame.smileSlot.y + frame.smileSlot.h / 2
    ctx.beginPath()
    ctx.strokeStyle = '#3cca5f'
    ctx.lineWidth = Math.max(3, frame.smileSlot.w * 0.12)
    ctx.lineCap = 'round'
    ctx.arc(cx, cy, frame.smileSlot.w * 0.445, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2)
    ctx.stroke()
  }
  if (full) {
    const smile = frame.smileSlot
    blit(ctx, 'badgeSmall', {
      x: smile.x + (59 / 86) * smile.w,
      y: smile.y - (12 / 86) * smile.h,
      w: (36 / 86) * smile.w,
      h: (36 / 86) * smile.h,
    })
  }
  blit(ctx, speedArtId(state.spawnMult ?? 1), frame.multBtn)
  blit(ctx, 'shop', frame.shopBtn)
  if (!state.shopPackClaimed || !state.shopClaimDate) {
    const shop = frame.shopBtn
    blit(ctx, 'badgeShop', {
      x: shop.x + (102 / 124) * shop.w,
      y: shop.y - (1 / 107) * shop.h,
      w: (38 / 124) * shop.w,
      h: (38 / 107) * shop.h,
    })
  }
  if (buildHot) {
    ctx.beginPath()
    ctx.fillStyle = '#c4552a'
    ctx.arc(frame.houseBtn.x + frame.houseBtn.w - 16 * scale, frame.houseBtn.y + 16 * scale, 7 * scale, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawHud(model: RenderModel): void {
  const { ctx, frame, state, cfg, realNow, animNow, fx } = model
  ctx.fillStyle = PAL.paperDeep
  ctx.fillRect(0, 0, frame.w, frame.hud.y + frame.hud.h)
  const avatar = frame.avatarSlot
  if (avatar.w > 0 && frame.mode === 'board') {
    const cx = avatar.x + avatar.w / 2
    const cy = avatar.y + avatar.h / 2
    const r = avatar.w / 2
    ctx.beginPath()
    ctx.fillStyle = '#f2c7a2'
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.fillStyle = '#3a2a24'
    ctx.arc(cx, cy - r * 0.08, r * 0.92, Math.PI, 0)
    ctx.fill()
    ctx.beginPath()
    ctx.fillStyle = '#f2c7a2'
    ctx.arc(cx, cy + r * 0.08, r * 0.62, 0, Math.PI * 2)
    ctx.fill()
    text(ctx, '月', cx, cy + r * 0.12, r * 0.7, '#6a3a32', 'center', 'middle', 700)
    ctx.beginPath()
    ctx.lineWidth = Math.max(2, r * 0.08)
    ctx.strokeStyle = '#fffaf6'
    ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.stroke()
    const badgeW = avatar.w * 0.72
    const badgeH = avatar.h * 0.28
    const badgeX = cx - badgeW / 2
    const badgeY = avatar.y + avatar.h - badgeH * 0.72
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2)
    ctx.fillStyle = '#c44832'
    ctx.fill()
    text(ctx, cnLevel(state.level), cx, badgeY + badgeH / 2, badgeH * 0.72, '#fff4df', 'center', 'middle', 700)
  } else if (avatar.w > 0) {
    roundRect(ctx, avatar.x, avatar.y, avatar.w, avatar.h, avatar.w * 0.22)
    ctx.fillStyle = '#c44832'
    ctx.fill()
    text(ctx, '月', avatar.x + avatar.w / 2, avatar.y + avatar.h * 0.42, avatar.w * 0.42, PAL.white, 'center', 'middle', 700)
    text(ctx, cnLevel(state.level), avatar.x + avatar.w / 2, avatar.y + avatar.h * 0.78, avatar.w * 0.22, '#ffe7c2', 'center', 'middle', 700)
  }
  const flash = realNow < fx.energyFlash
  resourcePill(ctx, frame.energySlot, '体', flash ? PAL.danger : '#e0a23a', String(state.energy), flash ? PAL.danger : '#3a2e24')
  const shown = Math.max(0, state.coins - fx.incoming)
  const punchAge = animNow - fx.coinPunch
  ctx.save()
  const punch = punchAge >= 0 && punchAge < 180 ? 1 + 0.18 * (1 - punchAge / 180) : 1
  ctx.translate(frame.coinSlot.x + frame.coinSlot.w / 2, frame.coinSlot.y + frame.coinSlot.h / 2)
  ctx.scale(punch, punch)
  ctx.translate(-(frame.coinSlot.x + frame.coinSlot.w / 2), -(frame.coinSlot.y + frame.coinSlot.h / 2))
  resourcePill(ctx, frame.coinSlot, '钱', '#e0a23a', String(shown), '#3a2e24')
  ctx.restore()
  resourcePill(ctx, frame.gemSlot, '钻', '#d23b62', String(state.gems), '#3a2e24')
  if ((state.smiles > 0 || smilesVisible(state, cfg, realNow)) && frame.smileSlot.w > 0) {
    const full = state.smiles >= cfg.economy.smileGoal
    const bounce = full ? 1 + 0.08 * Math.sin(realNow / 120) : 1
    ctx.save()
    ctx.translate(frame.smileSlot.x + frame.smileSlot.w / 2, frame.smileSlot.y + frame.smileSlot.h / 2)
    ctx.scale(bounce, bounce)
    ctx.translate(-(frame.smileSlot.x + frame.smileSlot.w / 2), -(frame.smileSlot.y + frame.smileSlot.h / 2))
    pill(ctx, frame.smileSlot, '笑脸', `${state.smiles}/${cfg.economy.smileGoal}`, full ? '#7a4ea3' : PAL.ink)
    ctx.restore()
  }
  roundRect(ctx, frame.tuneBtn.x, frame.tuneBtn.y, frame.tuneBtn.w, frame.tuneBtn.h, 6)
  ctx.fillStyle = 'rgba(255,250,243,0.72)'
  ctx.fill()
  text(ctx, '调', frame.tuneBtn.x + frame.tuneBtn.w / 2, frame.tuneBtn.y + frame.tuneBtn.h / 2, 11, PAL.soft)
  if (frame.dailyBtn.w > 0) {
    roundRect(ctx, frame.dailyBtn.x, frame.dailyBtn.y, frame.dailyBtn.w, frame.dailyBtn.h, 6)
    ctx.fillStyle = '#f6e7c2'
    ctx.fill()
    text(ctx, '箱', frame.dailyBtn.x + frame.dailyBtn.w / 2, frame.dailyBtn.y + frame.dailyBtn.h / 2, 11, PAL.ink)
  }
  if (frame.skip.w > 0) button(ctx, frame.skip, '跳过', 'ghost')
}


function drawHudTools(model: RenderModel): void {
  const { ctx, frame, state } = model
  if (frame.mode !== 'board' && frame.multBtn.w > 0) {
    roundRect(ctx, frame.multBtn.x, frame.multBtn.y, frame.multBtn.w, frame.multBtn.h, 6)
    ctx.fillStyle = '#3a342e'
    ctx.fill()
    text(ctx, `×${state.spawnMult ?? 1}`, frame.multBtn.x + frame.multBtn.w / 2, frame.multBtn.y + frame.multBtn.h / 2, 12, '#fff6e4')
  }
  if (frame.mode !== 'board' && frame.shopBtn.w > 0) {
    roundRect(ctx, frame.shopBtn.x, frame.shopBtn.y, frame.shopBtn.w, frame.shopBtn.h, 6)
    ctx.fillStyle = '#8a6a4a'
    ctx.fill()
    text(ctx, '店', frame.shopBtn.x + frame.shopBtn.w / 2, frame.shopBtn.y + frame.shopBtn.h / 2, 13, '#fff6e4')
  }
  if (frame.tuneBtn.w > 0 && frame.mode === 'board') {
    roundRect(ctx, frame.tuneBtn.x, frame.tuneBtn.y, frame.tuneBtn.w, frame.tuneBtn.h, 6)
    ctx.fillStyle = 'rgba(255,250,243,0.72)'
    ctx.fill()
    text(ctx, '调', frame.tuneBtn.x + frame.tuneBtn.w / 2, frame.tuneBtn.y + frame.tuneBtn.h / 2, 11, PAL.soft)
  }
}

function drawShop(model: RenderModel): void {
  const { ctx, frame } = model
  const shop = shopRects(frame)
  ctx.fillStyle = 'rgba(28,22,16,0.45)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  roundRect(ctx, shop.card.x, shop.card.y, shop.card.w, shop.card.h, 14)
  ctx.fillStyle = '#d9d3cc'
  ctx.fill()
  text(ctx, '商城', shop.card.x + 18, shop.card.y + 28, 18, '#2a2118', 'left')
  text(ctx, '×', shop.close.x + shop.close.w / 2, shop.close.y + shop.close.h / 2, 16, '#2a2118')
  for (const [rect, title, sub] of [
    [shop.daily, '每日免费', '50 体力'],
    [shop.pack, '新手大礼包', '10 钻石 · 50 体力'],
  ] as const) {
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8)
    ctx.fillStyle = '#eee8e0'
    ctx.fill()
    ctx.strokeStyle = '#8a7b6a'
    ctx.stroke()
    text(ctx, title, rect.x + 12, rect.y + 16, 14, '#2a2118', 'left')
    text(ctx, sub, rect.x + 12, rect.y + 34, 12, '#6f6254', 'left')
  }
}

function drawDetail(model: RenderModel): void {
  const { ctx, frame, cfg, state } = model
  const card = detailCard(frame)
  const lineId = state.detailLine
  const line = cfg.items.lines.find((entry) => entry.id === lineId)
  ctx.fillStyle = 'rgba(28,22,16,0.45)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  roundRect(ctx, card.x, card.y, card.w, card.h, 14)
  ctx.fillStyle = '#fff8ec'
  ctx.fill()
  text(ctx, '哇！新的饮料机！', card.x + card.w / 2, card.y + 28, 18, '#9c2f2f')
  text(ctx, '看看里面有什么吧', card.x + card.w / 2, card.y + 52, 13, '#6f6254')
  const levels = line?.levels ?? []
  levels.forEach((level, index) => {
    const y = card.y + 78 + index * 28
    if (y > card.y + card.h - 24) return
    text(ctx, `${level.level}  ${level.name}`, card.x + 18, y, 14, '#2a2118', 'left')
  })
  text(ctx, '点外面关掉', card.x + card.w / 2, card.y + card.h - 18, 12, '#6f6254')
}

function buriedPreview(lock: { buried: GameState['locks'][number]['buried'] }): Item | null {
  const buried = lock.buried
  if (buried.kind === 'product') return { uid: 'buried', kind: 'product', line: buried.line, level: buried.level }
  if (buried.kind === 'producer') return { uid: 'buried', kind: 'producer', producerId: buried.id, line: buried.id, level: buried.level, charges: 0, cooldownUntil: 0 }
  if (buried.kind === 'potion') return { uid: 'buried', kind: 'potion', tier: buried.tier }
  if (buried.kind === 'gem') return { uid: 'buried', kind: 'gem', tier: buried.tier }
  return null
}

function drawHint(model: RenderModel): void {
  if (model.frame.hint.h <= 0 || !model.hintText) return
  const { ctx, frame } = model
  text(ctx, model.hintText, frame.w / 2, frame.hint.y + frame.hint.h / 2, 14, PAL.ink)
}

function cellBox(frame: Frame, row: number, col: number): Rect {
  return cellRect(frame, row, col)
}

function drawReadyCell(ctx: CanvasRenderingContext2D, box: Rect): void {
  const img = hechengImage('readyCell')
  if (!img || (img.naturalWidth || 0) <= 0) return
  ctx.drawImage(img as CanvasImageSource, box.x, box.y, box.w, box.h)
}

function drawOrderTick(ctx: CanvasRenderingContext2D, box: Rect, scale: number, offsetX: number, offsetY: number): void {
  const img = hechengImage('orderTick')
  if (!img || (img.naturalWidth || 0) <= 0) return
  const place = orderTickPlace(box, scale, offsetX, offsetY)
  ctx.drawImage(img as CanvasImageSource, place.image.x, place.image.y, place.image.w, place.image.h)
}

function drawSelectFrame(ctx: CanvasRenderingContext2D, box: Rect, frameScale: number): void {
  const img = hechengImage('selectFrame')
  if (!img || (img.naturalWidth || 0) <= 0) return
  const rect = selectFrameRect(box, frameScale)
  ctx.drawImage(img as CanvasImageSource, rect.x, rect.y, rect.w, rect.h)
}

function hiddenCells(fx: Fx): Set<string> {
  const set = new Set<string>()
  if (fx.drag && !fx.drag.pending) set.add(`${fx.drag.row},${fx.drag.col}`)
  for (const flyer of fx.flyers) for (const pos of flyer.hide) set.add(`${pos.row},${pos.col}`)
  return set
}

function drawBoard(model: RenderModel): void {
  const { ctx, frame, state, cfg, realNow, animNow, fx } = model
  if (frame.board.cell <= 0) return
  const theme = cfg.boardTheme
  const hidden = hiddenCells(fx)
  const highlights = new Set<string>()
  const marks = orderMarks(state)
  const checks = new Set(marks.check)
  const readyCells = new Set(marks.ready)
  const glow = new Set(glowingLocks(state).map((pos) => `${pos.row},${pos.col}`))
  const wood = frame.mode === 'board'
  if (!wood) {
    const matTop = frame.orderClip.h > 0 ? frame.orderClip.y + frame.orderClip.h : frame.hud.y + frame.hud.h
    const matBottom = frame.dock.h > 0 ? frame.dock.y : frame.h
    ctx.fillStyle = theme.mat
    ctx.fillRect(0, matTop, frame.w, Math.max(0, matBottom - matTop))
  }
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const box = cellBox(frame, row, col)
      const pad = 2
      const key = `${row},${col}`
      const radius = Math.max(6, (box.w - pad * 2) * 0.18)
      if (!wood) {
        roundRect(ctx, box.x + pad, box.y + pad, box.w - pad * 2, box.h - pad * 2, radius)
        ctx.fillStyle = (row + col) % 2 === 0 ? theme.cellLight : theme.cellDark
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = theme.cellLine
        ctx.stroke()
      }
      if (readyCells.has(key) && !hidden.has(key)) drawReadyCell(ctx, box)
      const hover = fx.hover?.kind === 'cell' && fx.hover.row === row && fx.hover.col === col
      if (highlights.has(key) || hover) {
        ctx.lineWidth = 2.5
        ctx.strokeStyle = hover && fx.hover?.kind === 'cell' && fx.hover.merge ? PAL.energy : PAL.gold
        ctx.stroke()
      }
      const lock = lockAt(state, row, col)
      const item = state.board[row][col]
      const unlimited = inProducerGrace(state, cfg)
      if (lock && !item) {
        const covered = lock.veil === 'full' && lock.cover !== 'gift'
        if (!covered && lock.buried.kind === 'product') {
          drawItem(ctx, cfg, { uid: 'buried', kind: 'product', line: lock.buried.line, level: lock.buried.level }, box, 1, 0.45, realNow)
        } else if (!covered && lock.buried.kind === 'producer') {
          const buried = lock.buried
          drawItem(
            ctx,
            cfg,
            {
              uid: 'buried',
              kind: 'producer',
              producerId: buried.id,
              line: cfg.producers.find((entry) => entry.id === buried.id)?.line ?? buried.id,
              level: buried.level,
              charges: 0,
              cooldownUntil: 0,
            },
            box,
            1,
            0.55,
            realNow,
          )
        } else if (!covered && lock.buried.kind === 'potion') {
          drawItem(ctx, cfg, { uid: 'buried', kind: 'potion', tier: lock.buried.tier }, box, 1, 0.45, realNow)
        } else if (!covered && lock.buried.kind === 'gem') {
          drawItem(ctx, cfg, { uid: 'buried', kind: 'gem', tier: lock.buried.tier }, box, 1, 0.45, realNow)
        } else if (!covered && lock.buried.kind === 'coin') {
          text(ctx, String(lock.buried.amount), box.x + box.w / 2, box.y + box.h * 0.4, Math.max(12, box.w * 0.22), PAL.coin)
        }
        ctx.fillStyle = covered
          ? '#c4ae86'
          : lock.cover === 'web'
            ? 'rgba(90,90,90,0.45)'
            : lock.cover === 'gift'
              ? 'rgba(180,140,60,0.45)'
              : 'rgba(255,248,236,0.42)'
        roundRect(ctx, box.x + 3, box.y + 3, box.w - 6, box.h - 6, 6)
        ctx.fill()
        const giftLeft = lock.cover === 'gift' && lock.giftUntil != null ? lock.giftUntil - realNow : 0
        if (lock.cover === 'gift') {
          const lockLabel = lock.giftUntil == null ? '礼物' : giftLeft > 0 ? formatMs(giftLeft) : '可开'
          text(ctx, lockLabel, box.x + box.w / 2, box.y + box.h * 0.72, Math.max(9, box.w * 0.16), PAL.ink)
        }
        if (glow.has(key)) {
          const amp = Math.max(0, Math.min(1, cfg.economy.lockPulse || 0))
          const wave = 0.5 + 0.5 * Math.sin(realNow / 540)
          ctx.lineWidth = 2.4 + amp * 2.4 * wave
          ctx.strokeStyle = `rgba(44,122,88,${0.55 + 0.4 * amp * wave})`
          roundRect(ctx, box.x + 2, box.y + 2, box.w - 4, box.h - 4, 6)
          ctx.stroke()
        }
        continue
      }
      if (!item || hidden.has(key)) continue
      const pop = fx.pops.find((entry) => entry.row === row && entry.col === col)
      const scale = pop ? popScale(animNow - pop.birth, pop.dur) : 1
      if (pop) {
        const age = animNow - pop.birth
        const flash = Math.max(0, 1 - age / 160)
        if (flash > 0) {
          ctx.beginPath()
          ctx.fillStyle = `rgba(255,250,243,${flash * 0.7})`
          ctx.arc(box.x + box.w / 2, box.y + box.h * 0.4, box.w * 0.28, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      const picked = model.selected?.row === row && model.selected?.col === col
      const breath = picked
        ? selectBreathScale(
            realNow - model.selectedAt,
            cfg.economy.selectBreath ?? 0.06,
            cfg.economy.selectBreathMs ?? 1000,
            cfg.economy.selectBreathTimes ?? 2,
          )
        : 1
      drawItem(ctx, cfg, item, box, scale * breath, 1, realNow, unlimited && item.kind === 'producer')
      if (item.kind === 'producer' && producerTapCostsEnergy(cfg, item)) {
        const cooling = producerCooldown(cfg, item, realNow)
        if (producerCanSpawn(cfg, item, realNow)) drawSpawnBolt(ctx, box)
        else if (cooling) drawSpawnClock(ctx, box, cooling.left, cooling.total)
      }
      if (checks.has(key)) drawOrderTick(ctx, box, cfg.economy.tickScale ?? 1, cfg.economy.tickOffsetX ?? 78, cfg.economy.tickOffsetY ?? 91)
    }
  }
  if (model.selected && !fx.drag) {
    const picked = model.selected
    const held = state.board[picked.row]?.[picked.col]
    const lock = lockAt(state, picked.row, picked.col)
    if (held || lock) {
      drawSelectFrame(ctx, cellBox(frame, picked.row, picked.col), cfg.economy.selectFrameScale ?? 1.16)
    }
  }
  if (fx.drag) {
    const item = fx.drag.pending ? state.pending[fx.drag.index ?? 0] : state.board[fx.drag.row]?.[fx.drag.col]
    const origin = fx.drag.pending ? frame.pendingBtn : cellBox(frame, fx.drag.row, fx.drag.col)
    if (item) {
      drawItem(ctx, cfg, item, origin, 1, 0.28, realNow)
      const held = {
        x: fx.drag.x - origin.w / 2,
        y: fx.drag.y - origin.h / 2 - 16,
        w: origin.w,
        h: origin.h,
      }
      ctx.save()
      ctx.shadowColor = 'rgba(42,33,24,0.28)'
      ctx.shadowBlur = 14
      ctx.shadowOffsetY = 6
      drawItem(ctx, cfg, item, held, 1.08, 1, realNow)
      ctx.restore()
    }
  }
}

let tutorialHandImg: HTMLImageElement | null = null

function tutorialHandImage(): HTMLImageElement | null {
  const host = globalThis as { Image?: new () => HTMLImageElement; document?: Document }
  if (!host.document || typeof host.Image !== 'function') return null
  if (!tutorialHandImg) {
    tutorialHandImg = new host.Image()
    tutorialHandImg.src = tutorialHandUrl
  }
  return tutorialHandImg
}

const HAND_TIP = { x: 8 / 284, y: 14 / 310 }
const HAND_ASPECT = 284 / 310

function drawSpawnClock(ctx: CanvasRenderingContext2D, box: Rect, left: number, total: number): void {
  const mark = placedRect(box, producerBoltPlace())
  const size = Math.min(mark.w, mark.h)
  const x = mark.x + (mark.w - size) / 2
  const y = mark.y + (mark.h - size) / 2
  const cx = x + size * 0.5
  const cy = y + size * 0.5
  const r = size * 0.42
  const ratio = Math.max(0, Math.min(1, left / Math.max(1, total)))
  ctx.save()
  ctx.beginPath()
  ctx.fillStyle = '#fffaf3'
  ctx.arc(cx, cy, r + size * 0.06, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.strokeStyle = '#e4d3bc'
  ctx.lineWidth = Math.max(2, size * 0.14)
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = '#e08a14'
  ctx.lineCap = 'round'
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
  ctx.stroke()
  ctx.restore()
}

let iconBoltImg: HTMLImageElement | null = null

function iconBoltImage(): HTMLImageElement | null {
  const host = globalThis as { Image?: new () => HTMLImageElement; document?: Document }
  if (!host.document || typeof host.Image !== 'function') return null
  if (!iconBoltImg) {
    iconBoltImg = new host.Image()
    iconBoltImg.src = iconBoltUrl
  }
  return iconBoltImg
}

function drawSpawnBolt(ctx: CanvasRenderingContext2D, box: Rect): void {
  const rect = placedRect(box, producerBoltPlace())
  const img = iconBoltImage()
  if (img && (img.naturalWidth || 0) > 0) ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h)
}

function paintHand(ctx: CanvasRenderingContext2D, x: number, y: number, cell = 0): void {
  const h = Math.max(44, cell || 54)
  const w = h * HAND_ASPECT
  const img = tutorialHandImage()
  if (img && (img.naturalWidth || 0) > 0) {
    ctx.drawImage(img, x - HAND_TIP.x * w, y - HAND_TIP.y * h, w, h)
    return
  }
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#fffaf3'
  ctx.strokeStyle = PAL.ink
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(0, 6, 11, 13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(0, -12, 4, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawInfo(model: RenderModel): void {
  const { ctx, frame, state, cfg, selected } = model
  if (frame.infoBar.h <= 0) return
  const bar = frame.infoBar
  if (frame.mode !== 'board') {
    roundRect(ctx, bar.x, bar.y, bar.w, bar.h, 10)
    ctx.fillStyle = '#fff6e8'
    ctx.fill()
    ctx.strokeStyle = '#e0c8a0'
    ctx.stroke()
  }
  const sale = state.sale
  if (sale) {
    text(ctx, cfg.copy.infoSold, bar.x + 12, bar.y + bar.h / 2, 14, PAL.ink, 'left')
    roundRect(ctx, frame.sellBtn.x, frame.sellBtn.y, frame.sellBtn.w, frame.sellBtn.h, 8)
    ctx.fillStyle = '#3d6ea8'
    ctx.fill()
    text(ctx, '撤回', frame.sellBtn.x + frame.sellBtn.w / 2, frame.sellBtn.y + frame.sellBtn.h * 0.38, 12, PAL.white)
    text(ctx, `-${sale.coins}`, frame.sellBtn.x + frame.sellBtn.w / 2, frame.sellBtn.y + frame.sellBtn.h * 0.72, 11, PAL.white)
    return
  }
  const item = selected ? state.board[selected.row]?.[selected.col] : null
  const lock = selected ? state.locks.find((entry) => entry.row === selected.row && entry.col === selected.col) : undefined
  const gift = lock?.cover === 'gift' ? lock : undefined
  if (!item && !lock && model.orderFocus) {
    const focus = model.orderFocus
    text(ctx, productName(cfg, focus.line, focus.level), bar.x + 12, bar.y + bar.h * 0.38, 16, PAL.ink, 'left')
    text(ctx, cnLevel(focus.level), bar.x + 12, bar.y + bar.h * 0.72, 13, PAL.soft, 'left')
    return
  }
  if (!item && !lock) {
    text(ctx, INFO_EMPTY, bar.x + 12, bar.y + bar.h / 2, 14, PAL.soft, 'left')
    return
  }
  if (!item && gift) {
    const cooling = gift.giftUntil != null && gift.giftUntil > model.realNow
    text(ctx, '礼物', bar.x + 12, bar.y + bar.h * 0.38, 16, PAL.ink, 'left')
    text(ctx, cooling ? '冷却中' : '点一下开始冷却', bar.x + 12, bar.y + bar.h * 0.72, 12, PAL.soft, 'left')
  } else if (!item && lock && lock.veil !== 'full') {
    const buried = buriedPreview(lock)
    if (buried) {
      const info = infoCaption(cfg, buried, model.realNow)
      text(ctx, info.title, bar.x + 12, bar.y + bar.h * 0.38, 16, PAL.ink, 'left')
      text(ctx, `半遮掩 · ${info.usage}`, bar.x + 12, bar.y + bar.h * 0.72, 12, PAL.soft, 'left')
    }
  } else if (item) {
    const info = infoCaption(cfg, item, model.realNow)
    let textX = bar.x + 12
    if (item.kind === 'potion') {
      const art = potionSprite(item.tier)
      const side = bar.h * 0.92
      if (art) {
        drawFittedSprite(ctx, art, { x: bar.x + 6, y: bar.y + (bar.h - side) / 2, w: side, h: side }, PIECE_FILL)
        textX = bar.x + side + 14
      }
    }
    text(ctx, info.title, textX, bar.y + bar.h * 0.38, 16, PAL.ink, 'left')
    text(ctx, info.usage, textX, bar.y + bar.h * 0.72, 12, PAL.soft, 'left')
  }
  if (frame.rushBtn.w > 0) {
    const free = atStep(state, cfg, 'giftRush')
    const btn = frame.rushBtn
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8)
    ctx.fillStyle = '#3d6ea8'
    ctx.fill()
    if (free) text(ctx, '免费', btn.x + btn.w / 2, btn.y + btn.h / 2, 13, PAL.white)
    else {
      const cx = btn.x + 16
      const cy = btn.y + btn.h / 2
      ctx.beginPath()
      ctx.moveTo(cx, cy - 6)
      ctx.lineTo(cx + 6, cy)
      ctx.lineTo(cx, cy + 6)
      ctx.lineTo(cx - 6, cy)
      ctx.closePath()
      ctx.fillStyle = '#9fd4ff'
      ctx.fill()
      text(ctx, String(cfg.economy.giftRushGems), btn.x + btn.w / 2 + 6, cy, 14, PAL.white)
    }
    roundRect(ctx, frame.adBtn.x, frame.adBtn.y, frame.adBtn.w, frame.adBtn.h, 8)
    ctx.fillStyle = '#c4552a'
    ctx.fill()
    text(ctx, '广告', frame.adBtn.x + frame.adBtn.w / 2, frame.adBtn.y + frame.adBtn.h / 2, 11, PAL.white)
  }
  if (item && state.phase === 'play' && item.kind === 'producer') {
    roundRect(ctx, frame.chainBtn.x, frame.chainBtn.y, frame.chainBtn.w, frame.chainBtn.h, 9)
    ctx.fillStyle = '#3d6ea8'
    ctx.fill()
    text(ctx, 'i', frame.chainBtn.x + frame.chainBtn.w / 2, frame.chainBtn.y + frame.chainBtn.h / 2, 13, PAL.white)
  }
  if (item?.kind === 'product' && canSell(state, item)) {
    roundRect(ctx, frame.sellBtn.x, frame.sellBtn.y, frame.sellBtn.w, frame.sellBtn.h, 8)
    ctx.fillStyle = '#2c7a58'
    ctx.fill()
    text(ctx, '卖出', frame.sellBtn.x + frame.sellBtn.w / 2, frame.sellBtn.y + frame.sellBtn.h * 0.38, 12, PAL.white)
    text(ctx, String(sellPriceOf(cfg, item.level)), frame.sellBtn.x + frame.sellBtn.w / 2, frame.sellBtn.y + frame.sellBtn.h * 0.72, 11, PAL.white)
  }
}

function drawTutorial(model: RenderModel): void {
  const { ctx, frame, state, cfg, realNow } = model
  if (state.phase !== 'opening') return
  if (state.lesson === 'talk1' || state.lesson === 'focus' || state.lesson === 'deliver' || state.lesson === 'book' || state.lesson === 'home1' || state.lesson === 'home2' || state.lesson === 'home3') return
  const step = currentTutorial(cfg, state)
  if (!step) return
  if (step?.id === 'giftRush') {
    const hole = guideHole(frame, state, cfg) ?? frame.rushBtn
    if (hole.w <= 0) return
    ctx.save()
    ctx.fillStyle = 'rgba(12,10,8,0.72)'
    ctx.beginPath()
    ctx.rect(0, 0, frame.w, frame.h)
    ctx.moveTo(hole.x + hole.w, hole.y)
    ctx.arcTo(hole.x, hole.y, hole.x, hole.y + hole.h, 8)
    ctx.arcTo(hole.x, hole.y + hole.h, hole.x + hole.w, hole.y + hole.h, 8)
    ctx.arcTo(hole.x + hole.w, hole.y + hole.h, hole.x + hole.w, hole.y, 8)
    ctx.arcTo(hole.x + hole.w, hole.y, hole.x + hole.w, hole.y + hole.h, 8)
    ctx.fill('evenodd')
    ctx.restore()
    paintHand(ctx, hole.x + hole.w / 2, hole.y + hole.h / 2, frame.board.cell)
    return
  }
  const holes = tutorialHoles(model)
  ctx.save()
  ctx.fillStyle = 'rgba(12,10,8,0.72)'
  ctx.beginPath()
  ctx.rect(0, 0, frame.w, frame.h)
  for (const hole of holes) {
    ctx.moveTo(hole.x + hole.w, hole.y)
    ctx.arcTo(hole.x, hole.y, hole.x, hole.y + hole.h, 8)
    ctx.arcTo(hole.x, hole.y + hole.h, hole.x + hole.w, hole.y + hole.h, 8)
    ctx.arcTo(hole.x + hole.w, hole.y + hole.h, hole.x + hole.w, hole.y, 8)
    ctx.arcTo(hole.x + hole.w, hole.y, hole.x + hole.w, hole.y + hole.h, 8)
  }
  ctx.fill('evenodd')
  ctx.restore()
  const pose = tutorialHand(cfg, state, frame, realNow)
  if (pose?.visible) paintHand(ctx, pose.x, pose.y, frame.board.cell)
}

function tutorialHoles(model: RenderModel): Rect[] {
  const { frame, state, cfg } = model
  const holes: Rect[] = []
  const spot = (row: number, col: number) => {
    const box = cellBox(frame, row, col)
    holes.push({ x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 })
  }
  const step = currentTutorial(cfg, state)
  if (step?.id === 'enter') holes.push(frame.enterBtn)
  if (step?.id === 'merge') {
    spot(cfg.board.roles.mergeA.row, cfg.board.roles.mergeA.col)
    spot(cfg.board.roles.mergeB.row, cfg.board.roles.mergeB.col)
  }
  if (step?.id === 'mergeC' || step?.id === 'unlock') {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'producer' && item.producerId === 'food' && item.level === 2) spot(row, col)
      }
    }
    spot(cfg.board.roles.unlock.row, cfg.board.roles.unlock.col)
  }
  if (step?.id === 'mergeD' && cfg.board.roles.mergeD) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'producer' && item.producerId === 'food' && item.level === 3) spot(row, col)
      }
    }
    spot(cfg.board.roles.mergeD.row, cfg.board.roles.mergeD.col)
  }
  if (step?.id === 'producerL2' || step?.id === 'producerL3') {
    let level2 = 0
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'producer' && item.producerId === 'food' && item.level === 2) level2 += 1
      }
    }
    const showLevel = step.id === 'producerL3' && level2 >= 2 ? 2 : 1
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'producer' && item.producerId === 'food' && item.level === showLevel) spot(row, col)
      }
    }
  }
  if (step?.id === 'produce') {
    let found = false
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'producer' && item.level >= cfg.economy.producerSpawnLevel) {
          spot(row, col)
          found = true
        }
      }
    }
    if (!found) spot(cfg.board.roles.producer.row, cfg.board.roles.producer.col)
  }
  if (step?.id === 'deliver' && frame.completes[0]) holes.push(frame.completes[0])
  if (step?.id === 'stashIn') {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'product' && item.tag !== 'bag') spot(row, col)
      }
    }
    holes.push(frame.pendingBtn)
  }
  if (step?.id === 'stashOut') holes.push(frame.pendingBtn)
  if (step?.id === 'bagMerge') {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const item = state.board[row]?.[col]
        if (item?.kind === 'product' && item.tag === 'bag') spot(row, col)
      }
    }
  }
  if (step?.id === 'giftTap') spot(cfg.board.roles.gift.row, cfg.board.roles.gift.col)
  if (step?.id === 'build') holes.push(frame.houseBtn)
  holes.push(frame.skip)
  return holes.filter((hole) => hole.w > 0)
}

function drawStorageLesson(model: RenderModel): void {
  const { ctx, frame, state, cfg, realNow } = model
  const lesson = state.storageLesson
  if (state.phase !== 'play' || lesson < 1 || lesson > 3) return
  if (guideHole(frame, state, cfg)) return
  const step = cfg.copy.storageLesson[lesson - 1] ?? ''
  ctx.save()
  ctx.fillStyle = 'rgba(12,10,8,0.72)'
  ctx.beginPath()
  ctx.rect(0, 0, frame.w, frame.h)
  const holes = [frame.skip]
  if (lesson >= 2) holes.push(frame.pendingBtn)
  if (lesson === 2) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const item = state.board[row]?.[col]
        if (item) {
          const box = cellBox(frame, row, col)
          holes.push({ x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 })
        }
      }
    }
  }
  for (const hole of holes) {
    if (hole.w <= 0) continue
    ctx.moveTo(hole.x + hole.w, hole.y)
    ctx.arcTo(hole.x, hole.y, hole.x, hole.y + hole.h, 8)
    ctx.arcTo(hole.x, hole.y + hole.h, hole.x + hole.w, hole.y + hole.h, 8)
    ctx.arcTo(hole.x + hole.w, hole.y + hole.h, hole.x + hole.w, hole.y, 8)
    ctx.arcTo(hole.x + hole.w, hole.y, hole.x + hole.w, hole.y + hole.h, 8)
  }
  ctx.fill('evenodd')
  ctx.restore()
  const card = { x: 12, y: frame.dock.y - (lesson === 1 ? 112 : 88), w: frame.w - 24, h: lesson === 1 ? 100 : 76 }
  roundRect(ctx, card.x, card.y, card.w, card.h, 12)
  ctx.fillStyle = PAL.white
  ctx.fill()
  const lines = wrap(ctx, step, card.w - 24, 15)
  lines.slice(0, 3).forEach((line, i) => text(ctx, line, card.x + 12, card.y + 22 + i * 20, 15, PAL.ink, 'left'))
  if (lesson === 1) text(ctx, '点击任意处继续', card.x + card.w / 2, card.y + card.h - 16, 13, PAL.soft)
  const pose = storageLessonHand(state, frame, realNow)
  if (pose?.visible) paintHand(ctx, pose.x, pose.y, frame.board.cell)
}

function drawHand(model: RenderModel): void {
  if (!model.showHand || model.state.phase !== 'play' || model.chain) return
  if (model.state.storageLesson > 0 && model.state.storageLesson < 4) return
  if (model.state.mintStep === 'select' || model.state.mintStep === 'produce' || model.state.mintStep === 'merge' || model.state.mintStep === 'deliver') return
  if (guideHole(model.frame, model.state, model.cfg)) return
  const hint = pickHint(model.state, model.realNow)
  if (!hint) return
  const pose = hintHand(hint, model.frame, model.realNow)
  if (!pose?.visible) return
  paintHand(model.ctx, pose.x, pose.y, model.frame.board.cell)
}

function drawLevelModal(model: RenderModel): void {
  const modal = model.state.levelModal
  if (!modal) return
  const { ctx, frame } = model
  ctx.fillStyle = 'rgba(12,10,8,0.55)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  const card = { x: 28, y: frame.h / 2 - 140, w: frame.w - 56, h: 250 }
  roundRect(ctx, card.x, card.y, card.w, card.h, 14)
  ctx.fillStyle = PAL.white
  ctx.fill()
  text(ctx, `升到${cnLevel(modal.level)}`, card.x + card.w / 2, card.y + 32, 20, PAL.ink)
  modal.rewards.forEach((reward, index) => {
    text(ctx, reward.name, card.x + card.w / 2, card.y + 72 + index * 28, 16, PAL.ink)
  })
  button(ctx, levelClaimRect(frame), '收下', 'primary')
}

function drawSmileModal(model: RenderModel): void {
  const modal = model.state.smileModal
  if (!modal) return
  const { ctx, frame } = model
  ctx.fillStyle = 'rgba(12,10,8,0.55)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  const card = { x: 24, y: frame.h / 2 - 150, w: frame.w - 48, h: 280 }
  roundRect(ctx, card.x, card.y, card.w, card.h, 14)
  ctx.fillStyle = PAL.white
  ctx.fill()
  text(ctx, `笑脸开奖 · ${modal.names.length} 个`, card.x + card.w / 2, card.y + 28, 18, PAL.ink)
  modal.names.slice(0, 8).forEach((name, index) => {
    text(ctx, name, card.x + 20 + (index % 2) * (card.w / 2 - 10), card.y + 64 + Math.floor(index / 2) * 26, 14, PAL.ink, 'left')
  })
  button(ctx, smileDismissRect(frame), '放进奖励栏', 'primary')
}


function drawChain(model: RenderModel): void {
  const chain = model.chain
  if (!chain) return
  const { ctx, frame, cfg, state } = model
  ctx.fillStyle = 'rgba(12,10,8,0.55)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  const card = chainCardRect(frame)
  roundRect(ctx, card.x, card.y, card.w, card.h, 16)
  ctx.fillStyle = '#fff6e8'
  ctx.fill()
  const close = chainCloseRect(frame)
  button(ctx, close, '×', 'ghost')
  if (chain.source === 'producer') {
    const producer = producerOfLine(cfg, chain.line)
    const name = producer ? (producerPieceName(producer.id, chain.level) ?? producerName(cfg, producer.id)) : '母棋'
    text(ctx, name, card.x + card.w / 2, card.y + 36, 20, PAL.ink)
    text(ctx, `等级 ${chain.level}`, card.x + card.w / 2, card.y + 62, 14, PAL.soft)
    const slots = producerChain(state, producer?.id ?? chain.line, chain.level, cfg.economy.producerMaxLevel)
    slots.forEach((slot, index) => {
      const col = index % 4
      const row = Math.floor(index / 4)
      const x = card.x + 28 + col * 74
      const y = card.y + 84 + row * 70
      roundRect(ctx, x, y, 62, 58, 8)
      ctx.fillStyle = slot.seen ? '#fffaf3' : '#c8b89a'
      ctx.fill()
      const art = producer ? producerSprite(producer.id, slot.level) : null
      const place = producer ? producerPlace(producer.id, slot.level) : null
      if (art && place && slot.seen) {
        const rect = placedRect({ x, y, w: 62, h: 58 }, place)
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, 62, 58)
        ctx.clip()
        ctx.drawImage(art as CanvasImageSource, rect.x, rect.y, rect.w, rect.h)
        ctx.restore()
      } else text(ctx, slot.label, x + 31, y + 29, 16, PAL.white)
      if (slot.current) {
        ctx.lineWidth = 3
        ctx.strokeStyle = '#3d6ea8'
        ctx.stroke()
      }
    })
    let cursor = card.y + 240
    if (chain.level >= cfg.economy.producerSpawnLevel) {
      text(ctx, '可生成：', card.x + 24, cursor, 15, PAL.ink, 'left')
      producerOutputs(cfg, state, chain.line, chain.level).forEach((slot, index) => {
        const x = card.x + 24 + index * 72
        const y = cursor + 16
        roundRect(ctx, x, y, 60, 52, 8)
        ctx.fillStyle = slot.seen ? lineColor(cfg, chain.line) : '#c8b89a'
        ctx.fill()
        text(ctx, slot.label, x + 30, y + 26, 13, PAL.white)
      })
      cursor += 84
    }
    text(ctx, '升级后额外生成：', card.x + 24, cursor, 15, PAL.ink, 'left')
    roundRect(ctx, card.x + 24, cursor + 16, 88, 52, 8)
    ctx.fillStyle = '#c8b89a'
    ctx.fill()
    text(ctx, cfg.copy.producerExtra, card.x + 68, cursor + 42, 12, PAL.white)
    return
  }
  const slots = lineChain(cfg, state, chain.line, chain.level)
  const current = slots.find((slot) => slot.current)
  text(ctx, current?.label ?? '?', card.x + card.w / 2, card.y + 36, 20, PAL.ink)
  text(ctx, `等级 ${chain.level}`, card.x + card.w / 2, card.y + 64, 14, PAL.soft)
  slots.forEach((slot, index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    const x = card.x + 24 + col * 76
    const y = card.y + 92 + row * 76
    roundRect(ctx, x, y, 64, 64, 8)
    ctx.fillStyle = slot.seen ? lineColor(cfg, chain.line) : '#c8b89a'
    ctx.fill()
    if (slot.current) {
      ctx.lineWidth = 3
      ctx.strokeStyle = '#3d6ea8'
      ctx.stroke()
    }
    text(ctx, slot.label, x + 32, y + 32, 13, PAL.white)
  })
  const producer = producerOfLine(cfg, chain.line)
  text(ctx, '产自：', card.x + card.w / 2, card.y + card.h - 92, 15, PAL.ink)
  if (producer) {
    const x = card.x + card.w / 2 - 28
    const y = card.y + card.h - 76
    roundRect(ctx, x, y, 56, 56, 8)
    ctx.fillStyle = lineColor(cfg, chain.line)
    ctx.fill()
    text(ctx, producer.name.slice(0, 2), x + 28, y + 22, 13, PAL.white)
    text(ctx, producer.name, card.x + card.w / 2, y + 68, 12, PAL.ink)
  }
}

function drawSheet(model: RenderModel): void {
  if (model.frame.sheet.h <= 0) return
  const { ctx, frame, cfg, state } = model
  const task = cfg.buildings.steps[0]?.tasks[0]
  roundRect(ctx, frame.sheet.x, frame.sheet.y, frame.sheet.w, frame.sheet.h, 14)
  ctx.fillStyle = PAL.white
  ctx.fill()
  ctx.strokeStyle = PAL.ink
  ctx.lineWidth = 1.5
  ctx.stroke()
  button(ctx, frame.sheetSkip, '跳过', 'ghost')
  const price = task ? taskPrice(task, cfg) : 0
  const afford = state.coins >= price
  button(ctx, frame.sheetBtn, `${task?.name ?? '挂招牌'} · ${price} 铜钱`, afford ? 'primary' : 'ghost')
}

export function worldToScreen(frame: Frame, cam: RenderModel['cam'], x: number, y: number): { x: number; y: number } {
  const cx = frame.map.x + frame.map.w / 2
  const cy = frame.map.y + frame.map.h / 2
  return { x: cx + (x - cam.x) * cam.scale, y: cy + (y - cam.y) * cam.scale }
}

interface Part {
  task: string | null
  x: number
  y: number
  w: number
  h: number
  label: string
  fill: string
}

const PARTS: Part[] = [
  { task: null, x: 520, y: 760, w: 360, h: 420, label: '铺基', fill: '#ead9b8' },
  { task: 't7', x: 520, y: 1124, w: 360, h: 52, label: '青砖', fill: '#8d8f93' },
  { task: 't5', x: 540, y: 800, w: 320, h: 34, label: '梁', fill: '#8a5a32' },
  { task: 't9', x: 500, y: 820, w: 34, h: 320, label: '柱', fill: '#6b3a2a' },
  { task: 't9', x: 866, y: 820, w: 34, h: 320, label: '柱', fill: '#6b3a2a' },
  { task: 't3', x: 548, y: 900, w: 88, h: 120, label: '窗纸', fill: '#d7e4de' },
  { task: 't3', x: 764, y: 900, w: 88, h: 120, label: '窗纸', fill: '#d7e4de' },
  { task: 't2', x: 650, y: 980, w: 100, h: 150, label: '门板', fill: '#a96b3c' },
  { task: 't8', x: 656, y: 990, w: 88, h: 130, label: '门扇', fill: '#6e4428' },
  { task: 't4', x: 662, y: 860, w: 76, h: 70, label: '门帘', fill: '#c4552a' },
  { task: 't6', x: 600, y: 778, w: 200, h: 26, label: '装饰', fill: '#c4a46a' },
  { task: 't1', x: 590, y: 690, w: 220, h: 62, label: '招牌', fill: '#9c2f2f' },
  { task: 't12', x: 630, y: 610, w: 140, h: 58, label: '匾额', fill: '#1f4d3a' },
  { task: 't10', x: 448, y: 760, w: 46, h: 62, label: '宫灯', fill: '#d4652f' },
  { task: 't10', x: 906, y: 760, w: 46, h: 62, label: '宫灯', fill: '#d4652f' },
  { task: 't11', x: 560, y: 1200, w: 84, h: 48, label: '茶座', fill: '#2a7a68' },
  { task: 't11', x: 756, y: 1200, w: 84, h: 48, label: '茶座', fill: '#2a7a68' },
]

const SWATCHES = [
  { id: 'amber', label: '暖黄', fill: '#f0c14a' },
  { id: 'green', label: '青碧', fill: '#3dba7a' },
  { id: 'lilac', label: '藕紫', fill: '#c06ad4' },
]

function swatchOf(id: string | null | undefined): { label: string; fill: string } | null {
  return SWATCHES.find((entry) => entry.id === id) ?? null
}

export function partLook(state: GameState, cfg: GameConfig, part: Part): { label: string; fill: string } {
  const task = part.task ? allTasks(cfg).find((entry) => entry.id === part.task) : null
  const preview = state.decorate && state.decorate.taskId === part.task ? task?.choices?.[state.decorate.index]?.id : null
  const chosen = preview ?? (part.task ? state.styles[part.task] : null)
  const swatch = swatchOf(chosen)
  if (swatch) return { label: part.label, fill: swatch.fill }
  return { label: part.label, fill: part.fill }
}

function paintHomeImg(ctx: CanvasRenderingContext2D, id: HomeArtId, box: HomeBox, alpha = 1): void {
  const img = homeArt[id]
  if (!img || alpha <= 0 || (img.naturalWidth || 0) <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(img, box.x, box.y, box.w, box.h)
  ctx.restore()
}

function drawHouse(model: RenderModel): void {
  const { ctx, frame, state, cfg, realNow } = model
  const home = homePlaces(frame.w, frame.h)
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, frame.w, frame.h)
  paintHomeImg(ctx, 'bg', home.bg)
  paintHomeImg(ctx, 'storage', home.storage)
  paintHomeImg(ctx, 'build', home.build)
  const avatar = home.avatar
  const avatarArt = {
    x: avatar.x + (12 / 149) * avatar.w,
    y: avatar.y + (15 / 149) * avatar.h,
    w: (125 / 149) * avatar.w,
    h: (126 / 149) * avatar.h,
  }
  const badge = {
    x: avatar.x + (102 / 149) * avatar.w,
    y: avatar.y + (100 / 149) * avatar.h,
    w: (47 / 149) * avatar.w,
    h: (47 / 149) * avatar.h,
  }
  const portrait = hechengImage('avatar')
  if (portrait) drawAvatar(ctx, portrait, avatarArt, realNow)
  blit(ctx, 'avatarFrame', avatar)
  blit(ctx, 'levelBadge', badge)
  const levelText = String(state.level)
  const levelSize = badge.w * (levelText.length >= 3 ? 0.34 : 0.46)
  ctx.lineWidth = Math.max(2, levelSize * 0.16)
  ctx.strokeStyle = '#6a3a22'
  ctx.font = `700 ${Math.round(levelSize)}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(levelText, badge.x + badge.w / 2, badge.y + badge.h / 2)
  ctx.fillStyle = '#fffaf2'
  ctx.fillText(levelText, badge.x + badge.w / 2, badge.y + badge.h / 2)
  blit(ctx, 'energy', home.energy)
  blit(ctx, 'coin', home.coin)
  blit(ctx, 'gem', home.gem)
  const num = (rect: Rect, value: string) => {
    text(ctx, value, rect.x + rect.w * 0.58 + 1, rect.y + rect.h / 2 + 1, rect.h * 0.42, 'rgba(40,24,12,0.45)', 'center', 'middle', 700)
    text(ctx, value, rect.x + rect.w * 0.58, rect.y + rect.h / 2, rect.h * 0.42, '#fffaf2', 'center', 'middle', 700)
  }
  num(home.energy, String(state.energy))
  num(home.coin, String(Math.max(0, state.coins - model.fx.incoming)))
  num(home.gem, String(state.gems))
  paintHomeImg(ctx, 'settings', home.settings)
  paintHomeImg(ctx, 'shop', home.shop)
  paintHomeImg(ctx, 'badge', home.badgeSettings)
  paintHomeImg(ctx, 'badge', home.badgeShop)
  const lesson = state.lesson
  const dim = lesson === 'home1' || lesson === 'home2' || lesson === 'home3'
  if (dim) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, frame.w, frame.h)
    const art = lesson === 'home2' ? 'home2' : lesson === 'home3' ? 'home3' : 'home1'
    paintHomeImg(ctx, art, home.dialog)
    if (lesson === 'home1' || lesson === 'home3') {
      paintHomeImg(ctx, 'build', home.build)
      const poke = arrowPoke(realNow)
      paintHomeImg(ctx, 'arrow', {
        x: home.arrow.x + poke.x * home.fit.scale,
        y: home.arrow.y + poke.y * home.fit.scale,
        w: home.arrow.w,
        h: home.arrow.h,
      })
    }
  }
  const age = (realNow - (model.settingsAt ?? 0)) / 220
  const eased = easeOutCubic(Math.max(0, Math.min(1, age)))
  const menuT = model.settingsOpen ? eased : 1 - eased
  if (menuT > 0.02) {
    const menu = home.menu
    const button = home.settings
    const bx = button.x + button.w / 2
    const by = button.y + button.h / 2
    const cx = menu.x + menu.w / 2
    const cy = menu.y + menu.h / 2
    ctx.save()
    ctx.translate(bx + (cx - bx) * menuT, by + (cy - by) * menuT)
    ctx.scale(menuT, menuT)
    const img = homeArt.menu
    if (img && (img.naturalWidth || 0) > 0) ctx.drawImage(img, -menu.w / 2, -menu.h / 2, menu.w, menu.h)
    ctx.restore()
  }
  void cfg
}

function lessonDialogBox(model: RenderModel): Rect | null {
  const { frame, state, cfg } = model
  const scale = frame.w / 1080
  const box = { x: 47 * scale, y: 80, w: 986 * scale, h: 702 * scale }
  const lesson = state.lesson
  const above = (rects: Rect[]) => {
    const top = Math.min(...rects.map((rect) => rect.y))
    box.y = Math.max(frame.hud.y + frame.hud.h + 4, top - box.h - 12)
  }
  if (lesson === 'merge' || lesson === 'mergeC' || lesson === 'mergeD' || lesson === 'focus') {
    const holes = lesson === 'focus' ? [focusRect(model)].filter((rect): rect is Rect => !!rect) : tutorialHoles(model)
    if (holes.length) above(holes)
    else box.y = frame.board.y - box.h - 8
    return box
  }
  if (lesson === 'talk1') {
    box.y = Math.max(frame.hud.y + frame.hud.h + 8, frame.board.y * 0.35)
    return box
  }
  if (lesson === 'deliver') {
    box.y = frame.orderClip.y + frame.orderClip.h + 8
    return box
  }
  if (lesson === 'book' && frame.storyBtn.w > 0) {
    box.y = frame.storyBtn.y + frame.storyBtn.h + 8
    return box
  }
  void cfg
  return null
}

function focusRect(model: RenderModel): Rect | null {
  const { frame, state, cfg } = model
  let row = cfg.board.roles.producer.row
  let col = cfg.board.roles.producer.col
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const item = state.board[r]?.[c]
      if (item?.kind === 'producer' && item.producerId === 'food' && item.level >= 4) {
        row = r
        col = c
      }
    }
  }
  const cells = [{ row, col }]
  for (const [dr, dc] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nr = row + dr
    const nc = col + dc
    if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS) continue
    const lock = lockAt(state, nr, nc)
    if (!lock || lock.veil === 'half') cells.push({ row: nr, col: nc })
  }
  const rects = cells.map((cell) => cellRect(frame, cell.row, cell.col))
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.w))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h))
  return { x: x - 6, y: y - 6, w: right - x + 12, h: bottom - y + 12 }
}

function punchHole(ctx: CanvasRenderingContext2D, view: Rect, hole: Rect | null): void {
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.beginPath()
  ctx.rect(view.x, view.y, view.w, view.h)
  if (hole && hole.w > 0) {
    ctx.moveTo(hole.x + hole.w, hole.y)
    ctx.arcTo(hole.x, hole.y, hole.x, hole.y + hole.h, 10)
    ctx.arcTo(hole.x, hole.y + hole.h, hole.x + hole.w, hole.y + hole.h, 10)
    ctx.arcTo(hole.x + hole.w, hole.y + hole.h, hole.x + hole.w, hole.y, 10)
    ctx.arcTo(hole.x + hole.w, hole.y, hole.x + hole.w, hole.y + hole.h, 10)
  }
  ctx.fill('evenodd')
  ctx.restore()
}

function drawLesson(model: RenderModel): void {
  const { ctx, frame, state, cfg } = model
  const lesson = state.lesson
  if (!lesson || lesson === 'free' || lesson === 'home1' || lesson === 'home2' || lesson === 'home3') return
  if (lesson === 'merge' || lesson === 'mergeC' || lesson === 'mergeD') {
    const id = lesson === 'merge' ? 'tut2' : lesson === 'mergeC' ? 'tut3' : null
    const box = lessonDialogBox(model)
    if (id && box) paintHomeImg(ctx, id, box)
    return
  }
  if (lesson === 'talk1') {
    punchHole(ctx, { x: 0, y: 0, w: frame.w, h: frame.h }, null)
    const box = lessonDialogBox(model)
    if (box) paintHomeImg(ctx, 'tut1', box)
    return
  }
  if (lesson === 'focus') {
    const hole = focusRect(model)
    const board = {
      x: frame.board.x,
      y: frame.board.y,
      w: frame.board.cell * COLS,
      h: frame.board.cell * ROWS,
    }
    punchHole(ctx, board, hole)
    const box = lessonDialogBox(model)
    if (box) paintHomeImg(ctx, 'tut4', box)
    if (hole) paintHand(ctx, hole.x + hole.w / 2, hole.y + hole.h * 0.45, frame.board.cell)
    return
  }
  if (lesson === 'deliver') {
    punchHole(ctx, { x: 0, y: 0, w: frame.w, h: frame.h }, null)
    paintLiftedOrder(model, 0)
    const box = lessonDialogBox(model)
    if (box) paintHomeImg(ctx, 'tut5', box)
    const button = frame.completes[0]
    if (button) paintHand(ctx, button.x + button.w / 2, button.y + button.h / 2, frame.board.cell)
    return
  }
  if (lesson === 'book') {
    punchHole(ctx, { x: 0, y: 0, w: frame.w, h: frame.h }, null)
    if (frame.storyBtn.w > 0) {
      blit(ctx, 'chestFrame', frame.storyBtn)
      blit(ctx, 'book', frame.bookIcon)
      blit(ctx, 'badgeSmall', frame.badgeStory)
    }
    const box = lessonDialogBox(model)
    if (box) paintHomeImg(ctx, 'tut6', box)
    if (frame.storyBtn.w > 0) paintHand(ctx, frame.storyBtn.x + frame.storyBtn.w / 2, frame.storyBtn.y + frame.storyBtn.h / 2, frame.board.cell)
  }
  void cfg
}

function paintLiftedOrder(model: RenderModel, index: number): void {
  const { ctx, frame, state, cfg, realNow } = model
  const order = state.orders[index]
  const guest = frame.orderGuests[index]
  if (!order || !guest) return
  const who = cfg.characters.find((entry) => entry.id === order.customerId)
  const firstOrder = order.scripted === true
  const portrait = firstOrder ? firstOrderGuestPortrait() : guestPortrait(who?.portrait)
  if ((who || firstOrder) && portrait && portraitReady(portrait)) {
    const table = frame.tableSlots[index]
    drawCharacter(ctx, firstOrder ? 'xiaotao' : who?.portrait, portrait, guest, realNow, 'contain', {
      tableCenterX: table ? table.x + table.w / 2 : guest.x + guest.w / 2,
      nudgeX: cfg.economy.guestNudgeX ?? 0,
    })
  }
  const plate = frame.tableSlots[index]
  if (plate) blit(ctx, 'plate', plate)
  order.slots.forEach((slot, slotIndex) => {
    const icon = frame.orderIcons.find((entry) => entry.order === index && entry.slot === slotIndex)
    if (!icon) return
    const sprite = itemSprite(slot.line, slot.level)
    if (sprite) drawFittedSprite(ctx, sprite, icon.rect, 1)
  })
  const payRect = frame.orderRewards[index]
  if (payRect) {
    blit(ctx, 'bubble', payRect)
    const pay = orderPayout(order, cfg)
    text(ctx, `+${pay.coins}`, payRect.x + payRect.w * 0.72, payRect.y + payRect.h * 0.48, Math.max(10, payRect.h * 0.28), '#6a3a22', 'right', 'middle', 700)
  }
  const button = frame.completes[index]
  if (button && orderSatisfied(state, order)) blit(ctx, 'complete', button)
}
function flyerPoint(flyer: Flyer, animNow: number): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, (animNow - flyer.birth) / Math.max(1, flyer.dur)))
  const eased = flyer.ease === 'spawn' ? easeOutBack(t) : easeOutCubic(t)
  return {
    x: flyer.fromX + (flyer.toX - flyer.fromX) * eased,
    y: flyer.fromY + (flyer.toY - flyer.fromY) * eased,
  }
}

function drawFx(model: RenderModel): void {
  const { ctx, frame, cfg, fx, animNow, realNow } = model
  const cell = frame.board.cell || 64
  for (const flyer of fx.flyers) {
    const point = flyerPoint(flyer, animNow)
    const box = { x: point.x - cell / 2, y: point.y - cell / 2, w: cell, h: cell }
    drawItem(ctx, cfg, flyer.item, box, 1, 1, realNow)
  }
  for (const particle of fx.particles) {
    const age = (animNow - particle.birth) / particle.life
    if (age < 0 || age > 1) continue
    ctx.beginPath()
    ctx.fillStyle = particle.color
    ctx.globalAlpha = 1 - age
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  for (const coin of fx.coins) {
    const age = animNow - coin.birth - coin.delay
    if (age < 0 || age > coin.dur) continue
    const t = easeInOut(Math.min(1, age / coin.dur))
    const mx = (coin.fromX + coin.toX) / 2 + coin.bend
    const my = Math.max(coin.fromY, coin.toY) + 280
    const u = 1 - t
    const x = u * u * coin.fromX + 2 * u * t * mx + t * t * coin.toX
    const y = u * u * coin.fromY + 2 * u * t * my + t * t * coin.toY
    ctx.beginPath()
    ctx.fillStyle = PAL.coin
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.fill()
    text(ctx, '钱', x, y, 9, PAL.white)
  }
  for (const floater of fx.floaters) {
    const age = animNow - floater.birth
    if (age < 0 || age > floater.dur) continue
    ctx.globalAlpha = 1 - age / floater.dur
    text(ctx, floater.text, floater.x, floater.y - age * 0.04, 16, floater.color)
    ctx.globalAlpha = 1
  }
  if (fx.banner && realNow < fx.banner.until) {
    const w = Math.min(frame.w - 24, 320)
    const rect = { x: (frame.w - w) / 2, y: frame.hud.y + frame.hud.h + 8, w, h: 36 }
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8)
    ctx.fillStyle = '#2a2118'
    ctx.fill()
    text(ctx, fx.banner.text, rect.x + rect.w / 2, rect.y + rect.h / 2, 14, PAL.white)
  }
}

function drawToasts(model: RenderModel): void {
  const { ctx, frame, fx, realNow } = model
  let y = frame.showTuner ? 18 : frame.hud.y + frame.hud.h + 8
  for (const toast of fx.toasts) {
    const age = realNow - toast.birth
    if (age < 0 || age > toast.dur) continue
    ctx.globalAlpha = age > toast.dur - 300 ? (toast.dur - age) / 300 : 1
    const w = Math.min(frame.w - 32, Math.max(120, toast.text.length * 16 + 28))
    roundRect(ctx, (frame.w - w) / 2, y, w, 32, 8)
    ctx.fillStyle = 'rgba(42,33,24,0.9)'
    ctx.fill()
    text(ctx, toast.text, frame.w / 2, y + 16, 14, PAL.white)
    ctx.globalAlpha = 1
    y += 38
  }
}

function drawHelp(model: RenderModel): void {
  const { ctx, frame } = model
  ctx.fillStyle = 'rgba(28,22,16,0.46)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  const card = frame.helpCard
  roundRect(ctx, card.x, card.y, card.w, card.h, 14)
  ctx.fillStyle = PAL.white
  ctx.fill()
  text(ctx, '温记点心铺', card.x + card.w / 2, card.y + 28, 18, PAL.ink)
  const body = '点砂锅拿出原料，两个一样的拖到一起合成。订单齐了点绿色完成。铜钱用来修铺子。'
  wrap(ctx, body, card.w - 36, 15).forEach((line, i) => {
    text(ctx, line, card.x + 18, card.y + 62 + i * 24, 15, PAL.ink, 'left', 'middle', 500)
  })
  button(ctx, frame.helpOk, '知道了', 'primary')
}

function drawChainPop(model: RenderModel): void {
  const pop = model.state.chainPop
  if (!pop || model.frame.mode !== 'board') return
  const { ctx, frame, cfg } = model
  const { card, close } = chainPopRect(frame)
  roundRect(ctx, card.x, card.y, card.w, card.h, 16)
  ctx.fillStyle = '#fff6e8'
  ctx.fill()
  ctx.strokeStyle = '#7a4ea3'
  ctx.lineWidth = 3
  ctx.stroke()
  button(ctx, close, '×', 'ghost')
  const gems = pop.kind === 'gem'
  const title = gems ? gemName(cfg, pop.tier) : potionName(cfg, pop.tier)
  text(ctx, title, card.x + card.w / 2, card.y + 28, 18, PAL.ink)
  text(ctx, `等级 ${pop.tier}`, card.x + card.w / 2, card.y + 50, 13, PAL.soft)
  const count = gems ? cfg.items.gems.length : cfg.items.potions.length
  for (let tier = 1; tier <= count; tier++) {
    const col = (tier - 1) % 5
    const x = card.x + 18 + col * 62
    const y = card.y + 70
    roundRect(ctx, x, y, 54, 54, 8)
    ctx.fillStyle = tier === pop.tier ? (gems ? '#d23b62' : '#fff6e8') : '#d9c7a4'
    ctx.fill()
    if (tier === pop.tier) {
      ctx.lineWidth = 3
      ctx.strokeStyle = '#3d6ea8'
      ctx.stroke()
    }
    if (!gems) {
      const art = potionSprite(tier)
      if (art) drawFittedSprite(ctx, art, { x, y, w: 54, h: 54 }, potionPieceFill(cfg, tier))
    }
    const value = gems ? gemAmount(cfg, tier) : potionEnergy(cfg, tier)
    if (gems) text(ctx, String(value), x + 27, y + 27, 14, PAL.white)
  }
  const amount = gems ? `${gemAmount(cfg, pop.tier)}颗钻石` : `${potionEnergy(cfg, pop.tier)}点体力`
  text(ctx, cfg.copy.infoChain.replace('{amount}', amount), card.x + card.w / 2, card.y + card.h - 28, 12, PAL.ink)
}

export function drawDecorPopup(model: RenderModel): void {
  const pick = model.state.decorate
  if (!pick || model.frame.mode !== 'house') return
  const { ctx, frame } = model
  const { card, swatches, ok, close } = decorPopupRects(frame)
  roundRect(ctx, card.x, card.y, card.w, card.h, 16)
  ctx.fillStyle = PAL.white
  ctx.fill()
  ctx.strokeStyle = PAL.ink
  ctx.lineWidth = 1.5
  ctx.stroke()
  text(ctx, '选择装修', card.x + card.w / 2, card.y + 26, 16, PAL.ink)
  button(ctx, close, '×', 'ghost')
  swatches.forEach((rect, index) => {
    const swatch = SWATCHES[index]
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10)
    ctx.fillStyle = swatch?.fill ?? '#ccc'
    ctx.fill()
    if (index === pick.index) {
      ctx.lineWidth = 3
      ctx.strokeStyle = '#3d6ea8'
      ctx.stroke()
    }
  })
  roundRect(ctx, ok.x, ok.y, ok.w, ok.h, 12)
  ctx.fillStyle = '#2c7a58'
  ctx.fill()
  text(ctx, '✓', ok.x + ok.w / 2, ok.y + ok.h / 2, 22, PAL.white)
}

export function partAt(frame: Frame, cam: { x: number; y: number; scale: number }, x: number, y: number): string | null {
  if (frame.mode !== 'house' || frame.map.w <= 0) return null
  const cx = frame.map.x + frame.map.w / 2
  const cy = frame.map.y + frame.map.h / 2
  const wx = cam.x + (x - cx) / cam.scale
  const wy = cam.y + (y - cy) / cam.scale
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const part = PARTS[i]
    if (!part?.task) continue
    if (wx >= part.x && wx <= part.x + part.w && wy >= part.y && wy <= part.y + part.h) return part.task
  }
  return null
}

function drawEnergyModal(model: RenderModel): void {
  const { ctx, frame, state, cfg } = model
  ctx.fillStyle = 'rgba(28,22,16,0.46)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  const card = frame.modalCard
  roundRect(ctx, card.x, card.y, card.w, card.h, 14)
  ctx.fillStyle = PAL.white
  ctx.fill()
  if (!state.freeRefillUsed) {
    text(ctx, '体力用完了', card.x + card.w / 2, card.y + 36, 18, PAL.ink)
    wrap(ctx, '头一回，街坊请你喝一碗。体力回到一百。', card.w - 36, 15).forEach((line, i) => {
      text(ctx, line, card.x + card.w / 2, card.y + 78 + i * 24, 15, PAL.soft, 'center', 'middle', 500)
    })
    button(ctx, frame.modalPrimary, '喝下', 'primary')
    button(ctx, frame.modalGhost, '先不了', 'ghost')
  } else {
    const price = gemEnergyPrice(cfg, state.gemBuys)
    const gain = cfg.economy.energyGemAmount
    text(ctx, '体力不足', card.x + card.w / 2, card.y + 28, 18, PAL.ink)
    text(ctx, `钻石买 ${gain} 体力 · 现价 ${price}`, card.x + card.w / 2, card.y + 58, 14, PAL.ink)
    text(ctx, `持有 ${state.gems} 钻 · 下次更贵，封顶后不变`, card.x + card.w / 2, card.y + 82, 12, PAL.soft)
    button(ctx, frame.modalPrimary, price === 0 ? '免费换体力' : `花 ${price} 钻`, 'primary')
    button(ctx, frame.modalGhost, `看广告 +${cfg.economy.adEnergy}`, 'ghost')
  }
}

function drawBuildStory(model: RenderModel): void {
  const story = model.state.buildStory
  if (!story) return
  const lines = model.cfg.stories?.[story.taskId] ?? []
  const line = lines[story.index]
  if (!line) return
  const { ctx, frame } = model
  const talk = talkRect(frame)
  ctx.fillStyle = 'rgba(12,10,8,0.45)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  roundRect(ctx, talk.card.x, talk.card.y, talk.card.w, talk.card.h, 14)
  ctx.fillStyle = PAL.white
  ctx.fill()
  text(ctx, line.speaker, talk.card.x + 16, talk.card.y + 28, 14, PAL.soft, 'left')
  wrap(ctx, line.text, talk.card.w - 32, 16).slice(0, 3).forEach((row, i) => {
    text(ctx, row, talk.card.x + 16, talk.card.y + 56 + i * 22, 16, PAL.ink, 'left')
  })
}

function drawMintGuide(model: RenderModel): void {
  const { ctx, frame, state, realNow } = model
  const holes: Rect[] = []
  if (state.mintStep === 'deliver' && frame.completes[0]) holes.push(frame.completes[0])
  else {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const item = state.board[row]?.[col]
        const producer = item?.kind === 'producer' && item.producerId === 'bev' && item.level >= 5
        const piece = item?.kind === 'product' && item.line === 'mint'
        if ((state.mintStep === 'select' || state.mintStep === 'produce') && producer) holes.push(cellBox(frame, row, col))
        if (state.mintStep === 'merge' && piece) holes.push(cellBox(frame, row, col))
      }
    }
  }
  ctx.save()
  ctx.fillStyle = 'rgba(12,10,8,0.72)'
  ctx.beginPath()
  ctx.rect(0, 0, frame.w, frame.h)
  for (const hole of holes) {
    ctx.moveTo(hole.x + hole.w, hole.y)
    ctx.arcTo(hole.x, hole.y, hole.x, hole.y + hole.h, 8)
    ctx.arcTo(hole.x, hole.y + hole.h, hole.x + hole.w, hole.y + hole.h, 8)
    ctx.arcTo(hole.x + hole.w, hole.y + hole.h, hole.x + hole.w, hole.y, 8)
    ctx.arcTo(hole.x + hole.w, hole.y, hole.x + hole.w, hole.y + hole.h, 8)
  }
  ctx.fill('evenodd')
  ctx.restore()
  const hand = holes[0]
  if (hand) paintHand(ctx, hand.x + hand.w / 2, hand.y + hand.h / 2 + Math.sin(realNow / 280) * 3, frame.board.cell)
  const tip = state.mintStep === 'select' ? '先点一下，选中饮料母棋' : state.mintStep === 'produce' ? '再点一次，产出猫薄荷' : state.mintStep === 'merge' ? '把两份猫薄荷拖到一起' : '交给客人'
  text(ctx, tip, frame.w / 2, frame.dock.y - 16, 14, PAL.white)
}

function drawGuide(model: RenderModel): void {
  const { ctx, frame, state, cfg, realNow } = model
  if (state.phase === 'opening') return
  const forced = guideHole(frame, state, cfg)
  const guide = state.guide
  if (!forced && (!guide || guide === 'none')) return
  if (!forced && (guide === 'buildTalk' || guide === 'backTalk')) {
    const talk = talkRect(frame)
    roundRect(ctx, talk.card.x, talk.card.y, talk.card.w, talk.card.h, 14)
    ctx.fillStyle = PAL.white
    ctx.fill()
    text(ctx, '温如月', talk.card.x + 16, talk.card.y + 24, 13, PAL.soft, 'left')
    const line = guide === 'buildTalk' ? '铜钱够了，去把茶楼修起来吧！' : '铜钱还差一点，咱们继续接单赚铜钱吧！'
    wrap(ctx, line, talk.card.w - 32, 15).forEach((row, i) => text(ctx, row, talk.card.x + 16, talk.card.y + 52 + i * 20, 15, PAL.ink, 'left'))
    button(ctx, talk.ok, '继续', 'primary')
    return
  }
  const hole = forced
    ? forced
    : guide === 'buildBtn'
      ? frame.houseBtn
      : guide === 'repairBtn'
        ? frame.buildBtn
        : guide === 'backBtn'
          ? frame.backBtn
          : frame.smileSlot
  ctx.save()
  ctx.fillStyle = 'rgba(12,10,8,0.72)'
  ctx.beginPath()
  ctx.rect(0, 0, frame.w, frame.h)
  if (hole.w > 0) {
    ctx.moveTo(hole.x + hole.w, hole.y)
    ctx.arcTo(hole.x, hole.y, hole.x, hole.y + hole.h, 8)
    ctx.arcTo(hole.x, hole.y + hole.h, hole.x + hole.w, hole.y + hole.h, 8)
    ctx.arcTo(hole.x + hole.w, hole.y + hole.h, hole.x + hole.w, hole.y, 8)
    ctx.arcTo(hole.x + hole.w, hole.y, hole.x + hole.w, hole.y + hole.h, 8)
  }
  ctx.fill('evenodd')
  ctx.restore()
  if (hole.w > 0) paintHand(ctx, hole.x + hole.w / 2, hole.y + hole.h / 2 + Math.sin(realNow / 280) * 3, frame.board.cell)
  if (guide === 'smile') text(ctx, '笑脸满了', frame.w / 2, hole.y + hole.h + 18, 14, PAL.white)
}

function drawNotice(model: RenderModel): void {
  const notice = model.state.notice
  if (!notice) return
  const { ctx, frame } = model
  const talk = talkRect(frame)
  ctx.fillStyle = 'rgba(12,10,8,0.35)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  roundRect(ctx, talk.card.x, talk.card.y, talk.card.w, talk.card.h, 14)
  ctx.fillStyle = PAL.white
  ctx.fill()
  text(ctx, '温如月', talk.card.x + 16, talk.card.y + 24, 13, PAL.soft, 'left')
  wrap(ctx, notice.text, talk.card.w - 32, 15).forEach((row, i) => text(ctx, row, talk.card.x + 16, talk.card.y + 52 + i * 20, 15, PAL.ink, 'left'))
  button(ctx, talk.ok, '继续', 'primary')
}

function drawTuner(model: RenderModel): void {
  const { ctx, frame, cfg, state, realNow } = model
  ctx.fillStyle = 'rgba(28,22,16,0.35)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  const card = frame.tunerCard
  roundRect(ctx, card.x, card.y, card.w, card.h, 14)
  ctx.fillStyle = PAL.paper
  ctx.fill()
  text(ctx, '调参', card.x + 16, card.y + 26, 18, PAL.ink, 'left')
  button(ctx, frame.tunerClose, '关闭', 'ghost')
  ctx.save()
  ctx.beginPath()
  ctx.rect(frame.tunerView.x, frame.tunerView.y, frame.tunerView.w, frame.tunerView.h)
  ctx.clip()
  for (const row of frame.sliders) {
    if (row.y + row.h < frame.tunerView.y || row.y > frame.tunerView.y + frame.tunerView.h) continue
    const spec = SLIDERS[row.index]
    if (!spec) continue
    const value = spec.get(cfg)
    const valueText = spec.text(value)
    ctx.font = `600 11px ${FONT}`
    const valueW = ctx.measureText(valueText).width
    ctx.save()
    ctx.beginPath()
    ctx.rect(frame.tunerView.x, row.y, Math.max(40, frame.tunerView.w - valueW - 16), 24)
    ctx.clip()
    text(ctx, spec.label, frame.tunerView.x + 4, row.y + 14, 13, PAL.ink, 'left')
    ctx.restore()
    text(ctx, valueText, row.reset.x - 6, row.y + 14, 11, PAL.ink, 'right')
    roundRect(ctx, row.reset.x, row.reset.y, row.reset.w, row.reset.h, 4)
    ctx.fillStyle = '#efe4d2'
    ctx.fill()
    ctx.strokeStyle = '#b9a88a'
    ctx.lineWidth = 1
    ctx.stroke()
    text(ctx, '↺', row.reset.x + row.reset.w / 2, row.reset.y + row.reset.h / 2, 12, PAL.ink)
    const trackY = row.y + row.h - 14
    ctx.fillStyle = '#ddcfb8'
    roundRect(ctx, row.trackX, trackY - 3, row.trackW, 6, 3)
    ctx.fill()
    const ratio = trackRatio(cfg, row.index)
    ctx.fillStyle = PAL.danger
    roundRect(ctx, row.trackX, trackY - 3, Math.max(6, row.trackW * ratio), 6, 3)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(row.trackX + row.trackW * ratio, trackY, 8, 0, Math.PI * 2)
    ctx.fillStyle = PAL.ink
    ctx.fill()
    void valueW
  }
  const scroll = frame.sliders[0] ? frame.tunerView.y - frame.sliders[0].y : 0
  const statsY = frame.tunerView.y + SLIDERS.length * 40 + 8 - scroll
  const visit = state.stats.visits[state.stats.visits.length - 1]
  const lines = [
    `上线 ${state.stats.visits.length} 次 · 本次 ${formatDuration(visit ? Math.max(visit.ms, realNow - visit.start) : 0)}`,
    `母棋 ${state.stats.producerTaps} · 交单 ${state.stats.ordersDone} · 广告按钮 ${state.stats.adClicks}`,
    `衣装 ${hostessCostume(cfg)} · 记录 ${state.stats.log.length} 条`,
  ]
  lines.forEach((line, i) => text(ctx, line, frame.tunerView.x + 4, statsY + i * 18, 12, PAL.soft, 'left', 'middle', 500))
  ctx.restore()
  button(ctx, frame.tunerExport, '导出 JSON', 'primary')
  button(ctx, frame.tunerReset, model.confirmReset ? '确认恢复全部？' : '全部恢复默认', model.confirmReset ? 'primary' : 'ghost')
  button(ctx, frame.tunerNewbie, `新手宝箱固定：${cfg.economy.newbieChestFixed ? '开' : '关'}`, 'ghost')
  button(ctx, frame.tunerWipe, '清空进度，从剧情重开', 'primary')
}
