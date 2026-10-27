import { PAGE_BG, tigaPack } from './generated/tiga-pack'
import { cellAt, type Grid, type Point } from './grid'
import type { Variety, World } from './pond'

export type Theme = keyof typeof PAGE_BG

export const ACCENT: Readonly<Record<Theme, string>> = {
  light: tigaPack.accentOnLight,
  dark: tigaPack.accentOnDark,
}

type Role = 'w' | 'r' | 'k' | 'f' | 't'
type Pigment = 'white' | 'red' | 'black' | 'orange'

const PIGMENT: Readonly<Record<Theme, Readonly<Record<Pigment, string>>>> = {
  dark: { white: '#f0ebe0', red: '#e5533d', black: '#8d867c', orange: '#f08a24' },
  light: { white: '#736c62', red: '#c43820', black: '#2c2824', orange: '#a8560c' },
}

const GHOST_INK: Readonly<Record<Theme, string>> = { dark: '#a39d91', light: '#6f685c' }

const ART: Readonly<Record<Variety, Readonly<Record<Role, Pigment>> | 'outline'>> = {
  kohaku: { w: 'white', r: 'red', k: 'white', f: 'white', t: 'white' },
  showa: { w: 'white', r: 'red', k: 'black', f: 'black', t: 'white' },
  ogon: { w: 'orange', r: 'white', k: 'orange', f: 'white', t: 'white' },
  ghost: 'outline',
}

interface KoiCell {
  readonly x: number
  readonly y: number
  readonly glyph: string
  readonly role: Role
  readonly edge: boolean
}

interface KoiMap {
  readonly w: number
  readonly h: number
  readonly head: Point
  readonly cells: readonly KoiCell[]
}

const EAST = koi(
  String.raw`
    .........\......
    \.........\.....
    .\...%%@@@@@#...
    ..--%@@@@@@@@@#.
    ..--%@@@@@@@@@#.
    ./...%%@@@@@#...
    /........./.....
    ........./......
  `,
  `
    .........f......
    t.........f.....
    .t...wkrrwwrr...
    ..ffwwrrrkwrrrw.
    ..ffwkwrwkkwrrw.
    .t...wwkwwrww...
    t.........f.....
    .........f......
  `,
  { x: 14, y: 3 },
)

const SOUTH_EAST = koi(
  String.raw`
    ...|........
    ...|........
    ..%%........
    --%%@@......
    ...%@@@.....
    ...@@@@@.|..
    ....@@@@@|..
    .....@@@@@..
    ......@@@@#.
    .....--@@@#.
    ........@###
    ..........##
  `,
  `
    ...t........
    ...t........
    ..ff........
    ttfwkw......
    ...wwrw.....
    ...wrrkw.f..
    ....wrrwwf..
    .....wkwrw..
    ......wwrrr.
    .....ffwrrr.
    ........rrrw
    ..........rw
  `,
  { x: 11, y: 11 },
)

const TURNED: Readonly<Record<string, string>> = { '/': '\\', '\\': '/', '-': '|', '|': '-' }

const POSES = [0, 1, 2, 3].flatMap((quarter) => [spin(EAST, quarter), spin(SOUTH_EAST, quarter)])

function koi(glyphs: string, paint: string, head: Point): KoiMap {
  const rows = (art: string) => art.trim().split('\n').map((line) => line.trim())
  const g = rows(glyphs)
  const p = rows(paint)
  const filled = (x: number, y: number) => (g[y]?.[x] ?? '.') !== '.'
  const body = (x: number, y: number) => filled(x, y) && 'wrk'.includes(p[y]?.[x] ?? '.')
  const cells: KoiCell[] = []
  g.forEach((line, y) => {
    for (let x = 0; x < line.length; x++) {
      if (!filled(x, y)) continue
      const role = p[y]?.[x] ?? '.'
      if (!'wrkft'.includes(role)) throw new Error(`koi paint is missing at ${x},${y}`)
      const edge = !body(x, y) || !body(x - 1, y) || !body(x + 1, y) || !body(x, y - 1) || !body(x, y + 1)
      cells.push({ x, y, glyph: line[x], role: role as Role, edge })
    }
  })
  return { w: g[0].length, h: g.length, head, cells }
}

function spin(map: KoiMap, quarters: number): KoiMap {
  let m = map
  for (let i = 0; i < quarters; i++) {
    const h = m.h
    m = {
      w: m.h,
      h: m.w,
      head: { x: h - 1 - m.head.y, y: m.head.x },
      cells: m.cells.map((c) => ({ ...c, x: h - 1 - c.y, y: c.x, glyph: TURNED[c.glyph] ?? c.glyph })),
    }
  }
  return m
}

