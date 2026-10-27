import '@fontsource/geist-mono/latin-400.css'
import './style.css'
import { PAGE_BG } from './generated/tiga-pack'
import { gridMetrics, type Rect } from './grid'
import { ACCENT, paintPond, type Theme } from './ink'
import { createWorld, frameDt, stepWorld, type Device, type PondEnv, type PondInput, type World } from './pond'
import { paintPortrait, revealAt, type Reveal } from './portrait'

type Phase =
  | { readonly kind: 'portrait'; readonly startedAt: number; readonly reveal: Reveal | null }
  | { readonly kind: 'pond'; readonly world: World }

const FEEDS_KEY = 'feeds'

const root = document.documentElement
const canvas = find<HTMLCanvasElement>('canvas')
const skip = find<HTMLButtonElement>('[data-skip]')
const count = find<HTMLOutputElement>('[data-feeds]')
const toggle = find<HTMLButtonElement>('[data-theme-toggle]')
const ctx = canvas.getContext('2d') ?? fail('canvas 2d context is unavailable')
const darkScheme = matchMedia('(prefers-color-scheme: dark)')
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

let phase: Phase = { kind: 'portrait', startedAt: performance.now(), reveal: null }
let env = fit()
let feeds = readFeeds()
let inputs: PondInput[] = []
let lastMs: number | null = null
let raf = 0
let onScreen = true

function find<T extends Element>(selector: string): T {
  return document.querySelector<T>(selector) ?? fail(`index.html is missing ${selector}`)
}

function fail(message: string): never {
  throw new Error(message)
}

function fit(): PondEnv {
  const box = canvas.getBoundingClientRect()
  const grid = gridMetrics({ width: box.width, height: box.height, dpr: devicePixelRatio })
  const w = Math.round(grid.width * grid.dpr)
  const h = Math.round(grid.height * grid.dpr)
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const obstacles: Rect[] = []
  for (const el of document.querySelectorAll('[data-obstacle]')) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) obstacles.push({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height })
  }
  return { grid, obstacles, motion: reducedMotion.matches ? 'still' : 'full' }
}

function theme(): Theme {
  const chosen = root.dataset.theme
  return chosen === 'light' || chosen === 'dark' ? chosen : darkScheme.matches ? 'dark' : 'light'
}

function applyTheme() {
  const t = theme()
  root.style.colorScheme = t
  root.style.setProperty('--bg', PAGE_BG[t])
  root.style.setProperty('--accent', ACCENT[t])
  toggle.textContent = t === 'dark' ? '光' : '暗'
  wake()
}

function readFeeds(): number {
  try {
    const n = Number(localStorage.getItem(FEEDS_KEY) ?? 0)
    return Number.isSafeInteger(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

function addFeeds(n: number) {
  feeds += n
  count.value = String(feeds)
  try {
    localStorage.setItem(FEEDS_KEY, String(feeds))
  } catch {
    return
  }
}

const live = () => !document.hidden && onScreen

function wake() {
  if (!raf && live()) raf = requestAnimationFrame(frame)
}

function sleep() {
  cancelAnimationFrame(raf)
  raf = 0
  lastMs = null
}

function enterPond() {
  if (phase.kind === 'pond') return
  phase = { kind: 'pond', world: createWorld(env, (Math.random() * 2 ** 31) | 0) }
  root.dataset.phase = 'pond'
  wake()
}

function frame(now: number) {
  raf = 0
  const dt = frameDt(lastMs, now)
  lastMs = now
  const t = theme()
  if (phase.kind === 'portrait') {
    const reveal = revealAt(phase.reveal, env.grid, now - phase.startedAt, env.motion, t)
    paintPortrait(ctx, phase.reveal, reveal)
    phase = { ...phase, reveal }
    if (reveal.done) enterPond()
    else wake()
    return
  }
  const step = stepWorld(phase.world, env, inputs, dt)
  inputs = []
  phase = { kind: 'pond', world: step.world }
  if (step.fed > 0) addFeeds(step.fed)
  paintPond(ctx, env.grid, step.world, t)
  if (env.motion === 'full') wake()
}

const deviceOf = (e: PointerEvent): Device | null =>
  e.pointerType === 'touch' ? 'touch' : e.pointerType === 'mouse' || e.pointerType === 'pen' ? 'fine' : null

const onPointer = (kind: PondInput['kind']) => (e: PointerEvent) => {
  const device = deviceOf(e)
  if (!device || phase.kind !== 'pond') return
  if (kind === 'down') canvas.setPointerCapture(e.pointerId)
  inputs.push({ kind, at: { x: e.offsetX, y: e.offsetY }, tMs: e.timeStamp, device })
  wake()
}

const refit = () => {
  env = fit()
  wake()
}

const onLiveChange = () => (live() ? wake() : sleep())

canvas.addEventListener('pointerdown', onPointer('down'))
canvas.addEventListener('pointermove', onPointer('move'))
canvas.addEventListener('pointerup', onPointer('up'))
canvas.addEventListener('click', enterPond)
skip.addEventListener('click', enterPond)
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') enterPond()
})
toggle.addEventListener('click', () => {
  root.dataset.theme = theme() === 'dark' ? 'light' : 'dark'
  applyTheme()
})
darkScheme.addEventListener('change', applyTheme)
reducedMotion.addEventListener('change', refit)
addEventListener('resize', refit)
document.addEventListener('visibilitychange', onLiveChange)

const boxes = new ResizeObserver(refit)
boxes.observe(canvas)
for (const el of document.querySelectorAll('[data-obstacle]')) boxes.observe(el)

new IntersectionObserver(([entry]) => {
  onScreen = entry.isIntersecting
  onLiveChange()
}).observe(canvas)

count.value = String(feeds)
applyTheme()
void document.fonts.ready.then(() => {
  if (phase.kind === 'portrait') phase = { ...phase, reveal: null }
  wake()
})
