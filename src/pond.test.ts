import { describe, expect, it } from 'vitest'
import { gridMetrics, sameGrid, type Grid, type Point, type Rect } from './grid'
import { fishBody, fishHead, fishInk, inkBleed } from './ink'
import { createWorld, frameDt, stepWorld, type Device, type Fish, type Motion, type PondEnv, type PondInput } from './pond'
import { pausePortrait, placePortrait, portraitElapsed, resumePortrait, revealAt } from './portrait'

const desktop = gridMetrics({ width: 1200, height: 800, dpr: 1 })
const phone = gridMetrics({ width: 390, height: 844, dpr: 3 })
const pond = (grid: Grid, obstacles: readonly Rect[] = [], motion: Motion = 'full'): PondEnv => ({
  grid,
  obstacles,
  motion,
})
const noTime = frameDt(null, 0)
const positions = (fish: readonly { pos: Point }[]) => fish.map((f) => f.pos)

const tap = (at: Point, tMs: number, device: Device = 'fine'): PondInput[] => [
  { kind: 'down', at, tMs, device },
  { kind: 'up', at, tMs: tMs + 80, device },
]

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

function inkCovered(fish: Fish, grid: Grid): boolean {
  const body = fishBody(fish, grid)
  return fishInk(fish, grid).every((cell) => {
    const cx = cell.x + cell.w / 2
    const cy = cell.y + cell.h / 2
    return body.some((blot) => Math.hypot(blot.x - cx, blot.y - cy) <= blot.r + 1e-6)
  })
}

function blotClearance(blot: { x: number; y: number; r: number }, rect: Rect): number {
  const x1 = rect.x + rect.w
  const y1 = rect.y + rect.h
  const px = Math.min(x1, Math.max(rect.x, blot.x))
  const py = Math.min(y1, Math.max(rect.y, blot.y))
  const inside = blot.x > rect.x && blot.x < x1 && blot.y > rect.y && blot.y < y1
  if (inside) return -(Math.min(blot.x - rect.x, x1 - blot.x, blot.y - rect.y, y1 - blot.y) + blot.r)
  return Math.hypot(blot.x - px, blot.y - py) - blot.r
}

function feedsAfterDrag(device: Device, pxPerSecond: number): number {
  const env = pond(desktop)
  const start = { x: 300, y: 300 }
  const end = { x: start.x + pxPerSecond * 0.1, y: start.y }
  const drag: PondInput[] = [
    { kind: 'down', at: start, tMs: 1000, device },
    { kind: 'move', at: end, tMs: 1100, device },
    { kind: 'up', at: end, tMs: 1120, device },
  ]
  return stepWorld(createWorld(env, 1), env, drag, noTime).fed
}

describe('gridMetrics', () => {
  it('uses a 12px cell from 720px up and an 18px cell below', () => {
    expect(gridMetrics({ width: 1200, height: 800, dpr: 1 }).cell).toBe(12)
    expect(gridMetrics({ width: 719, height: 800, dpr: 1 }).cell).toBe(18)
  })

  it('caps a phone at dpr 2 with a coarser, narrower grid', () => {
    expect(phone.dpr).toBe(2)
    expect(phone.cell).toBe(18)
    expect(phone.cols).toBeLessThan(desktop.cols)
  })

  it('matches only when width, height, dpr, cell, cols, rows, and origin match', () => {
    expect(sameGrid(desktop, gridMetrics({ width: 1200, height: 800, dpr: 1 }))).toBe(true)
    expect(sameGrid(desktop, phone)).toBe(false)
  })

  it('repairs a broken viewport into a one-cell grid', () => {
    const grid = gridMetrics({ width: Number.NaN, height: -4, dpr: 0 })
    expect([grid.width, grid.height, grid.dpr, grid.cols, grid.rows]).toEqual([1, 1, 1, 1, 1])
  })
})

describe('createWorld', () => {
  it('stocks a phone pond with fewer fish than a desktop pond, 5 to 14 each', () => {
    const small = createWorld(pond(phone), 1).fish.length
    const large = createWorld(pond(desktop), 1).fish.length
    expect(small).toBeLessThan(large)
    for (const n of [small, large]) {
      expect(n).toBeGreaterThanOrEqual(5)
      expect(n).toBeLessThanOrEqual(14)
    }
  })

  it('builds the same pond from the same seed', () => {
    expect(createWorld(pond(desktop), 42)).toEqual(createWorld(pond(desktop), 42))
  })

  it('keeps existing fish when the grid shrinks', () => {
    const world = createWorld(pond(desktop), 5)
    const shrunk = stepWorld(world, pond(phone), [], noTime).world
    const ids = new Set(world.fish.map((f) => f.id))
    expect(shrunk.fish.length).toBe(createWorld(pond(phone), 5).fish.length)
    expect(shrunk.fish.every((f) => ids.has(f.id))).toBe(true)
  })
})

