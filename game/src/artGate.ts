/** 加载页背景先显示，其它图等 releaseArt 之后再开始请求。 */

let open = false
const waiters: (() => void)[] = []

export function releaseArt(): void {
  if (open) return
  open = true
  const pending = waiters.splice(0)
  for (const run of pending) run()
}

/** 门开着就立刻赋值。没开就先挂着，避免空 src 被当成已经加载完。 */
export function assignArtSrc(img: { src: string }, src: string): void {
  if (open) {
    img.src = src
    return
  }
  waiters.push(() => {
    img.src = src
  })
}
