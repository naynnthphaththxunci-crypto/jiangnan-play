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

export const spawnLandingPoint = 0.68

export function spawnDuration(configuredDuration) {
  return Math.max(390, Math.min(540, configuredDuration * 1.2))
}

export function spawnPose(from, to, cellWidth, elapsed, duration) {
  const t = unit(elapsed / duration)
  if (t < spawnLandingPoint) {
    const flight = t / spawnLandingPoint
    const travel = ease(flight)
    const lift = Math.sin(Math.PI * flight) * cellWidth * 0.57
    return {
      x: mix(from.x, to.x, travel),
      y: mix(from.y, to.y, travel) - lift,
      scale: mix(0.20, 1, 1 - (1 - flight) ** 2),
    }
  }

  const settle = (t - spawnLandingPoint) / (1 - spawnLandingPoint)
  let scale
  if (settle < 0.32) scale = mix(1, 1.20, ease(settle / 0.32))
  else if (settle < 0.70) scale = mix(1.20, 0.94, ease((settle - 0.32) / 0.38))
  else scale = mix(0.94, 1, ease((settle - 0.70) / 0.30))
  return { ...to, scale }
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

function paintStar(ctx, x, y, radius, opacity) {
  ctx.globalAlpha = opacity
  ctx.lineWidth = Math.max(0.8, radius * 0.22)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#da8b25'
  ctx.fillStyle = '#fff8de'
  ctx.beginPath()
  ctx.moveTo(x, y - radius)
  ctx.quadraticCurveTo(x + radius * 0.18, y - radius * 0.18, x + radius * 0.85, y)
  ctx.quadraticCurveTo(x + radius * 0.18, y + radius * 0.18, x, y + radius)
  ctx.quadraticCurveTo(x - radius * 0.18, y + radius * 0.18, x - radius * 0.85, y)
  ctx.quadraticCurveTo(x - radius * 0.18, y - radius * 0.18, x, y - radius)
  ctx.closePath()
  ctx.stroke()
  ctx.fill()
}

const producerStars = [[0.19, 0.31, 0, 0.146], [0.78, 0.16, 680, 0.113], [0.69, 0.69, 1360, 0.132]]

export function drawProducerSparkles(ctx, box, now, phaseOffset) {
  const time = now + phaseOffset
  ctx.save()
  for (const [x, y, delay, size] of producerStars) {
    const t = (((time - delay) % 2040 + 2040) % 2040) / 1160
    if (t <= 0 || t >= 1) continue
    const glow = Math.sin(Math.PI * t)
    paintStar(ctx, box.x + box.w * x, box.y + box.h * (y - t * 0.08),
      box.w * size * (0.65 + glow * 0.35), glow)
  }
  ctx.restore()
}

const mergeStars = [
  [-0.77, -0.40, 0.18], [-0.41, -0.79, 0.14], [0.33, -0.72, 0.18],
  [0.78, -0.30, 0.15], [0.65, 0.39, 0.17], [-0.62, 0.41, 0.13],
]

export function drawMergeSparkles(ctx, box, age, duration) {
  const t = unit(age / duration)
  if (t === 0 || t === 1) return
  const spread = 0.28 + 0.72 * (1 - (1 - t) ** 2)
  const opacity = Math.min(1, t * 10) * (1 - t ** 2)
  const x = box.x + box.w / 2
  const y = box.y + box.h * 0.45
  ctx.save()
  for (const [dx, dy, size] of mergeStars) {
    paintStar(ctx, x + dx * box.w * spread, y + dy * box.h * spread,
      box.w * size * (0.75 + 0.25 * Math.sin(Math.PI * t)), opacity)
  }
  ctx.restore()
}
