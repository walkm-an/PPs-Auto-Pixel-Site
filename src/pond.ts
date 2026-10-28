import type { Grid, Point, Rect } from './grid'

export type Variety = 'kohaku' | 'showa' | 'ogon' | 'ghost'
export type Device = 'fine' | 'touch'
export type Motion = 'full' | 'still'
export type Press = 'up' | 'calm' | 'scared'

declare const seconds: unique symbol
export type Dt = number & { readonly [seconds]: true }

export interface PondEnv {
  readonly grid: Grid
  readonly obstacles: readonly Rect[]
  readonly motion: Motion
}

export interface PondInput {
  readonly kind: 'down' | 'move' | 'up'
  readonly at: Point
  readonly tMs: number
  readonly device: Device
}

export type Mood =
  | { readonly kind: 'cruise'; readonly wander: number }
  | { readonly kind: 'startled'; readonly from: Point; readonly until: number }

export interface Fish {
  readonly id: number
  readonly variety: Variety
  readonly pos: Point
  readonly heading: number
  readonly speed: number
  readonly wag: number
  readonly mood: Mood
}

export interface Food {
  readonly at: Point
  readonly age: number
}

export interface Ripple {
  readonly at: Point
  readonly age: number
  readonly life: number
}

export interface PointerSample {
  readonly at: Point
  readonly tMs: number
  readonly device: Device
}

export interface World {
  readonly t: number
  readonly rng: number
  readonly nextId: number
  readonly fish: readonly Fish[]
  readonly food: readonly Food[]
  readonly ripples: readonly Ripple[]
  readonly press: Press
  readonly pointer: PointerSample | null
}

const CRUISE = 3
const STARTLED = 6
const MAX_SPEED = 6
const SEEK_RADIUS = 12
const STARTLE_RADIUS = 8
const CLEARANCE = 0.75
const SEPARATION = 5.5
const BITE = 0.7
const EDGE = 1
const EDGE_MARGIN = 3
const LOOKAHEAD = 2.5
const STARTLE_S = 0.7
const FOOD_S = 4
const RIPPLE_S = 0.7
const MAX_FOOD = 6
const MAX_RIPPLES = 6
const TURN = 2.4
const STEER = 3
const SCARE_SPEED: Readonly<Record<Device, number>> = { fine: 750, touch: 1500 }
const WEIGHT: Readonly<Record<Variety, number>> = { kohaku: 3, showa: 3, ogon: 2, ghost: 2 }
const VARIETIES = Object.keys(WEIGHT) as Variety[]

