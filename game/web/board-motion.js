const unit = value => Math.min(1, Math.max(0, value))
const ease = value => value * value * (3 - 2 * value)
const mix = (from, to, progress) => from + (to - from) * progress

export const producerTapDuration = 240

export function producerTapScale(age, strength, initialScale = 1) {
  const t = unit(age / producerTapDuration)
  const amount = Math.min(0.14, Math.max(0, strength))
  if (t < 0.24) return mix(initialScale, 1 - amount, ease(t / 0.24))
  if (t < 0.54) return mix(1 - amount, 1 + amount * 1.35, ease((t - 0.24) / 0.30))
  return mix(1 + amount * 1.35, 1, ease((t - 0.54) / 0.46))
}

export function mergeScale(age, duration) {
  const t = unit(age / duration)
  if (t < 0.38) return mix(0.8, 1.18, ease(t / 0.38))
  if (t < 0.72) return mix(1.18, 0.97, ease((t - 0.38) / 0.34))
  return mix(0.97, 1, ease((t - 0.72) / 0.28))
}

export function spawnDuration(configuredDuration) {
  return Math.max(210, Math.min(380, configuredDuration * 0.85))
}

export function spawnPose(from, to, cellWidth, elapsed, duration) {
  const t = unit(elapsed / duration)
  const travel = 1 - (1 - t) ** 2
  const lift = Math.sin(Math.PI * t) * cellWidth * 0.52
  const scale = t < 0.54
    ? mix(0.42, 1.08, ease(t / 0.54))
    : mix(1.08, 1, ease((t - 0.54) / 0.46))
  return { x: mix(from.x, to.x, travel), y: mix(from.y, to.y, travel) - lift, scale }
}

export function drawAtScale(ctx, box, scale, paint) {
  if (scale === 1) return paint()
  const x = box.x + box.w / 2
  const y = box.y + box.h * 0.58
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  ctx.translate(-x, -y)
  try {
    return paint()
  } finally {
    ctx.restore()
  }
}

export function drawProducerSparkles(ctx, box, now, phaseOffset, tapAge) {
  const cycle = ((now + phaseOffset) % 3200 + 3200) % 3200
  const burst = tapAge >= 50 && tapAge < producerTapDuration
  const time = burst ? (tapAge - 50) * 3 : cycle
  if (time >= 610) return
  const points = [[0.24, 0.36, 0, 0.075], [0.70, 0.25, 120, 0.055], [0.63, 0.65, 230, 0.068]]
  ctx.save()
  ctx.fillStyle = '#fff8de'
  for (const [x, y, delay, size] of points) {
    const t = (time - delay) / 380
    if (t <= 0 || t >= 1) continue
    const glow = Math.sin(Math.PI * t)
    const cx = box.x + box.w * x
    const cy = box.y + box.h * y - t * box.h * 0.09
    const r = box.w * size * (0.5 + glow * 0.5)
    ctx.globalAlpha = glow * 0.82
    ctx.beginPath()
    ctx.moveTo(cx, cy - r)
    ctx.quadraticCurveTo(cx + r * 0.18, cy - r * 0.15, cx + r * 0.85, cy)
    ctx.quadraticCurveTo(cx + r * 0.15, cy + r * 0.15, cx, cy + r)
    ctx.quadraticCurveTo(cx - r * 0.15, cy + r * 0.15, cx - r * 0.85, cy)
    ctx.quadraticCurveTo(cx - r * 0.18, cy - r * 0.15, cx, cy - r)
    ctx.fill()
  }
  ctx.restore()
}
