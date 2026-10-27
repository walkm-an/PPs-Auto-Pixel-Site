export interface Point {
  readonly x: number
  readonly y: number
}

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface Viewport {
  readonly width: number
  readonly height: number
  readonly dpr: number
}

const gridBrand: unique symbol = Symbol('grid')

export interface Grid {
  readonly [gridBrand]: 'Grid'
  readonly width: number
  readonly height: number
  readonly dpr: number
  readonly cell: number
  readonly cols: number
  readonly rows: number
  readonly origin: Point
}

const positive = (v: number) => (Number.isFinite(v) && v > 0 ? v : 1)

export function gridMetrics(viewport: Viewport): Grid {
  const width = positive(viewport.width)
  const height = positive(viewport.height)
  const dpr = Number.isFinite(viewport.dpr) ? Math.min(2, Math.max(1, viewport.dpr)) : 1
  const cell = width < 720 ? 18 : 12
  const cols = Math.max(1, Math.floor(width / cell))
  const rows = Math.max(1, Math.floor(height / cell))
  return {
    [gridBrand]: 'Grid',
    width,
    height,
    dpr,
    cell,
    cols,
    rows,
    origin: { x: Math.floor((width - cols * cell) / 2), y: Math.floor((height - rows * cell) / 2) },
  }
}

export function cellAt(grid: Grid, p: Point): { readonly col: number; readonly row: number } {
  const col = Math.floor((p.x - grid.origin.x) / grid.cell)
  const row = Math.floor((p.y - grid.origin.y) / grid.cell)
  return {
    col: Math.min(grid.cols - 1, Math.max(0, col)),
    row: Math.min(grid.rows - 1, Math.max(0, row)),
  }
}
