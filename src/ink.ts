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
  if (s < 0 || s > 0.82) return 0
  if (s < 0.16) return 0.096 + 0.052 * Math.sin((s / 0.16) * Math.PI * 0.5)
  const u = (s - 0.16) / 0.66
  return 0.028 + 0.12 * Math.pow(1 - u, 1.15)
}

const SHADES = 6

function tone(rim: number, n: number): number {
  const t = Math.min(0.999, Math.max(0, rim * 0.8 + Math.max(0, n) * 0.22 - Math.max(0, -n) * 0.16))
  return Math.min(SHADES - 1, Math.floor(t * SHADES))
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
  const t = shade / (SHADES - 1)
  const from = row[0]
  const to = row[row.length - 1]
  const bg = BG[theme]
  const fade = (1 - depth) * 0.42
  const mix = (i: number) => from[i] + (to[i] - from[i]) * t
  const r = Math.round(mix(0) + (bg[0] - mix(0)) * fade)
  const g = Math.round(mix(1) + (bg[1] - mix(1)) * fade)
  const b = Math.round(mix(2) + (bg[2] - mix(2)) * fade)
  if (fin) return `rgba(${r},${g},${b},0.7)`
  return `rgb(${r},${g},${b})`
}

function cover(
  cells: Map<string, Mark>,
  cx: number,
  cy: number,
  rad: number,
  s: number,
  layer: number,
  pitch: number,
  acrossOf: (x: number, y: number) => number,
) {
  if (rad < pitch * 0.28) return
  const x0 = Math.floor((cx - rad) / pitch)
  const x1 = Math.ceil((cx + rad) / pitch)
  const y0 = Math.floor((cy - rad) / pitch)
  const y1 = Math.ceil((cy + rad) / pitch)
  for (let ix = x0; ix <= x1; ix++) {
    for (let iy = y0; iy <= y1; iy++) {
      const x = ix * pitch + (pitch - 1) / 2
      const y = iy * pitch + (pitch - 1) / 2
      const dist = Math.hypot(x - cx, y - cy)
      if (dist > rad) continue
      const mark: Mark = { s, n: Math.max(-1, Math.min(1, acrossOf(x, y))), rim: dist / rad, layer }
      const key = `${ix},${iy}`
      const prev = cells.get(key)
      if (!prev || mark.layer < prev.layer || (mark.layer === prev.layer && mark.rim < prev.rim)) cells.set(key, mark)
    }
  }
}

function spine(fish: Fish, s: number, len: number): Point {
  const hx = Math.cos(fish.heading)
  const hy = Math.sin(fish.heading)
  const wag = Math.sin(s * 3.1 - fish.wag * Math.PI * 2) * s * s
  const arc = Math.sin(s * Math.PI) * Math.sin(fish.id * 1.3)
  const lat = len * (0.14 * arc + 0.08 * wag)
  const along = (0.4 - s) * len
  return {
    x: fish.pos.x + hx * along - hy * lat,
    y: fish.pos.y + hy * along + hx * lat,
  }
}

function frameAt(fish: Fish, s: number, len: number) {
  const origin = spine(fish, s, len)
  const prev = spine(fish, Math.max(0, s - 0.025), len)
  const next = spine(fish, s + 0.025, len)
  let tailX = next.x - prev.x
  let tailY = next.y - prev.y
  const mag = Math.hypot(tailX, tailY) || 1
  tailX /= mag
  tailY /= mag
  return { origin, tailX, tailY, dorsalX: tailY, dorsalY: -tailX }
}

