import { PAGE_BG, tigaPack } from './generated/tiga-pack'
import type { Grid, Point } from './grid'
import type { Fish, Variety, World } from './pond'

export type Theme = keyof typeof PAGE_BG

export const ACCENT: Readonly<Record<Theme, string>> = {
  light: tigaPack.accentOnLight,
  dark: tigaPack.accentOnDark,
}

type Pigment = 'white' | 'red' | 'orange' | 'black' | 'fin'

const INK: Readonly<Record<Theme, Readonly<Record<Pigment, readonly [number, number, number][]>>>> = {
  dark: {
    white: [
      [238, 232, 222],
      [176, 168, 156],
      [118, 112, 102],
    ],
    red: [
      [214, 78, 46],
      [168, 48, 32],
      [118, 34, 24],
    ],
    orange: [
      [232, 156, 64],
      [196, 108, 36],
      [142, 72, 26],
    ],
    black: [
      [154, 146, 136],
      [98, 92, 84],
      [64, 60, 54],
    ],
    fin: [
      [168, 160, 150],
      [112, 106, 98],
      [72, 68, 62],
    ],
  },
  light: {
    white: [
      [214, 206, 192],
      [176, 166, 150],
      [138, 128, 114],
    ],
    red: [
      [186, 54, 34],
      [150, 36, 22],
      [110, 26, 16],
    ],
    orange: [
      [204, 112, 36],
      [168, 78, 22],
      [124, 54, 16],
    ],
    black: [
      [54, 46, 40],
      [34, 28, 24],
      [20, 16, 14],
    ],
    fin: [
      [156, 146, 132],
      [120, 110, 98],
      [86, 78, 68],
    ],
  },
}

const BG: Readonly<Record<Theme, readonly [number, number, number]>> = {
  dark: [20, 19, 17],
  light: [243, 241, 234],
}

const RIPPLE: Readonly<Record<Theme, readonly [number, number, number]>> = {
  dark: [188, 182, 172],
  light: [92, 84, 74],
}

const EYE: Readonly<Record<Theme, readonly [number, number, number]>> = {
  dark: [32, 28, 26],
  light: [28, 24, 22],
}

interface Mark {
  readonly s: number
  readonly n: number
  readonly rim: number
  readonly layer: number
}

const groups = new Map<string, number[]>()

const depthOf = (id: number) => ((id * 17) % 5) / 4

const hash = (id: number, k: number) => {
  const x = Math.sin(id * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}

function profile(s: number): number {
  if (s < 0 || s > 1) return 0
  if (s < 0.1) return 0.045 + s
  if (s < 0.42) return 0.145 + (s - 0.1) * 0.05
  if (s < 0.74) return 0.161 - (s - 0.42) * 0.24
  return 0.084 + ((s - 0.74) / 0.26) * 0.055
}

function pigmentOf(variety: Variety, s: number, n: number, id: number): Pigment {
  if (variety === 'ghost') return 'fin'
  if (variety === 'ogon') {
    if (n < -0.2) return 'white'
    return blot(id, s, n, 2) ? 'white' : 'orange'
  }
  if (variety === 'showa') {
    if (s < 0.15 && n > -0.2) return 'black'
    if (blot(id, s, n, 4)) return 'black'
    if (blot(id, s, n, 6)) return 'red'
    return 'white'
  }
  if (s < 0.14 && n > 0.05 && hash(id, 1) > 0.35) return 'red'
  if (blot(id, s, n, 8) || blot(id, s, n, 10)) return 'red'
  return 'white'
}

function blot(id: number, s: number, n: number, k: number): boolean {
  const cs = 0.22 + (k % 5) * 0.1 + hash(id, k) * 0.08
  const cn = (hash(id, k + 3) - 0.5) * 0.7
  const ds = (s - cs) / (0.1 + hash(id, k + 5) * 0.05)
  const dn = (n - cn) / (0.42 + hash(id, k + 7) * 0.2)
  return ds * ds + dn * dn < 1
}

function rgbOf(theme: Theme, pigment: Pigment, shade: number, depth: number, fin: boolean): string {
  const row = INK[theme][pigment]
  const rgb = row[Math.min(row.length - 1, shade)]
  const bg = BG[theme]
  const fade = (1 - depth) * 0.42
  const r = Math.round(rgb[0] + (bg[0] - rgb[0]) * fade)
  const g = Math.round(rgb[1] + (bg[1] - rgb[1]) * fade)
  const b = Math.round(rgb[2] + (bg[2] - rgb[2]) * fade)
  if (fin) return `rgba(${r},${g},${b},0.62)`
  return `rgb(${r},${g},${b})`
}

function spine(fish: Fish, s: number, len: number): Point {
  const hx = Math.cos(fish.heading)
  const hy = Math.sin(fish.heading)
  const wag = Math.sin(s * 3.1 - fish.wag * Math.PI * 2) * s * s
  const arc = Math.sin(s * Math.PI) * Math.sin(fish.id * 1.3)
  const lat = len * (0.34 * arc + 0.22 * wag)
  const along = (0.4 - s) * len
  return {
    x: fish.pos.x + hx * along - hy * lat,
    y: fish.pos.y + hy * along + hx * lat,
  }
}

function paintFish(ctx: CanvasRenderingContext2D, fish: Fish, grid: Grid, theme: Theme, pitch: number) {
  const depth = depthOf(fish.id)
  const len = grid.width * (0.16 + depth * 0.09)
  const cells = new Map<string, Mark>()
  const steps = Math.max(16, Math.round(len / (pitch * 0.45)))
  const backX = -Math.sin(fish.heading)
  const backY = Math.cos(fish.heading)
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * 1.12
    const origin = spine(fish, s, len)
    const half = profile(s) * len
    if (half < pitch * 0.35) continue
    const dorsal = s > 0.3 && s < 0.62 ? half * 0.42 * Math.sin(((s - 0.3) / 0.32) * Math.PI) : 0
    const pectoral = s > 0.16 && s < 0.34 ? half * 0.55 * Math.sin(((s - 0.16) / 0.18) * Math.PI) : 0
    const reach = half + Math.max(dorsal, pectoral)
    const x0 = Math.floor((origin.x - reach) / pitch)
    const x1 = Math.ceil((origin.x + reach) / pitch)
    const y0 = Math.floor((origin.y - reach) / pitch)
    const y1 = Math.ceil((origin.y + reach) / pitch)
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const x = ix * pitch
        const y = iy * pitch
        const dx = x - origin.x
        const dy = y - origin.y
        const across = dx * backX + dy * backY
        const along = Math.hypot(dx, dy)
        const limit = half + (across > 0 ? dorsal : pectoral)
        if (along > limit) continue
        const n = Math.max(-1, Math.min(1, across / Math.max(half, 1)))
        if (s > 0.9 && Math.abs(n) < 0.14) continue
        const rim = along / limit
        const layer = rim > 0.8 || s > 0.78 || (across > 0 && across > half) || (across < 0 && -across > half) ? 1 : 0
        const mark: Mark = { s, n, rim, layer }
        const key = `${ix},${iy}`
        const prev = cells.get(key)
        if (!prev || mark.layer < prev.layer || (mark.layer === prev.layer && mark.rim < prev.rim)) cells.set(key, mark)
      }
    }
  }
  const eyeAt = spine(fish, 0.12, len)
  const eyeX = Math.round((eyeAt.x + backX * profile(0.12) * len * 0.35) / pitch)
  const eyeY = Math.round((eyeAt.y + backY * profile(0.12) * len * 0.35) / pitch)
  ctx.globalAlpha = 0.58 + depth * 0.42
  for (const [key, mark] of cells) {
    const ghost = fish.variety === 'ghost'
    const [xs, ys] = key.split(',')
    const ix = Number(xs)
    const iy = Number(ys)
    const fin = mark.layer === 1 || (mark.layer === 2 && mark.rim > 0.5)
    const shade = mark.rim > 0.78 ? 2 : mark.rim > 0.48 ? 1 : mark.n > 0.35 ? 1 : 0
    const pigment = fin ? 'fin' : pigmentOf(fish.variety, mark.s, mark.n, fish.id)
    const eye = ix === eyeX && iy === eyeY && mark.layer === 0
    const color = eye
      ? `rgb(${EYE[theme][0]},${EYE[theme][1]},${EYE[theme][2]})`
      : rgbOf(theme, ghost ? 'fin' : pigment, shade, depth, (fin && !eye) || ghost)
    const list = groups.get(color)
    if (list) list.push(ix * pitch, iy * pitch)
    else groups.set(color, [ix * pitch, iy * pitch])
  }
  flush(ctx, Math.max(2, pitch - Math.max(1, pitch * 0.18)))
  ctx.globalAlpha = 1
}