describe('feeding', () => {
  it('feeds on a mouse click that never moves', () => {
    const env = pond(desktop)
    expect(stepWorld(createWorld(env, 1), env, tap({ x: 300, y: 300 }, 1000), noTime).fed).toBe(1)
  })

  it('does not feed after a 900 px/s mouse swipe', () => {
    expect(feedsAfterDrag('fine', 900)).toBe(0)
  })

  it('feeds after a 1000 px/s touch drag', () => {
    expect(feedsAfterDrag('touch', 1000)).toBe(1)
  })

  it('does not feed after a 1600 px/s touch swipe', () => {
    expect(feedsAfterDrag('touch', 1600)).toBe(0)
  })
})

describe('stepWorld', () => {
  it('keeps every head outside an obstacle for 3600 frames, even with food inside it', () => {
    const box = { x: 420, y: 260, w: 360, h: 240 }
    const env = pond(desktop, [box])
    const lures = [
      { x: box.x + 10, y: box.y + box.h / 2 },
      { x: box.x + box.w / 2, y: box.y + 10 },
      { x: box.x + box.w - 10, y: box.y + box.h / 2 },
      { x: box.x + box.w / 2, y: box.y + box.h - 10 },
    ]
    let world = createWorld(env, 7)
    const start = positions(world.fish)
    let inside = 0
    let closest = Infinity
    for (let i = 0; i < 3600; i++) {
      const lure = i % 120 === 0 ? tap(lures[(i / 120) % lures.length], i * 16) : []
      world = stepWorld(world, env, lure, frameDt(i * 16, (i + 1) * 16)).world
      for (const fish of world.fish) {
        const head = fishHead(fish, desktop)
        if (head.x > box.x && head.x < box.x + box.w && head.y > box.y && head.y < box.y + box.h) inside += 1
        const dx = Math.max(box.x - head.x, 0, head.x - box.x - box.w)
        const dy = Math.max(box.y - head.y, 0, head.y - box.y - box.h)
        closest = Math.min(closest, Math.hypot(dx, dy))
      }
    }
    expect(inside).toBe(0)
    expect(closest).toBeLessThan(2 * desktop.cell)
    expect(positions(world.fish)).not.toEqual(start)
  })

  it('bites food that sits on the drawn mouth', () => {
    const env = pond(desktop)
    const world = createWorld(env, 4)
    const at = fishHead(world.fish[0], desktop)
    const stepped = stepWorld(world, env, tap(at, 1000), frameDt(0, 16)).world
    expect(stepped.food).toHaveLength(0)
    const eater = stepped.fish.reduce(
      (best, fish) => {
        const head = fishHead(fish, desktop)
        const dist = Math.hypot(head.x - at.x, head.y - at.y)
        return dist < best.dist ? { fish, dist } : best
      },
      { fish: stepped.fish[0], dist: Infinity },
    )
    expect(eater.dist).toBeLessThanOrEqual(0.7 * desktop.cell)
    expect(Math.hypot(eater.fish.pos.x - at.x, eater.fish.pos.y - at.y)).toBeGreaterThan(eater.dist)
  })

  it('keeps the drawn body outside the footer', () => {
    const stock = createWorld(pond(desktop), 4)
    for (const fish of stock.fish) {
      for (let turn = 0; turn < 8; turn++) {
        for (let wag = 0; wag < 4; wag++) {
          expect(inkCovered({ ...fish, heading: (turn / 8) * Math.PI * 2, wag: wag / 4 }, desktop)).toBe(true)
        }
      }
    }
    const footer = { x: 20, y: 744, w: 324, h: 40 }
    const env = pond(desktop, [footer])
    let world = createWorld(env, 7)
    let closest = Infinity
    let inkOverlap = 0
    const bleed = inkBleed(desktop)
    const lure = { x: footer.x + footer.w / 2, y: footer.y + footer.h / 2 }
    for (let i = 0; i < 2400; i++) {
      const lureInput = i % 90 === 0 ? tap(lure, i * 16) : []
      world = stepWorld(world, env, lureInput, frameDt(i * 16, (i + 1) * 16)).world
      for (const fish of world.fish) {
        for (const blot of fishBody(fish, desktop)) closest = Math.min(closest, blotClearance(blot, footer) - bleed)
        if (i % 30 === 0) {
          for (const cell of fishInk(fish, desktop)) {
            if (overlaps(cell, footer)) inkOverlap += 1
          }
        }
      }
    }
    expect(closest).toBeGreaterThanOrEqual(-0.01)
    expect(closest).toBeLessThan(2 * desktop.cell)
    expect(inkOverlap).toBe(0)
  })

  it('caps a long gap at one 50 ms step and starts a resumed clock at zero', () => {
    expect(Number(frameDt(0, 60000))).toBe(Number(frameDt(0, 50)))
    expect(Number(frameDt(0, 50))).toBeGreaterThan(0)
    expect(Number(frameDt(null, 60000))).toBe(0)
  })

  it('keeps every still fish inside the grid after the pond shrinks', () => {
    const wide = pond(desktop, [], 'still')
    const narrow = pond(phone, [], 'still')
    const world = createWorld(wide, 3)
    const bounds = {
      x0: phone.origin.x,
      y0: phone.origin.y,
      x1: phone.origin.x + phone.cols * phone.cell,
      y1: phone.origin.y + phone.rows * phone.cell,
    }
    const outside = world.fish.filter((f) => {
      const head = fishHead(f, desktop)
      return head.x < bounds.x0 || head.x > bounds.x1 || head.y < bounds.y0 || head.y > bounds.y1
    })
    expect(outside.length).toBeGreaterThan(0)
    const shrunk = stepWorld(world, narrow, [], noTime).world
    expect(shrunk.fish.length).toBeGreaterThan(0)
    for (const fish of shrunk.fish) {
      const head = fishHead(fish, phone)
      expect(head.x).toBeGreaterThanOrEqual(bounds.x0)
      expect(head.x).toBeLessThanOrEqual(bounds.x1)
      expect(head.y).toBeGreaterThanOrEqual(bounds.y0)
      expect(head.y).toBeLessThanOrEqual(bounds.y1)
    }
    const columns = new Set(shrunk.fish.map((f) => Math.floor((fishHead(f, phone).x - bounds.x0) / phone.cell)))
    expect(columns.size).toBeGreaterThan(1)
    expect(positions(stepWorld(shrunk, narrow, [], noTime).world.fish)).toEqual(positions(shrunk.fish))
  })

  it('holds a still pond in place and still feeds on a calm tap', () => {
    const env = pond(desktop, [], 'still')
    const world = createWorld(env, 3)
    const tenSeconds = frameDt(0, 10000)
    const held = stepWorld(world, env, [], tenSeconds).world
    expect(positions(held.fish)).toEqual(positions(world.fish))
    expect(positions(stepWorld(world, pond(desktop), [], tenSeconds).world.fish)).not.toEqual(positions(world.fish))
    expect(stepWorld(held, env, tap({ x: 300, y: 300 }, 1000), tenSeconds).fed).toBe(1)
  })
})

