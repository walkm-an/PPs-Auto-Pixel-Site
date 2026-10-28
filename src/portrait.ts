import { CELL, PAGE_BG, TIGA_GLYPHS, tigaPack } from './generated/tiga-pack'
import { sameGrid, type Grid } from './grid'
import type { Theme } from './ink'
import type { Motion } from './pond'

export interface PortraitCell {
  readonly col: number
  readonly row: number
  readonly glyph: number
  readonly fill: string
}

export interface Reveal {
  readonly grid: Grid
  readonly theme: Theme
  readonly cells: readonly PortraitCell[]
  readonly painted: number
  readonly done: boolean
}

export interface PortraitClock {
  readonly elapsed: number
  readonly mark: number | null
}

export function resumePortrait(clock: PortraitClock, now: number): PortraitClock {
  if (clock.mark !== null) return clock
  return { elapsed: clock.elapsed, mark: now }
}

export function pausePortrait(clock: PortraitClock, now: number): PortraitClock {
  if (clock.mark === null) return clock
  return { elapsed: clock.elapsed + (now - clock.mark), mark: null }
}

export function portraitElapsed(clock: PortraitClock, now: number): number {
  return clock.mark === null ? clock.elapsed : clock.elapsed + (now - clock.mark)
}

const REVEAL_MS = 1800
const SOURCE = Uint8Array.from(atob(tigaPack.cells), (c) => c.charCodeAt(0))

export function placePortrait(grid: Grid): PortraitCell[] {
  const scale = Math.max(1, Math.ceil(tigaPack.cols / grid.cols), Math.ceil(tigaPack.rows / grid.rows))
  const left = Math.floor((grid.cols - Math.ceil(tigaPack.cols / scale)) / 2)
  const top = Math.floor((grid.rows - Math.ceil(tigaPack.rows / scale)) / 2)
  const buckets = new Map<number, { col: number; row: number; glyph: number; r: number; g: number; b: number; n: number }>()
  for (let o = 0; o < SOURCE.length; o += CELL.bytes) {
    const col = Math.floor(SOURCE[o + CELL.x] / scale)
    const row = Math.floor(SOURCE[o + CELL.y] / scale)
    const key = row * tigaPack.cols + col
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += SOURCE[o + CELL.r]
      bucket.g += SOURCE[o + CELL.g]
      bucket.b += SOURCE[o + CELL.b]
      bucket.n += 1
    } else {
      buckets.set(key, {
        col,
        row,
        glyph: SOURCE[o + CELL.glyph],
        r: SOURCE[o + CELL.r],
        g: SOURCE[o + CELL.g],
        b: SOURCE[o + CELL.b],
        n: 1,
      })
    }
  }
  return Array.from(buckets.values(), (b) => ({
    col: left + b.col,
    row: top + b.row,
    glyph: b.glyph,
    fill: `rgb(${Math.round(b.r / b.n)}, ${Math.round(b.g / b.n)}, ${Math.round(b.b / b.n)})`,
  }))
}

export function revealAt(prev: Reveal | null, grid: Grid, elapsedMs: number, motion: Motion, theme: Theme): Reveal {
  const kept = prev && prev.theme === theme && sameGrid(prev.grid, grid) ? prev : null
  const cells = kept ? kept.cells : placePortrait(grid)
  const from = kept ? kept.painted : 0
  const due = motion === 'still' ? cells.length : Math.floor((cells.length * Math.max(0, elapsedMs)) / REVEAL_MS)
  const shown = Math.max(from, Math.min(cells.length, due))
  return { grid, theme, cells, painted: shown, done: elapsedMs >= REVEAL_MS }
}

export function paintPortrait(ctx: CanvasRenderingContext2D, prev: Reveal | null, next: Reveal): void {
  const kept = prev !== null && prev.cells === next.cells && prev.theme === next.theme
  const { grid } = next
  ctx.setTransform(grid.dpr, 0, 0, grid.dpr, 0, 0)
  if (!kept) {
    ctx.fillStyle = PAGE_BG[next.theme]
    ctx.fillRect(0, 0, grid.width, grid.height)
  }
  ctx.font = `${grid.cell}px "Geist Mono", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const half = grid.cell / 2
  const from = kept ? prev.painted : 0
  for (let i = from; i < next.painted; i++) {
    const c = next.cells[i]
    ctx.fillStyle = c.fill
    ctx.fillText(TIGA_GLYPHS[c.glyph], grid.origin.x + c.col * grid.cell + half, grid.origin.y + c.row * grid.cell + half)
  }
}
