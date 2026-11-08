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

/** 托盘上的简称：单件多留几个字，两件并排时只留末尾两个字加等级，避免挤在一起。 */
export function orderItemLabel(name: string, level: number, wide: boolean): string {
  const keep = wide ? (name.length === 5 ? 3 : 4) : 2
  const core = name.length > keep ? name.slice(-keep) : name
  return wide ? `${core} ${level}级` : `${core}${level}`
}