function paintFish(ctx: CanvasRenderingContext2D, fish: Fish, grid: Grid, theme: Theme, pitch: number) {
  const depth = depthOf(fish.id)
  const len = grid.width * (0.16 + depth * 0.045)
  const cells = new Map<string, Mark>()
  const steps = Math.max(18, Math.round(len / (pitch * 0.7)))
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * 0.82
    const { origin, tailX, tailY, dorsalX, dorsalY } = frameAt(fish, s, len)
    const half = profile(s) * len
    const acrossOf = (x: number, y: number) =>
      ((x - origin.x) * dorsalX + (y - origin.y) * dorsalY) / Math.max(half, 1)
    cover(cells, origin.x, origin.y, half, s, 0, pitch, acrossOf)
    if (s > 0.34 && s < 0.58) {
      const u = Math.sin(((s - 0.34) / 0.24) * Math.PI)
      const lift = half + len * 0.012 * u
      cover(cells, origin.x + dorsalX * lift, origin.y + dorsalY * lift, len * 0.02 * u, s, 1, pitch, () => 0.75)
    }
    if (s > 0.18 && s < 0.42) {
      const u = Math.sin(((s - 0.18) / 0.24) * Math.PI)
      const reach = half + len * 0.045 * u
      const swept = len * 0.11 * u
      cover(
        cells,
        origin.x - dorsalX * reach + tailX * swept,
        origin.y - dorsalY * reach + tailY * swept,
        len * 0.075 * u,
        s,
        1,
        pitch,
        () => -0.7,
      )
    }
  }
  const tailSteps = Math.max(8, Math.round((len * 0.22) / pitch))
  for (let i = 0; i <= tailSteps; i++) {
    const u = i / tailSteps
    const s = 0.78 + u * 0.24
    const { origin, dorsalX, dorsalY } = frameAt(fish, s, len)
    const spread = len * u * 0.16
    const rad = len * (0.072 - u * 0.02)
    cover(cells, origin.x + dorsalX * spread, origin.y + dorsalY * spread, rad, s, 2, pitch, () => 0.9)
    cover(cells, origin.x - dorsalX * spread, origin.y - dorsalY * spread, rad, s, 2, pitch, () => -0.9)
  }
  const eye = frameAt(fish, 0.1, len)
  const eyeX = Math.round((eye.origin.x + eye.dorsalX * profile(0.1) * len * 0.42) / pitch)
  const eyeY = Math.round((eye.origin.y + eye.dorsalY * profile(0.1) * len * 0.42) / pitch)
  ctx.globalAlpha = 0.58 + depth * 0.42
  for (const [key, mark] of cells) {
    const ghost = fish.variety === 'ghost'
    const [xs, ys] = key.split(',')
    const ix = Number(xs)
    const iy = Number(ys)
    const fin = mark.layer !== 0
    const shade = tone(mark.rim, mark.n)
    const pigment = fin ? 'fin' : pigmentOf(fish.variety, mark.s, mark.n, fish.id)
    const eye = ix === eyeX && iy === eyeY && mark.layer === 0
    const color = eye
      ? `rgb(${EYE[theme][0]},${EYE[theme][1]},${EYE[theme][2]})`
      : rgbOf(theme, ghost ? 'fin' : pigment, shade, depth, (fin && !eye) || ghost)
    const list = groups.get(color)
    if (list) list.push(ix * pitch, iy * pitch)
    else groups.set(color, [ix * pitch, iy * pitch])
  }
  flush(ctx, inkOf(pitch))
  ctx.globalAlpha = 1
}

function paintRipple(ctx: CanvasRenderingContext2D, at: Point, age: number, life: number, theme: Theme, pitch: number) {
  const p = age / life
  const [r, g, b] = RIPPLE[theme]
  const size = inkOf(pitch)
  ctx.fillStyle = `rgb(${r},${g},${b})`
  for (let ring = 0; ring < 4; ring++) {
    const local = p * 1.2 - ring * 0.2
    if (local <= 0 || local >= 1) continue
    const radius = pitch * (4.2 + local * 13)
    const count = Math.max(20, Math.round((Math.PI * 2 * radius) / (pitch * 1.45)))
    const fade = (1 - local) * (1 - local)
    ctx.globalAlpha = fade * (0.9 - ring * 0.12)
    ctx.beginPath()
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2
      const x = Math.floor((at.x + Math.cos(a) * radius) / pitch) * pitch
      const y = Math.floor((at.y + Math.sin(a) * radius) / pitch) * pitch
      ctx.rect(x, y, size, size)
    }
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

const inkOf = (pitch: number) => Math.max(2, pitch - 1)

function paintFood(ctx: CanvasRenderingContext2D, at: Point, theme: Theme, pitch: number) {
  const size = inkOf(pitch)
  const x = Math.floor(at.x / pitch) * pitch
  const y = Math.floor(at.y / pitch) * pitch
  ctx.globalAlpha = 1
  ctx.fillStyle = ACCENT[theme]
  ctx.fillRect(x, y, size, size)
}

function flush(ctx: CanvasRenderingContext2D, size: number) {
  for (const [color, list] of groups) {
    if (list.length === 0) continue
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < list.length; i += 2) ctx.rect(list[i], list[i + 1], size, size)
    ctx.fill()
    list.length = 0
  }
}

export function paintPond(ctx: CanvasRenderingContext2D, grid: Grid, world: World, theme: Theme): void {
  const pitch = Math.max(4, Math.round(grid.width / 213))
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