function paintRipple(ctx: CanvasRenderingContext2D, at: Point, age: number, life: number, theme: Theme, pitch: number) {
  const p = age / life
  const radius = pitch * (2.2 + p * 7.5)
  const count = Math.max(14, Math.round((Math.PI * 2 * radius) / (pitch * 1.65)))
  const [r, g, b] = RIPPLE[theme]
  ctx.globalAlpha = (1 - p) * 0.72
  ctx.fillStyle = `rgb(${r},${g},${b})`
  const size = Math.max(2, pitch - Math.max(1, pitch * 0.18))
  const half = size / 2
  ctx.beginPath()
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    const x = Math.round((at.x + Math.cos(a) * radius) / pitch) * pitch
    const y = Math.round((at.y + Math.sin(a) * radius) / pitch) * pitch
    ctx.rect(x - half, y - half, size, size)
  }
  ctx.fill()
  ctx.globalAlpha = 1
}

function paintFood(ctx: CanvasRenderingContext2D, at: Point, theme: Theme, pitch: number) {
  const size = Math.max(2, pitch - Math.max(1, pitch * 0.18))
  const x = Math.round(at.x / pitch) * pitch
  const y = Math.round(at.y / pitch) * pitch
  ctx.globalAlpha = 1
  ctx.fillStyle = ACCENT[theme]
  ctx.fillRect(x - size / 2, y - size / 2, size, size)
}

function flush(ctx: CanvasRenderingContext2D, size: number) {
  const half = size / 2
  for (const [color, list] of groups) {
    if (list.length === 0) continue
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < list.length; i += 2) ctx.rect(list[i] - half, list[i + 1] - half, size, size)
    ctx.fill()
    list.length = 0
  }
}

export function paintPond(ctx: CanvasRenderingContext2D, grid: Grid, world: World, theme: Theme): void {
  const pitch = Math.max(6, Math.round(grid.width / 96))
  ctx.setTransform(grid.dpr, 0, 0, grid.dpr, 0, 0)
  ctx.globalAlpha = 1
  ctx.fillStyle = PAGE_BG[theme]
  ctx.fillRect(0, 0, grid.width, grid.height)
  for (const ripple of world.ripples) paintRipple(ctx, ripple.at, ripple.age, ripple.life, theme, pitch)
  const order = world.fish.map((fish, index) => index)
  order.sort((a, b) => depthOf(world.fish[a].id) - depthOf(world.fish[b].id))
  for (const index of order) paintFish(ctx, world.fish[index], grid, theme, pitch)
  for (const food of world.food) paintFood(ctx, food.at, theme, pitch)
}