const poseOf = (heading: number) => (Math.round(heading / (Math.PI / 4)) + 8) % 8

interface Mark {
  readonly x: number
  readonly y: number
  readonly glyph: string
  readonly color: string
}

interface Stamp {
  readonly image: OffscreenCanvas
  readonly anchor: Point
  readonly w: number
  readonly h: number
}

interface Atlas {
  readonly cell: number
  readonly dpr: number
  readonly theme: Theme
  readonly fontReady: boolean
  readonly koi: Map<string, Stamp>
  readonly food: Stamp
  readonly rings: readonly Stamp[]
}

const monoReady = (cell: number) =>
  typeof document !== 'undefined' && document.fonts.check(`${cell}px "Geist Mono"`)

let atlas: Atlas | null = null

function atlasFor(grid: Grid, theme: Theme): Atlas {
  const fontReady = monoReady(grid.cell)
  if (atlas && atlas.cell === grid.cell && atlas.dpr === grid.dpr && atlas.theme === theme && atlas.fontReady === fontReady) {
    return atlas
  }
  const { cell, dpr } = grid
  const accent = ACCENT[theme]
  atlas = {
    cell,
    dpr,
    theme,
    fontReady,
    koi: new Map(),
    food: stamp(1, 1, { x: 0, y: 0 }, [{ x: 0, y: 0, glyph: 'o', color: accent }], cell, dpr),
    rings: [1, 2, 3].map((radius) => ring(radius, accent, cell, dpr)),
  }
  return atlas
}

function koiStamp(a: Atlas, variety: Variety, pose: number, wag: 0 | 1): Stamp {
  const key = `${variety}${pose}${wag}`
  const cached = a.koi.get(key)
  if (cached) return cached
  const map = POSES[pose]
  const art = ART[variety]
  const marks = map.cells
    .filter((c) => !(wag === 1 && c.role === 't') && (art !== 'outline' || c.edge))
    .map((c) => ({
      x: c.x,
      y: c.y,
      glyph: c.glyph,
      color: art === 'outline' ? GHOST_INK[a.theme] : PIGMENT[a.theme][art[c.role]],
    }))
  const made = stamp(map.w, map.h, map.head, marks, a.cell, a.dpr)
  a.koi.set(key, made)
  return made
}

function ring(radius: number, color: string, cell: number, dpr: number): Stamp {
  const size = radius * 2 + 1
  const marks: Mark[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Math.abs(Math.hypot(x - radius, y - radius) - radius) < 0.5) marks.push({ x, y, glyph: '.', color })
    }
  }
  return stamp(size, size, { x: radius, y: radius }, marks, cell, dpr)
}

function stamp(w: number, h: number, anchor: Point, marks: readonly Mark[], cell: number, dpr: number): Stamp {
  const image = new OffscreenCanvas(Math.ceil(w * cell * dpr), Math.ceil(h * cell * dpr))
  const g = image.getContext('2d')
  if (!g) throw new Error('offscreen 2d context is unavailable')
  g.scale(dpr, dpr)
  g.font = `${cell}px "Geist Mono", monospace`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const m of marks) {
    g.fillStyle = m.color
    g.fillText(m.glyph, (m.x + 0.5) * cell, (m.y + 0.5) * cell)
  }
  return { image, anchor, w, h }
}

function blit(ctx: CanvasRenderingContext2D, grid: Grid, s: Stamp, at: Point) {
  const { col, row } = cellAt(grid, at)
  ctx.drawImage(
    s.image,
    grid.origin.x + (col - s.anchor.x) * grid.cell,
    grid.origin.y + (row - s.anchor.y) * grid.cell,
    s.w * grid.cell,
    s.h * grid.cell,
  )
}

export function paintPond(ctx: CanvasRenderingContext2D, grid: Grid, world: World, theme: Theme): void {
  const a = atlasFor(grid, theme)
  ctx.setTransform(grid.dpr, 0, 0, grid.dpr, 0, 0)
  ctx.globalAlpha = 1
  ctx.fillStyle = PAGE_BG[theme]
  ctx.fillRect(0, 0, grid.width, grid.height)
  for (const r of world.ripples) {
    const progress = r.age / r.life
    ctx.globalAlpha = 1 - progress
    blit(ctx, grid, a.rings[Math.min(a.rings.length - 1, Math.floor(progress * a.rings.length))], r.at)
  }
  ctx.globalAlpha = 1
  for (const f of world.food) blit(ctx, grid, a.food, f.at)
  for (const f of world.fish) blit(ctx, grid, koiStamp(a, f.variety, poseOf(f.heading), f.wag < 0.5 ? 0 : 1), f.pos)
}
