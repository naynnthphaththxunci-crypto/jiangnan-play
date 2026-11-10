import { hostessCostume } from './config'
import orderLayout from './data/orderLayout.json'
import { formatDuration, formatMs, orderItemLabel } from './format'
import { easeInOut, easeOutBack, easeOutCubic, popScale, type Flyer, type Fx } from './fx'
import { hintHand, storageLessonHand, tutorialHand } from './coach'
import { cellRect, chainCardRect, chainCloseRect, chainPopRect, decorPopupRects, detailCard, guestFaceBox, guideHole, levelClaimRect, shopRects, smileDismissRect, talkRect, trackRatio, type Frame, type Rect } from './layout'
import {
  allTasks,
  atStep,
  canSell,
  characterName,
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
  producerName,
  producerChain,
  producerOfLine,
  producerOutputs,
  productName,
  sellPriceOf,
  smilesVisible,
  taskPrice,
  taskStep,
  tutorialLine,
} from './logic/sim'
import { itemSprite } from './itemArt'
import loadingBgUrl from './assets/ui/loading_bg.jpg'
import tutorialHandUrl from './assets/ui/tutorial_hand.png'
import { orderRewardImage, orderTrayImage } from './orderTray'
import { guestPortrait, measurePortrait, portraitReady } from './portraits'
import { SLIDERS } from './tuner'
import { COLS, ROWS, type GameConfig, type GameState, type Item, type NormBox } from './types'

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
  showHand: boolean
  chain: { line: string; level: number; source: 'order' | 'producer' } | null
}

