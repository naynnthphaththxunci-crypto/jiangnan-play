export interface Size {
  w: number
  h: number
}

export interface AudioContextLike {
  currentTime: number
  state?: string
  resume?: () => void | Promise<void>
  destination: unknown
  createOscillator(): OscillatorLike
  createGain(): GainLike
}

export interface OscillatorLike {
  type: string
  frequency: {
    setValueAtTime(value: number, time: number): void
    exponentialRampToValueAtTime(value: number, time: number): void
  }
  connect(node: unknown): void
  start(when?: number): void
  stop(when?: number): void
}

export interface GainLike {
  gain: {
    setValueAtTime(value: number, time: number): void
    exponentialRampToValueAtTime(value: number, time: number): void
  }
  connect(node: unknown): void
}

export interface CanvasLike {
  width: number
  height: number
  style?: { width: string; height: string }
  getContext(kind: '2d'): CanvasRenderingContext2D | null
}

export interface Platform {
  kind: 'web' | 'wx'
  canvas: CanvasLike
  dpr: number
  insets: { top: number; bottom: number }
  now(): number
  size(): Size
  raf(cb: (t: number) => void): void
  storageGet(key: string): string | null
  storageSet(key: string, value: string): void
  onPointer(
    down: (x: number, y: number, id: number) => void,
    move: (x: number, y: number, id: number) => void,
    up: (x: number, y: number, id: number) => void,
  ): void
  onWheel(cb: (x: number, y: number, dy: number) => void): void
  onKey(cb: (key: string) => void): void
  onHide(cb: () => void): void
  onShow(cb: () => void): void
  exportText(filename: string, content: string): void
  audio(): AudioContextLike | null
  bindResize(cb: () => void): void
}
