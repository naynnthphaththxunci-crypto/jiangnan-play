const transitionMs = 260

export function paddedSpotlight(rect, padding) {
  return {
    x: rect.x - padding,
    y: rect.y - padding,
    w: rect.w + padding * 2,
    h: rect.h + padding * 2,
  }
}

export function encloseSpotlights(boxes) {
  const x = Math.min(...boxes.map(box => box.x))
  const y = Math.min(...boxes.map(box => box.y))
  const right = Math.max(...boxes.map(box => box.x + box.w))
  const bottom = Math.max(...boxes.map(box => box.y + box.h))
  return { x, y, w: right - x, h: bottom - y }
}

function collapsed(box) {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2, w: 0, h: 0 }
}

function interpolated({ from, to, started }, now) {
  const t = Math.min(1, Math.max(0, (now - started) / transitionMs))
  const amount = t * t * (3 - 2 * t)
  const lerp = key => from[key] + (to[key] - from[key]) * amount
  return { x: lerp('x'), y: lerp('y'), w: lerp('w'), h: lerp('h') }
}

function sameBox(a, b) {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
}

export function updateSpotlights(tracks, targets, now) {
  for (const [key, track] of tracks) {
    if (targets.has(key)) continue
    if (!track.leaving) {
      const from = interpolated(track, now)
      tracks.set(key, { from, to: collapsed(from), started: now, leaving: true })
    } else if (now - track.started >= transitionMs) {
      tracks.delete(key)
    }
  }
  for (const [key, to] of targets) {
    const track = tracks.get(key)
    if (!track || track.leaving || !sameBox(track.to, to)) {
      const from = track ? interpolated(track, now) : collapsed(to)
      tracks.set(key, { from, to, started: now })
    }
  }
  return [...tracks.values()].map(track => interpolated(track, now)).filter(box => box.w > 0 && box.h > 0)
}

export function drawSpotlightMask(ctx, frame, boxes) {
  ctx.save()
  for (const box of boxes) {
    const radius = Math.min(20, Math.max(11, frame.board.cell * 0.28), box.w / 2, box.h / 2)
    ctx.beginPath()
    ctx.rect(0, 0, frame.w, frame.h)
    ctx.roundRect(box.x, box.y, box.w, box.h, radius)
    // Clip out each hole individually so overlapping highlights stay bright.
    ctx.clip('evenodd')
  }
  ctx.fillStyle = 'rgba(12,10,8,0.66)'
  ctx.fillRect(0, 0, frame.w, frame.h)
  ctx.restore()
}