interface Box {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

interface Rand {
  s: number
}

type Entry = 'scatter' | 'edge'

export function frameDt(lastMs: number | null, nowMs: number): Dt {
  const ms = lastMs === null ? 0 : Math.min(1000 / 20, Math.max(0, nowMs - lastMs))
  return (ms / 1000) as Dt
}

export function createWorld(env: PondEnv, seed: number): World {
  const r = { s: seed | 0 }
  const { fish, nextId } = reconcile([], env, r, 1, 'scatter')
  return { t: 0, rng: r.s, nextId, fish, food: [], ripples: [], press: 'up', pointer: null }
}

export function stepWorld(
  world: World,
  env: PondEnv,
  inputs: readonly PondInput[],
  dt: Dt,
): { world: World; fed: number } {
  const { cell } = env.grid
  const r = { s: world.rng }
  let { press, pointer, fish, food, ripples } = world
  let fed = 0

  for (const input of inputs) {
    const sample = { at: input.at, tMs: input.tMs, device: input.device }
    switch (input.kind) {
      case 'down':
        press = 'calm'
        pointer = sample
        break
      case 'move': {
        const prev = pointer?.device === input.device ? pointer : null
        if (prev && input.tMs <= prev.tMs) break
        const speed = prev ? (distance(prev.at, input.at) * 1000) / (input.tMs - prev.tMs) : 0
        if (speed >= SCARE_SPEED[input.device]) {
          fish = startle(fish, input.at, world.t, cell)
          if (press === 'calm') press = 'scared'
        }
        pointer = sample
        break
      }
      case 'up':
        if (press === 'calm') {
          fed += 1
          food = [...food, { at: input.at, age: 0 }].slice(-MAX_FOOD)
          if (env.motion === 'full') ripples = withRipple(ripples, input.at)
        }
        press = 'up'
        pointer = sample
        break
    }
  }

  const roster = reconcile(fish, env, r, world.nextId, 'edge')
  fish = roster.fish

  if (env.motion === 'full') {
    const school = fish
    fish = school.map((f) => swim(f, school, food, env, world.t, dt, r))
    const uneaten: Food[] = []
    for (const f of food) {
      if (fish.some((k) => distance(k.pos, f.at) <= BITE * cell)) ripples = withRipple(ripples, f.at)
      else uneaten.push(f)
    }
    food = uneaten
  } else {
    fish = fitStill(fish, env)
  }

  return {
    world: {
      t: world.t + dt,
      rng: r.s,
      nextId: roster.nextId,
      fish,
      food: food.map((f) => ({ ...f, age: f.age + dt })).filter((f) => f.age < FOOD_S),
      ripples: ripples.map((w) => ({ ...w, age: w.age + dt })).filter((w) => w.age < w.life),
      press,
      pointer,
    },
    fed,
  }
}

const fishTarget = (grid: Grid) => Math.min(14, Math.max(5, Math.round((grid.cols * grid.rows) / 480)))

function reconcile(fish: readonly Fish[], env: PondEnv, r: Rand, nextId: number, entry: Entry) {
  const target = fishTarget(env.grid)
  if (fish.length >= target) return { fish: fish.slice(0, target), nextId }
  const grown = [...fish]
  let id = nextId
  while (grown.length < target) grown.push(spawn(env, r, id++, entry))
  return { fish: grown, nextId: id }
}

function spawn(env: PondEnv, r: Rand, id: number, entry: Entry): Fish {
  const w = waterOf(env.grid)
  const x = lerp(w.x0, w.x1, rand(r))
  const y = lerp(w.y0, w.y1, rand(r))
  const side = Math.floor(rand(r) * 4)
  const turn = rand(r)
  const edges = [
    { x, y: w.y0 },
    { x: w.x1, y },
    { x, y: w.y1 },
    { x: w.x0, y },
  ]
  return {
    id,
    variety: pickVariety(rand(r)),
    pos: escape(entry === 'scatter' ? { x, y } : edges[side], env),
    heading: entry === 'scatter' ? turn * 2 * Math.PI : ((side + 1) * Math.PI) / 2 + turn - 0.5,
    speed: CRUISE * env.grid.cell,
    wag: rand(r),
    mood: { kind: 'cruise', wander: 0 },
  }
}

function pickVariety(u: number): Variety {
  let left = u * VARIETIES.reduce((sum, v) => sum + WEIGHT[v], 0)
  return VARIETIES.find((v) => (left -= WEIGHT[v]) < 0) ?? VARIETIES[VARIETIES.length - 1]
}

function startle(fish: readonly Fish[], from: Point, t: number, cell: number): readonly Fish[] {
  return fish.map(
    (f): Fish =>
      distance(f.pos, from) <= STARTLE_RADIUS * cell
        ? { ...f, mood: { kind: 'startled', from, until: t + STARTLE_S } }
        : f,
  )
}

const withRipple = (ripples: readonly Ripple[], at: Point): readonly Ripple[] =>
  [...ripples, { at, age: 0, life: RIPPLE_S }].slice(-MAX_RIPPLES)

function swim(
  f: Fish,
  school: readonly Fish[],
  food: readonly Food[],
  env: PondEnv,
  t: number,
  dt: number,
  r: Rand,
): Fish {
  const { cell } = env.grid
  const startled = f.mood.kind === 'startled' && t < f.mood.until ? f.mood : null
  const wander = f.mood.kind === 'cruise' ? f.mood.wander : 0
  const drift = clamp(wander + (rand(r) - 0.5) * 2 * dt - wander * 0.4 * dt, -1, 1)

  let sx = Math.cos(f.heading + drift * 0.4)
  let sy = Math.sin(f.heading + drift * 0.4)
  let target = CRUISE * cell
  const bait = startled ? null : nearest(food, f.pos, SEEK_RADIUS * cell)
  if (startled) {
    const away = toward(startled.from, f.pos)
    sx += away.x * 3
    sy += away.y * 3
    target = STARTLED * cell
  } else if (bait) {
    const to = toward(f.pos, bait.at)
    sx += to.x * 3
    sy += to.y * 3
    target = clamp(distance(f.pos, bait.at) * 1.5, 0.8 * cell, 4 * cell)
  }

  const probe = {
    x: f.pos.x + Math.cos(f.heading) * LOOKAHEAD * cell,
    y: f.pos.y + Math.sin(f.heading) * LOOKAHEAD * cell,
  }
  const ahead = repel(probe, env)
  const here = repel(f.pos, env)
  sx += ahead.x + here.x
  sy += ahead.y + here.y

  const gap = SEPARATION * cell
  for (const o of school) {
    const d = distance(f.pos, o.pos)
    if (o.id === f.id || d === 0 || d >= gap) continue
    const k = (1 - d / gap) / d
    sx += (f.pos.x - o.pos.x) * k
    sy += (f.pos.y - o.pos.y) * k
  }

  const maxTurn = (startled ? 2 : 1) * TURN * dt
  const heading = wrapAngle(
    f.heading + clamp(wrapAngle(Math.atan2(sy, sx) - f.heading) * STEER * dt, -maxTurn, maxTurn),
  )
  const speed = Math.min(MAX_SPEED * cell, f.speed + (target - f.speed) * Math.min(1, 3 * dt))
  const w = waterOf(env.grid)
  const moved = {
    x: clamp(f.pos.x + Math.cos(heading) * speed * dt, w.x0, w.x1),
    y: clamp(f.pos.y + Math.sin(heading) * speed * dt, w.y0, w.y1),
  }

  return {
    ...f,
    pos: escape(moved, env),
    heading,
    speed,
    wag: (f.wag + (speed * dt) / (2 * cell)) % 1,
    mood: startled ?? { kind: 'cruise', wander: drift },
  }
}

function repel(p: Point, env: PondEnv): Point {
  const { cell } = env.grid
  const w = waterOf(env.grid)
  const margin = EDGE_MARGIN * cell
  let x = wall(p.x - w.x0, margin) - wall(w.x1 - p.x, margin)
  let y = wall(p.y - w.y0, margin) - wall(w.y1 - p.y, margin)
  for (const o of env.obstacles) {
    const b = inflate(o, CLEARANCE * cell)
    if (contains(b, p)) {
      const out = toward(p, exitPoint(p, b, w))
      x += out.x * 2
      y += out.y * 2
      continue
    }
    const dx = p.x - clamp(p.x, b.x0, b.x1)
    const dy = p.y - clamp(p.y, b.y0, b.y1)
    const d = Math.hypot(dx, dy)
    if (d === 0 || d >= margin) continue
    const k = (2 * (1 - d / margin)) / d
    x += dx * k
    y += dy * k
  }
  return { x, y }
}

const wall = (gap: number, margin: number) => (gap < margin ? 2 * (1 - Math.max(0, gap) / margin) : 0)

function fitStill(fish: readonly Fish[], env: PondEnv): Fish[] {
  const w = waterOf(env.grid)
  const inside = (p: Point) => p.x >= w.x0 && p.x <= w.x1 && p.y >= w.y0 && p.y <= w.y1
  if (fish.every((f) => inside(f.pos))) return fish.map((f) => ({ ...f, pos: escape(f.pos, env) }))
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const f of fish) {
    minX = Math.min(minX, f.pos.x)
    maxX = Math.max(maxX, f.pos.x)
    minY = Math.min(minY, f.pos.y)
    maxY = Math.max(maxY, f.pos.y)
  }
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const width = w.x1 - w.x0
  const height = w.y1 - w.y0
  return fish.map((f) => ({
    ...f,
    pos: escape(
      {
        x: w.x0 + ((f.pos.x - minX) / spanX) * width,
        y: w.y0 + ((f.pos.y - minY) / spanY) * height,
      },
      env,
    ),
  }))
}

