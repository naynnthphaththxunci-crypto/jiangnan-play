export function formatMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}分${String(r).padStart(2, '0')}秒` : `${r}秒`
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** 托盘上写完整名字，不截短。 */
export function orderItemLabel(name: string, level: number, _wide: boolean): string {
  return `${name} ${level}级`
}
