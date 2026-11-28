const sprites = new Map()
const size = 144

function oval(ctx, x, y, w, h, fill, angle = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, w, h, angle, 0, 2 * Math.PI)
  ctx.fillStyle = fill
  ctx.fill()
}

function earth(ctx) {
  const sand = ctx.createLinearGradient(0, 8, 26, 99)
  sand.addColorStop(0, '#edc98f')
  sand.addColorStop(0.55, '#dba15d')
  sand.addColorStop(1, '#ac6f3f')
  ctx.fillStyle = sand
  ctx.beginPath()
  ctx.roundRect(1, 1, 98, 98, 13)
  ctx.fill()
  ctx.clip()
  const glow = ctx.createRadialGradient(28, 26, 1, 38, 38, 81)
  glow.addColorStop(0, '#ffe2a9')
  glow.addColorStop(1, '#dfaa6e00')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 100, 100)

  ctx.fillStyle = '#a8663b22'
  ctx.beginPath()
  ctx.moveTo(0, 80)
  ctx.bezierCurveTo(23, 69, 57, 90, 102, 71)
  ctx.lineTo(102, 104)
  ctx.lineTo(0, 104)
  ctx.closePath()
  ctx.fill()
}

function stone(ctx, x, y, scale) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  oval(ctx, 3, 10, 19, 8, '#79482754')
  ctx.fillStyle = '#8e6149'
  ctx.beginPath()
  ctx.moveTo(-16, 4)
  ctx.lineTo(-9, -10)
  ctx.lineTo(6, -13)
  ctx.lineTo(17, -3)
  ctx.lineTo(12, 9)
  ctx.lineTo(-7, 12)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ead6ad'
  ctx.beginPath()
  ctx.moveTo(-16, 3)
  ctx.lineTo(-9, -10)
  ctx.lineTo(6, -13)
  ctx.lineTo(17, -3)
  ctx.lineTo(3, 5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function pottery(ctx) {
  oval(ctx, 59, 61, 19, 9, '#75482c44', -0.18)
  ctx.save()
  ctx.translate(56, 53)
  ctx.rotate(-0.36)
  ctx.beginPath()
  ctx.moveTo(-13, -10)
  ctx.quadraticCurveTo(0, -18, 16, -8)
  ctx.lineTo(12, 13)
  ctx.quadraticCurveTo(1, 18, -10, 9)
  ctx.closePath()
  ctx.fillStyle = '#a65f47'
  ctx.fill()
  ctx.strokeStyle = '#f2bd85'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-11, -8)
  ctx.quadraticCurveTo(1, -13, 13, -7)
  ctx.stroke()
  ctx.restore()
}

function roots(ctx) {
  ctx.strokeStyle = '#775237'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(26, 77)
  ctx.quadraticCurveTo(35, 61, 31, 47)
  ctx.moveTo(31, 64)
  ctx.quadraticCurveTo(44, 55, 49, 48)
  ctx.moveTo(32, 65)
  ctx.quadraticCurveTo(22, 59, 21, 54)
  ctx.stroke()
  stone(ctx, 69, 69, 0.45)
}

function sandSprite(document, variation) {
  if (sprites.has(variation)) return sprites.get(variation)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.scale(size / 100, size / 100)
  earth(ctx)
  for (let i = 0; i < 19; i++) {
    const x = 10 + (i * 29 + variation * 17) % 81
    const y = 8 + (i * 43 + variation * 11) % 81
    oval(ctx, x, y, 0.7 + i % 3 * 0.28, 0.68, i % 3 ? '#ad73433a' : '#fff0be70')
  }
  if (variation === 1) {
    stone(ctx, 42, 43, 0.75)
    stone(ctx, 63, 62, 0.44)
  } else if (variation === 2) pottery(ctx)
  else if (variation === 3) roots(ctx)
  sprites.set(variation, canvas)
  return canvas
}

export function drawSandCover(ctx, box, row, col) {
  const variant = ((row * 7 + col * 13) ^ (row * 3 + col)) % 7
  const img = sandSprite(ctx.canvas.ownerDocument, variant < 4 ? variant : 0)
  ctx.drawImage(img, box.x, box.y, box.w, box.h)
}

export function drawSandWeb(ctx, { x, y, w, h }) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(w / 100, h / 100)

  const sand = ctx.createLinearGradient(0, 78, 0, 99)
  sand.addColorStop(0, '#e9c1818f')
  sand.addColorStop(1, '#ae7046')
  ctx.beginPath()
  ctx.moveTo(3, 92)
  ctx.bezierCurveTo(7, 83, 18, 81, 32, 83)
  ctx.bezierCurveTo(45, 75, 57, 83, 64, 85)
  ctx.bezierCurveTo(84, 80, 94, 82, 98, 92)
  ctx.quadraticCurveTo(88, 100, 51, 98)
  ctx.quadraticCurveTo(12, 100, 3, 92)
  ctx.fillStyle = sand
  ctx.fill()

  const hub = [64, 70]
  const anchors = [[6, 81], [22, 98], [55, 98], [83, 98], [96, 78], [95, 37]]
  ctx.beginPath()
  for (const [ax, ay] of anchors) {
    ctx.moveTo(...hub)
    ctx.quadraticCurveTo((ax + hub[0]) / 2, (ay + hub[1]) / 2 + 3, ax, ay)
  }
  for (const ratio of [0.38, 0.70]) {
    const nodes = anchors.map(([ax, ay]) => [
      hub[0] + (ax - hub[0]) * ratio,
      hub[1] + (ay - hub[1]) * ratio,
    ])
    ctx.moveTo(...nodes[0])
    for (let i = 1; i < nodes.length; i++) {
      const [px, py] = nodes[i - 1]
      const [nx, ny] = nodes[i]
      ctx.quadraticCurveTo((px + nx) * 0.42 + hub[0] * 0.16, (py + ny) * 0.42 + hub[1] * 0.16, nx, ny)
    }
  }
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#7252477a'
  ctx.lineWidth = 2.7
  ctx.stroke()
  ctx.strokeStyle = '#fff4d9d9'
  ctx.lineWidth = 1.45
  ctx.stroke()
  ctx.restore()
}
