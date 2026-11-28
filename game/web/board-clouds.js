const textureSize = 512
let texture
let cachedBank

function surface(document, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const puffs = [
  [25, 35, 59, 41], [113, 12, 67, 44], [221, 44, 84, 58], [342, 24, 69, 53], [455, 41, 80, 51],
  [63, 111, 69, 51], [167, 113, 86, 57], [298, 115, 77, 59], [409, 115, 64, 50], [503, 128, 63, 49],
  [20, 191, 76, 61], [128, 191, 68, 54], [240, 186, 76, 57], [358, 194, 80, 54], [469, 200, 74, 56],
  [73, 270, 87, 60], [198, 263, 71, 55], [313, 270, 83, 57], [432, 274, 79, 65], [527, 287, 66, 55],
  [24, 352, 65, 58], [124, 349, 78, 60], [246, 345, 80, 59], [366, 354, 77, 53], [475, 353, 76, 52],
  [61, 429, 80, 60], [180, 430, 83, 55], [308, 429, 75, 54], [422, 432, 82, 55], [516, 432, 71, 56],
  [14, 495, 68, 48], [122, 500, 79, 52], [249, 500, 82, 47], [375, 496, 73, 53], [475, 493, 68, 47],
]

const colors = [
  ['#d3a4f2', '#9e72cd', '#66488f'],
  ['#dcb2ef', '#aa79d3', '#755197'],
  ['#bd94e8', '#8f62c5', '#5b3d83'],
]

function paintPuff(ctx, x, y, rx, ry, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(rx, ry)
  const shade = ctx.createRadialGradient(-0.27, -0.38, 0.08, 0.11, 0.16, 1.19)
  shade.addColorStop(0, color[0])
  shade.addColorStop(0.51, color[1])
  shade.addColorStop(1, color[2])
  ctx.fillStyle = shade
  ctx.beginPath()
  ctx.moveTo(-1, 0.16)
  ctx.bezierCurveTo(-1.02, -0.22, -0.82, -0.56, -0.56, -0.55)
  ctx.bezierCurveTo(-0.49, -0.9, -0.19, -1.01, 0.07, -0.89)
  ctx.bezierCurveTo(0.30, -0.81, 0.42, -0.64, 0.49, -0.48)
  ctx.bezierCurveTo(0.75, -0.54, 1, -0.24, 1, 0.16)
  ctx.bezierCurveTo(1, 0.62, 0.65, 0.88, 0.21, 0.88)
  ctx.bezierCurveTo(-0.38, 0.91, -0.98, 0.71, -1, 0.16)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function cloudTexture(document) {
  if (texture) return texture
  texture = surface(document, textureSize, textureSize)
  const ctx = texture.getContext('2d')
  ctx.fillStyle = '#78559f'
  ctx.fillRect(0, 0, textureSize, textureSize)
  for (const [index, [x, y, rx, ry]] of puffs.entries()) {
    // Repaint the same lobe on the opposite edge whenever it crosses a seam.
    for (const dy of [-textureSize, 0, textureSize]) {
      for (const dx of [-textureSize, 0, textureSize]) {
        const px = x + dx
        const py = y + dy
        if (px + rx <= 0 || py + ry <= 0 || px - rx >= textureSize || py - ry >= textureSize) continue
        paintPuff(ctx, px, py, rx, ry, colors[index % colors.length])
      }
    }
  }
  return texture
}

function oval(path, x, y, rx, ry) {
  path.moveTo(x + rx, y)
  path.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  path.closePath()
}

function fullCell(path, box, edges) {
  const { x, y, w, h } = box
  const north = edges & 1
  const east = edges & 2
  const south = edges & 4
  const west = edges & 8
  const insetX = w * 0.14
  const insetY = h * 0.14
  const left = west ? x - 1 : x + insetX
  const top = north ? y - 1 : y + insetY
  const right = east ? x + w + 1 : x + w - insetX
  const bottom = south ? y + h + 1 : y + h - insetY
  path.roundRect(left, top, right - left, bottom - top, Math.min(w, h) * 0.10)
  if (!north) {
    oval(path, x + w * 0.29, y + h * 0.22, w * 0.25, h * 0.22)
    oval(path, x + w * 0.67, y + h * 0.20, w * 0.29, h * 0.22)
  }
  if (!south) {
    oval(path, x + w * 0.31, y + h * 0.73, w * 0.27, h * 0.25)
    oval(path, x + w * 0.67, y + h * 0.76, w * 0.26, h * 0.25)
  }
  if (!west) {
    oval(path, x + w * 0.23, y + h * 0.42, w * 0.24, h * 0.27)
    oval(path, x + w * 0.21, y + h * 0.68, w * 0.21, h * 0.25)
  }
  if (!east) {
    oval(path, x + w * 0.75, y + h * 0.40, w * 0.26, h * 0.28)
    oval(path, x + w * 0.77, y + h * 0.68, w * 0.24, h * 0.25)
  }
}

function lowMist(ctx, box, row, col) {
  const { x, y, w, h } = box
  const offset = ((row + col) % 2) * h * 0.025
  const wisps = new Path2D()
  oval(wisps, x + w * 0.23, y + h * 0.88, w * 0.22, h * 0.097)
  oval(wisps, x + w * 0.47, y + h * 0.85 + offset, w * 0.26, h * 0.134)
  oval(wisps, x + w * 0.74, y + h * 0.88 - offset, w * 0.24, h * 0.10)
  const mist = ctx.createLinearGradient(0, y + h * 0.72, 0, y + h)
  mist.addColorStop(0, 'rgba(255,255,255,0.58)')
  mist.addColorStop(0.60, 'rgba(255,255,255,0.94)')
  mist.addColorStop(1, 'rgba(255,255,255,0.87)')
  ctx.fillStyle = mist
  ctx.fill(wisps)
}

export function drawBoardClouds(ctx, cells) {
  if (!cells.length) return
  const first = cells[0].box
  const left = Math.min(...cells.map(({ box }) => box.x))
  const top = Math.min(...cells.map(({ box }) => box.y))
  const right = Math.max(...cells.map(({ box }) => box.x + box.w))
  const bottom = Math.max(...cells.map(({ box }) => box.y + box.h))
  const key = JSON.stringify(cells.map(({ box, lock, edges }) => [box.x, box.y, box.w, box.h, lock.veil, edges]))
  if (cachedBank?.key === key) {
    const { image, x, y } = cachedBank
    ctx.drawImage(image, x, y)
    return
  }

  const margin = 8
  const width = Math.ceil(right - left) + margin * 2
  const height = Math.ceil(bottom - top) + margin * 2
  const x = left - margin
  const y = top - margin
  const document = ctx.canvas.ownerDocument
  const mask = surface(document, width, height)
  const maskCtx = mask.getContext('2d')
  const fullOutline = new Path2D()
  for (const { box, lock, edges } of cells) {
    const local = { ...box, x: box.x - x, y: box.y - y }
    if (lock.veil === 'half') lowMist(maskCtx, local, lock.row, lock.col)
    else fullCell(fullOutline, local, edges)
  }

  // A blurred union keeps touching tiles entirely opaque and softens only the outside contour.
  const softness = Math.max(0.8, first.w * 0.026)
  const inset = width + 30
  maskCtx.save()
  maskCtx.translate(-inset, 0)
  maskCtx.shadowOffsetX = inset
  maskCtx.shadowBlur = softness * 2
  maskCtx.shadowColor = '#fff'
  maskCtx.fillStyle = '#fff'
  maskCtx.fill(fullOutline)
  maskCtx.restore()

  const image = surface(document, width, height)
  const paint = image.getContext('2d')
  const pattern = paint.createPattern(cloudTexture(document), 'repeat')
  const scale = first.w * 4.8 / textureSize
  pattern.setTransform(new DOMMatrix([scale, 0, 0, scale, -x, -y]))
  paint.fillStyle = pattern
  paint.fillRect(0, 0, width, height)
  paint.globalCompositeOperation = 'destination-in'
  paint.drawImage(mask, 0, 0)

  cachedBank = { key, image, x, y }
  ctx.drawImage(image, x, y)
}

export function cloudEdges(row, col, isFull) {
  return (isFull(row - 1, col) ? 1 : 0)
    | (isFull(row, col + 1) ? 2 : 0)
    | (isFull(row + 1, col) ? 4 : 0)
    | (isFull(row, col - 1) ? 8 : 0)
}