export function render(model: RenderModel): void {
  const { ctx, frame } = model
  ctx.clearRect(0, 0, frame.w, frame.h)
  ctx.fillStyle = PAL.paper
  ctx.fillRect(0, 0, frame.w, frame.h)
  if (frame.mode === 'story') drawStory(model)
  else {
    drawHud(model)
    if (frame.mode === 'house') drawHouse(model)
    else {
      drawOrders(model)
      drawHint(model)
      drawBoard(model)
      drawChainPop(model)
      drawBottom(model)
      drawFx(model)
      drawInfo(model)
      drawSheet(model)
      drawTutorial(model)
      drawStorageLesson(model)
      drawHand(model)
    }
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
  const piece = item.kind === 'product' || item.kind === 'producer' ? item : null
  const sprite = piece ? itemSprite(piece.line, piece.level) : null
  if (sprite && piece) {
    const pad = box.w * 0.12
    ctx.drawImage(sprite, box.x + pad, box.y + pad, box.w - pad * 2, box.h - pad * 2)
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
    const energy = cfg.items.potions.find((p) => p.tier === item.tier)?.energy ?? 0
    const r = box.w * (0.18 + item.tier * 0.035)
    ctx.fillStyle = PAL.potion
    roundRect(ctx, cx - r * 0.62, cy - r * 0.15, r * 1.24, r * 1.15, r * 0.28)
    ctx.fill()
    roundRect(ctx, cx - r * 0.24, cy - r * 0.85, r * 0.48, r * 0.62, r * 0.1)
    ctx.fill()
    drawNum(ctx, String(energy), cx, cy + r * 0.35, Math.min(r * 0.7, box.w * 0.28))
    text(ctx, '体力', cx, box.y + box.h * 0.84, Math.max(10, box.w * 0.14), PAL.ink)
  } else if (item.kind === 'gem') {
    const amount = gemAmount(cfg, item.tier)
    const r = box.w * (0.16 + item.tier * 0.04)
    ctx.fillStyle = '#d23b62'
    drawLevelShape(ctx, item.tier + 2, cx, cy, r)
    drawNum(ctx, String(amount), cx, cy, r * 0.7)
    text(ctx, '钻石', cx, box.y + box.h * 0.84, Math.max(10, box.w * 0.14), PAL.ink)
  } else if (item.kind === 'rewardBox') {
    const fill = item.box === 'blue' ? '#3a6ea5' : item.box === 'purple' ? '#7a4ea3' : '#e07a3d'
    const label = item.box === 'blue' ? '蓝箱' : item.box === 'purple' ? '紫盒' : '购物袋'
    const side = box.w * 0.58
    roundRect(ctx, cx - side / 2, cy - side / 2, side, side, 6)
    ctx.fillStyle = fill
    ctx.fill()
    text(ctx, label, cx, cy, Math.max(10, box.w * 0.16), PAL.white)
    if (item.drops) text(ctx, `×${item.drops.length}`, cx, box.y + box.h * 0.84, Math.max(10, box.w * 0.14), PAL.ink)
  } else {
    const side = box.w * 0.52
    roundRect(ctx, cx - side / 2, cy - side / 2, side, side, 6)
    ctx.fillStyle = PAL.chest
    ctx.fill()
    text(ctx, item.drops ? `×${item.drops.length}` : '箱', cx, cy - 2, side * 0.42, PAL.white)
    text(ctx, cfg.items.chestName, cx, box.y + box.h * 0.84, Math.max(10, box.w * 0.14), PAL.ink)
  }
  ctx.restore()
}

const STORY_BG = ['#1c2433', '#2a2118', '#3a2430', '#241c18', '#2c241c', '#3a2a28', '#1a2830', '#3d3428']

const STORY_PORTRAIT: Record<string, string> = {
  温如月: 'ruyue',
  小桃: 'xiaotao',
  赵文轩: 'zhao',
  柳姑娘: 'liu',
  柳氏: 'liu',
}

function drawStory(model: RenderModel): void {
  const { ctx, frame, state, cfg } = model
  const step = cfg.opening[state.storyStep]
  if (!step) return
  ctx.fillStyle = STORY_BG[state.storyStep % STORY_BG.length] ?? '#241c18'
  ctx.fillRect(0, 0, frame.w, frame.h)
  const portraitKey = STORY_PORTRAIT[step.speaker]
  const portrait = guestPortrait(portraitKey)
  if (portraitKey && portrait && portraitReady(portrait)) {
    measurePortrait(portraitKey, portrait)
    const cardTop = frame.h * 0.58
    const height = frame.h * 0.5
    const width = height
    const x = frame.w - width * 0.78
    const y = cardTop - height * 0.62
    ctx.drawImage(portrait as CanvasImageSource, x, y, width, height)
  }
  button(ctx, frame.skip, '跳过', 'ghost')
  const scene = wrap(ctx, step.scene, frame.w - 48, 22, 700)
  scene.forEach((line, i) => text(ctx, line, frame.w / 2, frame.h * 0.28 + i * 32, 22, '#fffaf3'))
  const card = { x: 16, y: frame.h * 0.58, w: frame.w - 32, h: frame.h * 0.28 }
  roundRect(ctx, card.x, card.y, card.w, card.h, 14)
  ctx.fillStyle = PAL.white
  ctx.fill()
  text(ctx, step.speaker, card.x + 18, card.y + 28, 16, PAL.danger, 'left')
  const lines = wrap(ctx, step.text, card.w - 36, 18, 600)
  lines.forEach((line, i) => text(ctx, line, card.x + 18, card.y + 64 + i * 28, 18, PAL.ink, 'left'))
  const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(model.realNow / 180))
  roundRect(ctx, frame.hotspot.x, frame.hotspot.y, frame.hotspot.w, frame.hotspot.h, 12)
  ctx.fillStyle = '#fffaf3'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = `rgba(184, 67, 47, ${pulse})`
  ctx.stroke()
  text(ctx, step.hotspot, frame.hotspot.x + frame.hotspot.w / 2, frame.hotspot.y + frame.hotspot.h / 2 - 8, 22, PAL.ink)
  text(ctx, '点这里', frame.hotspot.x + frame.hotspot.w / 2, frame.hotspot.y + frame.hotspot.h - 28, 14, PAL.soft)
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

function drawHud(model: RenderModel): void {
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

const orderSlide = new Map<string, number>()

let tavernBackdrop: HTMLImageElement | null = null

function tavernImage(): HTMLImageElement | null {
  const host = globalThis as { Image?: new () => HTMLImageElement; document?: Document }
  if (!host.document || typeof host.Image !== 'function') return null
  if (!tavernBackdrop) {
    tavernBackdrop = new host.Image()
    tavernBackdrop.src = loadingBgUrl
  }
  return tavernBackdrop
}

function drawOrderStage(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const clip = frame.orderClip
  if (clip.h <= 0) return
  const trayTop = frame.orderPlates[0]?.y ?? clip.y + clip.h * 0.5
  ctx.save()
  ctx.beginPath()
  ctx.rect(clip.x, clip.y, clip.w, clip.h)
  ctx.clip()
  const bg = tavernImage()
  const wallH = Math.max(1, trayTop - clip.y)
  if (bg && (bg.naturalWidth || 0) > 0) {
    const srcH = Math.max(1, bg.naturalHeight * 0.2)
    ctx.drawImage(bg, 0, 0, bg.naturalWidth, srcH, clip.x, clip.y, clip.w, wallH + 6)
  } else {
    ctx.fillStyle = '#f0d2aa'
    ctx.fillRect(clip.x, clip.y, clip.w, wallH)
  }
  const beamY = trayTop - 2
  const beamH = Math.max(1, clip.y + clip.h - beamY)
  const wood = ctx.createLinearGradient(0, beamY, 0, beamY + beamH)
  wood.addColorStop(0, '#e7c088')
  wood.addColorStop(0.16, '#c98448')
  wood.addColorStop(1, '#8a4e28')
  ctx.fillStyle = wood
  ctx.fillRect(clip.x, beamY, clip.w, beamH)
  ctx.fillStyle = '#f6ddb0'
  ctx.fillRect(clip.x, beamY, clip.w, Math.max(3, frame.w * 0.008))
  ctx.restore()
}

function drawOrders(model: RenderModel): void {
  const { ctx, frame, state, cfg } = model
  const spots = state.orders.flatMap((order, index) => {
    const rect = frame.orders[index]
    const plate0 = frame.orderPlates[index]
    const pay0 = frame.orderRewards[index]
    const guest0 = frame.orderGuests[index]
    const charm0 = frame.orderCharms[index]
    if (!rect || !plate0 || !pay0 || !guest0 || !charm0) return []
    const prev = orderSlide.get(order.id) ?? rect.x
    const x = prev + (rect.x - prev) * 0.35
    orderSlide.set(order.id, Math.abs(x - rect.x) < 0.5 ? rect.x : x)
    const dx = (orderSlide.get(order.id) ?? rect.x) - rect.x
    const move = (r: Rect) => ({ ...r, x: r.x + dx })
    return [{ order, index, dx, rect: move(rect), plate: move(plate0), pay: move(pay0), guest: move(guest0), charm: move(charm0) }]
  })
  drawOrderStage(ctx, frame)
  const columnPitch = frame.w / Math.max(1, orderLayout.ordersPerScreen)
  spots.forEach((spot) => {
    const who = cfg.characters.find((entry) => entry.id === spot.order.customerId)
    const portrait = guestPortrait(who?.portrait)
    ctx.save()
    ctx.beginPath()
    const columnLeft = spot.guest.x + spot.guest.w * 0.52 - columnPitch / 2
    const tuck = Math.max(1, spot.plate.y + spot.plate.h * 0.55 - spot.guest.y)
    ctx.rect(columnLeft, spot.guest.y, columnPitch, tuck)
    ctx.clip()
    if (who?.portrait && portrait && portraitReady(portrait)) {
      measurePortrait(who.portrait, portrait)
      ctx.drawImage(portrait as CanvasImageSource, spot.guest.x, spot.guest.y, spot.guest.w, spot.guest.h)
    } else {
      paintStandIn(ctx, characterName(cfg, spot.order.customerId), SILHOUETTE[spot.order.customerId] ?? '#8a6a4a', spot.guest, who?.face ?? { x: 0.18, y: 0.08, w: 0.64, h: 0.42 })
    }
    ctx.restore()
  })
  ctx.save()
  ctx.beginPath()
  ctx.rect(frame.orderClip.x, frame.orderClip.y, frame.orderClip.w, frame.orderClip.h)
  ctx.clip()
  const tray = frame.rewardTray
  if (tray.w > 0) {
    roundRect(ctx, tray.x, tray.y, tray.w, tray.h, 12)
    ctx.fillStyle = '#f8efdf'
    ctx.fill()
    ctx.lineWidth = Math.max(1.5, tray.w * 0.025)
    ctx.strokeStyle = '#d7b88a'
    ctx.stroke()
    const chest = { x: tray.x + tray.w * 0.16, y: tray.y + tray.h * 0.06, w: tray.w * 0.68, h: tray.h * 0.42 }
    const lidH = chest.h * 0.42
    roundRect(ctx, chest.x - chest.w * 0.06, chest.y, chest.w * 1.12, lidH, 4)
    ctx.fillStyle = '#e2b15a'
    ctx.fill()
    ctx.strokeStyle = '#8a5a28'
    ctx.lineWidth = Math.max(1, chest.w * 0.04)
    ctx.stroke()
    roundRect(ctx, chest.x, chest.y + lidH * 0.72, chest.w, chest.h - lidH * 0.72, 4)
    ctx.fillStyle = '#c47a32'
    ctx.fill()
    ctx.strokeStyle = '#8a5a28'
    ctx.stroke()
    const claspR = Math.max(2.5, chest.w * 0.09)
    ctx.beginPath()
    ctx.fillStyle = '#f4e2b0'
    ctx.arc(chest.x + chest.w / 2, chest.y + lidH, claspR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#6a3e22'
    ctx.lineWidth = 1
    ctx.stroke()
    text(ctx, '奖励', tray.x + tray.w / 2, tray.y + tray.h * 0.58, Math.max(12, tray.w * 0.2), PAL.ink, 'center', 'middle', 700)
    const goal = Math.max(1, cfg.economy.smileGoal)
    const ratio = Math.max(0, Math.min(1, state.smiles / goal))
    const bar = { x: tray.x + tray.w * 0.12, y: tray.y + tray.h * 0.7, w: tray.w * 0.76, h: Math.max(6, tray.h * 0.07) }
    roundRect(ctx, bar.x, bar.y, bar.w, bar.h, bar.h / 2)
    ctx.fillStyle = '#e4d3bc'
    ctx.fill()
    roundRect(ctx, bar.x, bar.y, Math.max(bar.h, bar.w * ratio), bar.h, bar.h / 2)
    ctx.fillStyle = '#e0568a'
    ctx.fill()
    text(ctx, `${state.smiles}/${goal}`, tray.x + tray.w / 2, tray.y + tray.h * 0.86, Math.max(11, tray.w * 0.16), PAL.ink, 'center', 'middle', 700)
  }
  spots.forEach(({ order, index, dx, plate, pay: payRect }) => {
    const tray = orderTrayImage()
    if (tray && (tray.naturalWidth || 0) > 0) {
      const aspect = tray.naturalWidth / Math.max(1, tray.naturalHeight)
      const drawW = plate.w
      const drawH = drawW / aspect
      ctx.drawImage(tray, plate.x, plate.y + (plate.h - drawH) / 2, drawW, drawH)
    } else {
      roundRect(ctx, plate.x, plate.y, plate.w, plate.h, 8)
      ctx.fillStyle = '#e4b57a'
      ctx.fill()
    }
    order.slots.forEach((slot, slotIndex) => {
      const icon = frame.orderIcons.find((entry) => entry.order === index && entry.slot === slotIndex)
      if (!icon) return
      const ix = icon.rect.x + dx
      const iy = icon.rect.y
      const sprite = itemSprite(slot.line, slot.level)
      if (sprite) {
        ctx.drawImage(sprite, ix, iy, icon.rect.w, icon.rect.h)
      } else {
        roundRect(ctx, ix, iy, icon.rect.w, icon.rect.h, 6)
        ctx.fillStyle = lineColor(cfg, slot.line)
        ctx.fill()
      }
      if (slotChecked(state, order, slotIndex)) {
        const r = Math.max(4, Math.min(6, icon.rect.h * 0.28))
        ctx.beginPath()
        ctx.fillStyle = '#fffaf3'
        ctx.arc(ix + icon.rect.w - r - 1, iy + icon.rect.h - r - 1, r, 0, Math.PI * 2)
        ctx.fill()
        text(ctx, '✓', ix + icon.rect.w - r - 1, iy + icon.rect.h - r - 1, r * 1.15, '#2c7a58')
      }
    })
    const rewardArt = orderRewardImage()
    if (rewardArt && (rewardArt.naturalWidth || 0) > 0) {
      ctx.drawImage(rewardArt, payRect.x, payRect.y, payRect.w, payRect.h)
    } else {
      roundRect(ctx, payRect.x, payRect.y, payRect.w, payRect.h, 6)
      ctx.fillStyle = '#f6e2bc'
      ctx.fill()
      ctx.strokeStyle = '#8a5a2b'
      ctx.stroke()
    }
    const pay = orderPayout(order, cfg)
    const rewardSize = Math.max(8, Math.min(11, payRect.h * 0.24, frame.w * (orderLayout.rewardFont ?? 0.028)))
    text(ctx, `+${pay.smiles}`, payRect.x + payRect.w * 0.9, payRect.y + payRect.h * 0.28, rewardSize, '#6a3a22', 'right', 'middle', 700)
    text(ctx, `+${pay.coins}`, payRect.x + payRect.w * 0.9, payRect.y + payRect.h * 0.54, rewardSize, '#6a3a22', 'right', 'middle', 700)
    order.slots.forEach((slot, slotIndex) => {
      const name = frame.orderNames.find((entry) => entry.order === index && entry.slot === slotIndex)
      if (!name) return
      const box = { ...name.rect, x: name.rect.x + dx }
      const fullName = productName(cfg, slot.line, slot.level)
      const label = orderItemLabel(fullName, slot.level, order.slots.length === 1)
      roundRect(ctx, box.x, box.y, box.w, box.h, 4)
      ctx.fillStyle = '#fff8ec'
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = '#6a4328'
      ctx.stroke()
      const one = (box.w - 8) / Math.max(1, label.length)
      if (one >= 11) {
        text(ctx, label, box.x + box.w / 2, box.y + box.h / 2, Math.min(15, one), '#2a160c', 'center', 'middle', 700)
      } else {
        const nameSize = Math.max(10, Math.min(13, (box.w - 6) / Math.max(1, fullName.length)))
        text(ctx, fullName, box.x + box.w / 2, box.y + box.h * 0.34, nameSize, '#2a160c', 'center', 'middle', 700)
        text(ctx, `${slot.level}级`, box.x + box.w / 2, box.y + box.h * 0.72, Math.max(10, nameSize), '#6f6254', 'center', 'middle', 700)
      }
    })
    if (orderSatisfied(state, order)) {
      const btn = frame.completes[index]
      if (btn) {
        const bx = btn.x + dx
        const by = btn.y
        roundRect(ctx, bx, by, btn.w, btn.h, 8)
        ctx.fillStyle = '#2c7a58'
        ctx.fill()
        text(ctx, '完成', bx + btn.w / 2, by + btn.h / 2, Math.max(11, btn.h * 0.62), PAL.white, 'center', 'middle', 700)
      }
    }
  })
  ctx.restore()
}

const SILHOUETTE: Record<string, string> = {
  xiaotao: '#e07a8a',
  teaGuest: '#2f8f78',
  boatman: '#3d6ea8',
  scholar: '#b08948',
  embroider: '#a85cad',
  squire: '#d4652f',
  fisherman: '#d08a3a',
  siamese: '#d7c4a2',
  bossDaughter: '#e07a8a',
  raccoon: '#6e6258',
}

function paintStandIn(ctx: CanvasRenderingContext2D, name: string, color: string, guest: Rect, face: NormBox): void {
  const head = guestFaceBox(guest, face)
  const cx = head.x + head.w / 2
  const cy = head.y + head.h / 2
  const radius = Math.min(head.w, head.h) / 2
  ctx.beginPath()
  ctx.fillStyle = '#f3d2b0'
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()
  const bodyTop = cy + radius * 0.15
  const bodyH = Math.max(8, guest.y + guest.h - bodyTop)
  roundRect(ctx, cx - radius * 1.05, bodyTop, radius * 2.1, bodyH, 8)
  ctx.fillStyle = color
  ctx.fill()
  text(ctx, name, cx, bodyTop + 12, 10, PAL.ink)
}

function drawHudTools(model: RenderModel): void {
  const { ctx, frame, state } = model
  if (frame.multBtn.w > 0) {
    roundRect(ctx, frame.multBtn.x, frame.multBtn.y, frame.multBtn.w, frame.multBtn.h, 6)
    ctx.fillStyle = '#3a342e'
    ctx.fill()
    text(ctx, `×${state.spawnMult ?? 1}`, frame.multBtn.x + frame.multBtn.w / 2, frame.multBtn.y + frame.multBtn.h / 2, 12, '#fff6e4')
  }
  if (frame.shopBtn.w > 0) {
    roundRect(ctx, frame.shopBtn.x, frame.shopBtn.y, frame.shopBtn.w, frame.shopBtn.h, 6)
    ctx.fillStyle = '#8a6a4a'
    ctx.fill()
    text(ctx, '店', frame.shopBtn.x + frame.shopBtn.w / 2, frame.shopBtn.y + frame.shopBtn.h / 2, 13, '#fff6e4')
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
  const matTop = frame.orderClip.h > 0 ? frame.orderClip.y + frame.orderClip.h : frame.hud.y + frame.hud.h
  const matBottom = frame.dock.h > 0 ? frame.dock.y : frame.h
  ctx.fillStyle = theme.mat
  ctx.fillRect(0, matTop, frame.w, Math.max(0, matBottom - matTop))
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const box = cellBox(frame, row, col)
      const pad = 2
      const key = `${row},${col}`
      const radius = Math.max(6, (box.w - pad * 2) * 0.18)
      roundRect(ctx, box.x + pad, box.y + pad, box.w - pad * 2, box.h - pad * 2, radius)
      ctx.fillStyle = readyCells.has(key) ? theme.ready : (row + col) % 2 === 0 ? theme.cellLight : theme.cellDark
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = theme.cellLine
      ctx.stroke()
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
        if (model.selected && model.selected.row === row && model.selected.col === col) {
          ctx.lineWidth = 3
          ctx.strokeStyle = '#3d6ea8'
          roundRect(ctx, box.x + 1, box.y + 1, box.w - 2, box.h - 2, 6)
          ctx.stroke()
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
      drawItem(ctx, cfg, item, box, scale, 1, realNow, unlimited && item.kind === 'producer')
      if (item.kind === 'producer' && producerCanSpawn(cfg, item, realNow)) drawSpawnBolt(ctx, box)
      if (checks.has(key)) {
        const r = Math.max(5, box.w * 0.16)
        const cx = box.x + box.w - r - 1
        const cy = box.y + box.h - r - 1
        ctx.beginPath()
        ctx.fillStyle = '#2c7a58'
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        text(ctx, '✓', cx, cy, r * 1.35, PAL.white)
      }
      if (model.selected && model.selected.row === row && model.selected.col === col) {
        ctx.lineWidth = 2.5
        ctx.strokeStyle = '#3d6ea8'
        roundRect(ctx, box.x + 1, box.y + 1, box.w - 2, box.h - 2, 6)
        ctx.stroke()
      }
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

function drawSpawnBolt(ctx: CanvasRenderingContext2D, box: Rect): void {
  const size = Math.max(12, box.w * 0.25)
  const x = box.x + Math.max(1, box.w * 0.04)
  const y = box.y + Math.max(1, box.h * 0.04)
  ctx.save()
  ctx.beginPath()
  ctx.fillStyle = '#fffaf3'
  ctx.arc(x + size * 0.48, y + size * 0.5, size * 0.58, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.56, y + size * 0.02)
  ctx.lineTo(x + size * 0.18, y + size * 0.54)
  ctx.lineTo(x + size * 0.44, y + size * 0.54)
  ctx.lineTo(x + size * 0.3, y + size * 0.98)
  ctx.lineTo(x + size * 0.9, y + size * 0.4)
  ctx.lineTo(x + size * 0.58, y + size * 0.4)
  ctx.closePath()
  ctx.fillStyle = '#8ee04a'
  ctx.fill()
  ctx.lineWidth = Math.max(1, size * 0.08)
  ctx.strokeStyle = '#3d8a22'
  ctx.stroke()
  ctx.restore()
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
  roundRect(ctx, bar.x, bar.y, bar.w, bar.h, 10)
  ctx.fillStyle = '#fff6e8'
  ctx.fill()
  ctx.strokeStyle = '#e0c8a0'
  ctx.stroke()
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
    text(ctx, info.title, bar.x + 12, bar.y + bar.h * 0.38, 16, PAL.ink, 'left')
    text(ctx, info.usage, bar.x + 12, bar.y + bar.h * 0.72, 12, PAL.soft, 'left')
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
  const step = currentTutorial(cfg, state)
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
  const dialogue = step?.type === '对话'
  const card = dialogue
    ? { x: 12, y: frame.dock.y - 112, w: frame.w - 24, h: 100 }
    : { x: 12, y: frame.dock.y - 88, w: frame.w - 24, h: 76 }
  roundRect(ctx, card.x, card.y, card.w, card.h, 12)
  ctx.fillStyle = PAL.white
  ctx.fill()
  const lines = wrap(ctx, tutorialLine(cfg, state.openingStep), card.w - 24, 15)
  lines.slice(0, 3).forEach((line, i) => text(ctx, line, card.x + 12, card.y + 20 + i * 20, 15, PAL.ink, 'left'))
  if (dialogue) text(ctx, '点击任意处继续', card.x + card.w / 2, card.y + card.h - 16, 13, PAL.soft)
  if (step?.id === 'enter') button(ctx, frame.enterBtn, '进厨房', 'primary')
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

function drawBottom(model: RenderModel): void {
  const { ctx, frame, state, cfg } = model
  if (frame.dock.h <= 0) return
  if (frame.pendingBtn.w > 0) {
    const count = state.pending.length
    button(ctx, frame.pendingBtn, count ? `仓库 ${count}` : '仓库', count ? 'gold' : 'ghost')
  }
  button(ctx, frame.houseBtn, '建造', 'ghost')
  const task = nextTask(state, cfg)
  const dot = state.phase === 'play' && state.guide === 'none' && task && state.coins >= taskPrice(task, cfg)
  if (dot) {
    ctx.beginPath()
    ctx.fillStyle = '#c4552a'
    ctx.arc(frame.houseBtn.x + frame.houseBtn.w - 6, frame.houseBtn.y + 6, 6, 0, Math.PI * 2)
    ctx.fill()
  }
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
    const name = producer ? producerName(cfg, producer.id) : '母棋'
    text(ctx, name, card.x + card.w / 2, card.y + 36, 20, PAL.ink)
    text(ctx, `等级 ${chain.level}`, card.x + card.w / 2, card.y + 62, 14, PAL.soft)
    const slots = producerChain(state, producer?.id ?? chain.line, chain.level, cfg.economy.producerMaxLevel)
    slots.forEach((slot, index) => {
      const col = index % 4
      const row = Math.floor(index / 4)
      const x = card.x + 28 + col * 74
      const y = card.y + 84 + row * 70
      roundRect(ctx, x, y, 62, 58, 8)
      ctx.fillStyle = slot.seen ? lineColor(cfg, chain.line) : '#c8b89a'
      ctx.fill()
      if (slot.current) {
        ctx.lineWidth = 3
        ctx.strokeStyle = '#3d6ea8'
        ctx.stroke()
      }
      text(ctx, slot.label, x + 31, y + 29, 16, PAL.white)
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
  const step = cfg.opening[9]
  const task = cfg.buildings.steps[0]?.tasks[0]
  roundRect(ctx, frame.sheet.x, frame.sheet.y, frame.sheet.w, frame.sheet.h, 14)
  ctx.fillStyle = PAL.white
  ctx.fill()
  ctx.strokeStyle = PAL.ink
  ctx.lineWidth = 1.5
  ctx.stroke()
  button(ctx, frame.sheetSkip, '跳过', 'ghost')
  if (step) {
    text(ctx, step.speaker, frame.sheet.x + 16, frame.sheet.y + 22, 13, PAL.danger, 'left')
    const lines = wrap(ctx, step.text, frame.sheet.w - 100, 16)
    lines.forEach((line, i) => text(ctx, line, frame.sheet.x + 16, frame.sheet.y + 48 + i * 22, 16, PAL.ink, 'left'))
  }
  const price = task ? taskPrice(task, cfg) : 0
  const afford = state.coins >= price
  button(ctx, frame.sheetBtn, `${task?.name ?? '挂招牌'} · ${price} 铜钱`, afford ? 'primary' : 'ghost')
}

function worldToScreen(frame: Frame, cam: RenderModel['cam'], x: number, y: number): { x: number; y: number } {
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

function partLook(state: GameState, cfg: GameConfig, part: Part): { label: string; fill: string } {
  const task = part.task ? allTasks(cfg).find((entry) => entry.id === part.task) : null
  const preview = state.decorate && state.decorate.taskId === part.task ? task?.choices?.[state.decorate.index]?.id : null
  const chosen = preview ?? (part.task ? state.styles[part.task] : null)
  const swatch = swatchOf(chosen)
  if (swatch) return { label: part.label, fill: swatch.fill }
  return { label: part.label, fill: part.fill }
}

function drawHouse(model: RenderModel): void {
  const { ctx, frame, state, cfg, cam } = model
  ctx.save()
  ctx.beginPath()
  ctx.rect(frame.map.x, frame.map.y, frame.map.w, frame.map.h)
  ctx.clip()
  ctx.fillStyle = '#efe2cc'
  ctx.fillRect(frame.map.x, frame.map.y, frame.map.w, frame.map.h)
  ctx.strokeStyle = '#e4d3b4'
  ctx.lineWidth = 1
  for (let x = 80; x <= 1520; x += 80) {
    const a = worldToScreen(frame, cam, x, 80)
    const b = worldToScreen(frame, cam, x, 1900)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  for (let y = 80; y <= 1900; y += 80) {
    const a = worldToScreen(frame, cam, 80, y)
    const b = worldToScreen(frame, cam, 1520, y)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  const edgeA = worldToScreen(frame, cam, 120, 180)
  const edgeB = worldToScreen(frame, cam, 1480, 1860)
  ctx.strokeStyle = PAL.ink
  ctx.lineWidth = 2
  ctx.strokeRect(edgeA.x, edgeA.y, edgeB.x - edgeA.x, edgeB.y - edgeA.y)
  const title = worldToScreen(frame, cam, 700, 280)
  text(ctx, '温记茶楼', title.x, title.y, 22, PAL.ink)
  text(ctx, '拖动查看 · 滚轮或双指缩放', title.x, title.y + 26, 12, PAL.soft, 'center', 'middle', 500)

  const done = new Set(state.tasksDone)
  const upcoming = nextTask(state, cfg)
  for (const part of PARTS) {
    const built = part.task == null || done.has(part.task)
    const isNext = part.task != null && part.task === upcoming?.id
    const look = partLook(state, cfg, part)
    const label = look.label
    const fill = look.fill
    const p = worldToScreen(frame, cam, part.x, part.y)
    const w = part.w * cam.scale
    const h = part.h * cam.scale
    roundRect(ctx, p.x, p.y, w, h, 4)
    if (built) {
      ctx.fillStyle = fill
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = PAL.ink
      ctx.stroke()
      text(ctx, label, p.x + w / 2, p.y + h / 2, Math.max(11, Math.min(16, h * 0.38)), part.task === 't1' || part.task === 't12' ? PAL.white : PAL.ink)
    } else {
      ctx.setLineDash(isNext ? [5, 3] : [3, 4])
      ctx.lineWidth = isNext ? 2 : 1
      ctx.strokeStyle = isNext ? PAL.danger : PAL.soft
      ctx.stroke()
      ctx.setLineDash([])
      text(ctx, label, p.x + w / 2, p.y + h / 2, 12, isNext ? PAL.danger : PAL.soft, 'center', 'middle', 500)
    }
  }
  ctx.restore()

  button(ctx, frame.backBtn, '返回', 'ghost')
  const short = upcoming && state.coins < taskPrice(upcoming, cfg) && !state.decorate
  if (short) paintHand(ctx, frame.backBtn.x + frame.backBtn.w * 0.7, frame.backBtn.y + frame.backBtn.h * 0.75, frame.board.cell || Math.round(frame.w / 7))
  button(ctx, frame.zoomIn, '＋', 'ghost')
  button(ctx, frame.zoomOut, '－', 'ghost')
  button(ctx, frame.zoomReset, '复位', 'ghost')

  roundRect(ctx, frame.taskPanel.x, frame.taskPanel.y, frame.taskPanel.w, frame.taskPanel.h, 12)
  ctx.fillStyle = PAL.white
  ctx.fill()
  ctx.strokeStyle = PAL.ink
  ctx.lineWidth = 1.5
  ctx.stroke()
  button(ctx, frame.tuneBtn, '调参', 'ghost')
  const costume = hostessCostume(cfg)
  text(ctx, `掌柜 温如月 · ${costume}`, frame.taskPanel.x + 12, frame.taskPanel.y + 20, 12, PAL.soft, 'left')
  if (!upcoming) {
    text(ctx, '十二件小活都做完了', frame.taskPanel.x + frame.taskPanel.w / 2, frame.taskPanel.y + 70, 18, PAL.ink)
    return
  }
  const meta = taskStep(cfg, upcoming.id)
  text(ctx, meta ? `${meta.stepName} · ${meta.index}/${meta.total}` : '', frame.taskPanel.x + 12, frame.taskPanel.y + 42, 12, PAL.soft, 'left')
  text(ctx, upcoming.name, frame.taskPanel.x + 12, frame.taskPanel.y + 66, 18, PAL.ink, 'left')
  const price = taskPrice(upcoming, cfg)
  text(ctx, `${price} 铜钱`, frame.taskPanel.x + frame.taskPanel.w - 12, frame.taskPanel.y + 66, 14, state.coins >= price ? PAL.coin : PAL.danger, 'right')
  if (frame.buildBtn.w > 0 && !state.decorate) {
    button(ctx, frame.buildBtn, '修缮', state.coins >= price ? 'primary' : 'ghost')
  }
  drawDecorPopup(model)
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
    ctx.fillStyle = tier === pop.tier ? (gems ? '#d23b62' : PAL.potion) : '#d9c7a4'
    ctx.fill()
    if (tier === pop.tier) {
      ctx.lineWidth = 3
      ctx.strokeStyle = '#3d6ea8'
      ctx.stroke()
    }
    const value = gems ? gemAmount(cfg, tier) : potionEnergy(cfg, tier)
    text(ctx, String(value), x + 27, y + 27, 14, PAL.white)
  }
  const amount = gems ? `${gemAmount(cfg, pop.tier)}颗钻石` : `${potionEnergy(cfg, pop.tier)}点体力`
  text(ctx, cfg.copy.infoChain.replace('{amount}', amount), card.x + card.w / 2, card.y + card.h - 28, 12, PAL.ink)
}

function drawDecorPopup(model: RenderModel): void {
  const pick = model.state.decorate
  if (!pick || model.frame.mode !== 'house') return
  const { ctx, frame } = model
  const { card, swatches, ok } = decorPopupRects(frame)
  roundRect(ctx, card.x, card.y, card.w, card.h, 16)
  ctx.fillStyle = PAL.white
  ctx.fill()
  ctx.strokeStyle = PAL.ink
  ctx.lineWidth = 1.5
  ctx.stroke()
  text(ctx, '选择装修', card.x + card.w / 2, card.y + 26, 16, PAL.ink)
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
    text(ctx, spec.label, frame.tunerView.x + 4, row.y + row.h / 2, 13, PAL.ink, 'left')
    const trackY = row.y + row.h / 2
    ctx.fillStyle = '#ddcfb8'
    roundRect(ctx, row.trackX, trackY - 3, row.trackW, 6, 3)
    ctx.fill()
    const ratio = trackRatio(cfg, row.index)
    ctx.fillStyle = PAL.danger
    roundRect(ctx, row.trackX, trackY - 3, row.trackW * ratio, 6, 3)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(row.trackX + row.trackW * ratio, trackY, 7, 0, Math.PI * 2)
    ctx.fillStyle = PAL.ink
    ctx.fill()
    text(ctx, spec.text(value), frame.tunerView.x + frame.tunerView.w - 2, trackY, 11, PAL.ink, 'right')
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
  button(ctx, frame.tunerReset, '恢复默认', 'ghost')
  button(ctx, frame.tunerNewbie, `新手宝箱固定：${cfg.economy.newbieChestFixed ? '开' : '关'}`, 'ghost')
  button(ctx, frame.tunerWipe, '清空进度，从剧情重开', 'primary')
}