describe('revealAt', () => {
  it('shows every cell on the first still frame and finishes at 1800ms', () => {
    const first = revealAt(null, desktop, 0, 'still', 'dark')
    expect(first.painted).toBe(first.cells.length)
    expect(first.done).toBe(false)
    expect(revealAt(first, desktop, 1799, 'still', 'dark').done).toBe(false)
    expect(revealAt(first, desktop, 1800, 'still', 'dark').done).toBe(true)
  })

  it('does not advance the portrait while the clock is paused', () => {
    const running = resumePortrait({ elapsed: 0, mark: null }, 1000)
    const shown = revealAt(null, desktop, portraitElapsed(running, 1500), 'full', 'dark')
    const paused = pausePortrait(running, 1500)
    expect(portraitElapsed(paused, 9000)).toBe(portraitElapsed(running, 1500))
    const held = revealAt(shown, desktop, portraitElapsed(paused, 9000), 'full', 'dark')
    expect(held.painted).toBe(shown.painted)
    expect(held.done).toBe(false)
    const resumed = resumePortrait(paused, 9000)
    expect(portraitElapsed(resumed, 9200)).toBe(portraitElapsed(running, 1500) + 200)
    expect(revealAt(held, desktop, portraitElapsed(resumed, 9200), 'full', 'dark').painted).toBeGreaterThan(held.painted)
  })

  it('reveals a moving portrait from the center outward', () => {
    const start = revealAt(null, desktop, 0, 'full', 'dark')
    const mid = revealAt(start, desktop, 900, 'full', 'dark')
    expect(start.painted).toBe(0)
    expect(mid.painted).toBeGreaterThan(0)
    expect(mid.painted).toBeLessThan(start.cells.length)
    expect(mid.cells).toBe(start.cells)
  })
})

describe('placePortrait', () => {
  it('fits a phone grid with fewer cells than a desktop grid', () => {
    const small = gridMetrics({ width: 390, height: 844, dpr: 1 })
    const cells = placePortrait(small)
    expect(cells.length).toBeGreaterThan(0)
    for (const c of cells) {
      expect(c.col).toBeGreaterThanOrEqual(0)
      expect(c.col).toBeLessThan(small.cols)
      expect(c.row).toBeGreaterThanOrEqual(0)
      expect(c.row).toBeLessThan(small.rows)
    }
    expect(cells.length).toBeLessThan(placePortrait(desktop).length)
  })

  it('starts nearer the portrait center than it finishes', () => {
    const cells = placePortrait(desktop)
    const midCol = (Math.min(...cells.map((c) => c.col)) + Math.max(...cells.map((c) => c.col))) / 2
    const midRow = (Math.min(...cells.map((c) => c.row)) + Math.max(...cells.map((c) => c.row))) / 2
    const fromCenter = (c: { col: number; row: number }) => Math.hypot(c.col - midCol, c.row - midRow)
    expect(fromCenter(cells[0])).toBeLessThan(fromCenter(cells[cells.length - 1]))
  })
})