function escape(p: Point, env: PondEnv): Point {
  const w = waterOf(env.grid)
  const boxes = env.obstacles.map((o) => inflate(o, CLEARANCE * env.grid.cell))
  let q = p
  for (let pass = 0; pass <= boxes.length; pass++) {
    const hit = boxes.find((b) => contains(b, q))
    if (!hit) break
    q = exitPoint(q, hit, w)
  }
  return q
}

function exitPoint(p: Point, b: Box, water: Box): Point {
  const exits = [
    { x: b.x0, y: p.y },
    { x: b.x1, y: p.y },
    { x: p.x, y: b.y0 },
    { x: p.x, y: b.y1 },
  ]
  const wet = exits.filter((e) => e.x >= water.x0 && e.x <= water.x1 && e.y >= water.y0 && e.y <= water.y1)
  return (wet.length ? wet : exits).reduce((best, e) => (distance(p, e) < distance(p, best) ? e : best))
}

function waterOf(grid: Grid): Box {
  const inset = EDGE * grid.cell
  return {
    x0: grid.origin.x + inset,
    y0: grid.origin.y + inset,
    x1: grid.origin.x + grid.cols * grid.cell - inset,
    y1: grid.origin.y + grid.rows * grid.cell - inset,
  }
}

const inflate = (o: Rect, pad: number): Box => ({ x0: o.x - pad, y0: o.y - pad, x1: o.x + o.w + pad, y1: o.y + o.h + pad })

const contains = (b: Box, p: Point) => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1

function nearest(food: readonly Food[], p: Point, radius: number): Food | null {
  let best: Food | null = null
  let bestD = radius
  for (const f of food) {
    const d = distance(p, f.at)
    if (d <= bestD) {
      best = f
      bestD = d
    }
  }
  return best
}

function toward(from: Point, to: Point): Point {
  const d = distance(from, to) || 1
  return { x: (to.x - from.x) / d, y: (to.y - from.y) / d }
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, u: number) => a + (b - a) * u
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

function rand(r: Rand): number {
  r.s = (r.s + 0x6d2b79f5) | 0
  let t = Math.imul(r.s ^ (r.s >>> 15), 1 | r.s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
