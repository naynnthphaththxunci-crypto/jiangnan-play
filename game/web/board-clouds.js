const textureSize = 512
let texture
let cachedBank

function surface(document, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function smooth(value) {
  return value * value * (3 - 2 * value)
}

function noise(x, y, period, salt) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const dx = smooth(x - ix)
  const dy = smooth(y - iy)
  const sample = (col, row) => {
    const wrap = value => ((value % period) + period) % period
    const seed = wrap(col) * 374761393 + wrap(row) * 668265263 + salt
    const hash = Math.imul(seed ^ (seed >>> 13), 1274126177)
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295
  }
  const top = sample(ix, iy) * (1 - dx) + sample(ix + 1, iy) * dx
  const bottom = sample(ix, iy + 1) * (1 - dx) + sample(ix + 1, iy + 1) * dx
  return top * (1 - dy) + bottom * dy
}

function ramp(value, low, high) {
  return smooth(Math.max(0, Math.min(1, (value - low) / (high - low))))
}

function cloudDensity(u, v) {
  const x = u + (noise(u * 5, v * 5, 5, 882) - 0.5) * 0.17
  const y = v + (noise(u * 5, v * 5, 5, 135) - 0.5) * 0.13
  return 0.70 * noise(x * 6, y * 6, 6, 232)
    + 0.25 * noise(x * 12, y * 12, 12, 111)
    + 0.05 * noise(x * 20, y * 20, 20, 409)
}

function cloudTexture(document) {
  if (texture) return texture
  texture = surface(document, textureSize, textureSize)
  const ctx = texture.getContext('2d')
  const image = ctx.createImageData(textureSize, textureSize)
  for (let y = 0; y < textureSize; y++) {
    for (let x = 0; x < textureSize; x++) {
      const u = x / textureSize
      const v = y / textureSize
      const density = cloudDensity(u, v)
      const upper = cloudDensity(u - 0.006, v - 0.009)
      const rim = Math.max(0, Math.min(1, (density - upper) * 18))
      const base = ramp(density, 0.19, 0.72)
      const folds = 0.36 * ramp(density, 0.30, 0.39)
        + 0.39 * ramp(density, 0.46, 0.55)
        + 0.25 * ramp(density, 0.62, 0.70)
      const light = base * 0.52 + folds * 0.48
      const offset = (y * textureSize + x) * 4
      image.data[offset] = 65 + 101 * light + 24 * rim
      image.data[offset + 1] = 40 + 70 * light + 22 * rim
      image.data[offset + 2] = 105 + 103 * light + 22 * rim
      image.data[offset + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return texture
}

function fullCell(path, box, edges) {
  const { x, y, w, h } = box
  const corner = Math.min(w, h) * 0.25
  const connected = bit => Boolean(edges & bit)
  const padding = 1
  path.roundRect(x - padding, y - padding, w + padding * 2, h + padding * 2, [
    connected(1) || connected(8) ? 0 : corner,
    connected(1) || connected(2) ? 0 : corner,
    connected(2) || connected(4) ? 0 : corner,
    connected(4) || connected(8) ? 0 : corner,
  ])
}

function lowMist(ctx, box, row, col) {
  const { x, y, w, h } = box
  const offset = ((row + col * 3) % 4 - 1.5) * 0.035
  const veil = ctx.createRadialGradient(x + w * 0.48, y + h * (0.88 + offset), 0,
    x + w * 0.48, y + h * (0.88 + offset), w * 0.46)
  veil.addColorStop(0, 'rgba(255, 255, 255, 0.98)')
  veil.addColorStop(0.70, 'rgba(255, 255, 255, 0.87)')
  veil.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.save()
  ctx.translate(0, y + h * 0.86)
  ctx.scale(1, 0.43)
  ctx.translate(0, -(y + h * 0.86))
  ctx.fillStyle = veil
  ctx.fillRect(x, y + h * 0.36, w, h)
  ctx.restore()
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
  const scale = first.w * 5.3 / textureSize
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
