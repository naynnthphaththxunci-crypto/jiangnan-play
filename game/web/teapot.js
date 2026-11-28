export function gradeOneTeapotReward(reward) {
  return reward.id === 'bev' && reward.producerLevel === 1
}

export function revealTeapotLocks(state) {
  state.producerLesson = null
  for (const lock of state.locks) {
    if (lock.buried.kind === 'producer' && lock.buried.id === 'bev') lock.veil = 'half'
  }
  state.notice = {
    text: '领取奖励栏的 1 级茶壶，再与棋盘上的茶壶合成。4 级可以泡安魂茶，5 级可以出孟婆汤。',
  }
}

export function restoreEarlyTeapotLocks(state, openingBoard, producerLevelOwned) {
  if (state.level >= 3 || (state.phase !== 'opening' && state.phase !== 'story')) return

  for (const tile of openingBoard) {
    if (tile.item.kind !== 'producer' || tile.item.id !== 'bev') continue
    const piece = state.board[tile.row]?.[tile.col]
    const lock = state.locks.find(entry => entry.row === tile.row && entry.col === tile.col)
    const buried = { kind: 'producer', id: tile.item.id, level: tile.item.level }
    const veil = tile.half ? 'half' : 'full'

    if (piece?.kind === 'producer' && piece.producerId === 'bev' && piece.level >= 4 && !lock) {
      state.board[tile.row][tile.col] = null
      state.locks.push({ row: tile.row, col: tile.col, cover: 'sand', veil, buried, prize: tile.prize })
    } else if (!piece && lock?.cover === 'sand' && lock.buried?.kind === 'coin'
      && lock.buried.line === 'coin' && lock.buried.amount === 2) {
      Object.assign(lock, { buried, veil, prize: tile.prize })
    }
  }

  if (producerLevelOwned(state, 'bev') === 0) {
    state.hasProducer.bev = false
    if (state.producerLesson === 'bev') state.producerLesson = null
  }
}
