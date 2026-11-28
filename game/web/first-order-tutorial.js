const unlockCell = { row: 3, col: 2 }
const outputLevel = 1
const partLevel = outputLevel + 1

export function sameCell(a, b) {
  return a?.row === b?.row && a?.col === b?.col
}

function foodProduct(item, level) {
  return item?.kind === 'product' && item.line === 'food' && item.level === level && item.tag !== 'bubble'
}

export function firstOrderAction(state) {
  if (state.lesson !== 'focus') return null

  const lock = state.locks.find(lock => sameCell(lock, unlockCell))
  if (!foodProduct(lock?.buried, partLevel)) return null

  const all = []
  for (const [row, line] of state.board.entries()) {
    for (const [col, item] of line.entries()) {
      if (item) all.push({ row, col, item })
    }
  }
  const part = all.find(cell => foodProduct(cell.item, partLevel))
  if (part) return lock.veil === 'half' ? { kind: 'unlock', from: part, to: unlockCell, lock } : null

  const pieces = all.filter(cell => foodProduct(cell.item, outputLevel))
  if (pieces.length >= 2) {
    // Keep the resulting piece near the next locked cell where possible.
    const distance = cell => Math.abs(cell.row - unlockCell.row) + Math.abs(cell.col - unlockCell.col)
    pieces.sort((a, b) => distance(a) - distance(b))
    return { kind: 'merge', from: pieces[1], to: pieces[0] }
  }

  const producer = all.find(({ item }) => item.kind === 'producer' && item.producerId === 'food' && item.level >= 4)
  return producer ? { kind: 'produce', at: producer } : null
}

export function allowsFirstOrderDrop(action, from, to) {
  if (!action) return true
  if (action.kind === 'produce') return false
  if (action.kind === 'unlock') return sameCell(from, action.from) && sameCell(to, action.to)
  return (sameCell(from, action.from) && sameCell(to, action.to))
    || (sameCell(from, action.to) && sameCell(to, action.from))
}
