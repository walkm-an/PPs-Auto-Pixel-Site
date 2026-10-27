import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const PAGE = process.env.PROVE_URL ?? 'http://127.0.0.1:4173/'
const OUT = process.env.PROVE_OUT ?? '/tmp/pond-proof'
const CHROME = process.env.CHROME ?? 'google-chrome'
mkdirSync(OUT, { recursive: true })

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    '--user-data-dir=/tmp/chrome-prove',
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const fail = (message) => {
  console.error('FAIL', message)
  chrome.kill()
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function debuggerUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version')
      if (res.ok) return (await res.json()).webSocketDebuggerUrl
    } catch {}
    await sleep(100)
  }
  fail('chrome debugger did not open')
}

function cdp(url) {
  const ws = new WebSocket(url)
  let id = 0
  const pending = new Map()
  const listeners = []
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve())
    ws.addEventListener('error', () => reject(new Error('cdp socket failed')))
  })
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const waiter = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)))
      else waiter.resolve(msg.result)
    } else if (msg.method) {
      for (const fn of listeners) fn(msg)
    }
  })
  return {
    ready,
    on: (fn) => listeners.push(fn),
    send(method, params = {}, sessionId) {
      const msgId = ++id
      return new Promise((resolve, reject) => {
        pending.set(msgId, { resolve, reject })
        const msg = { id: msgId, method, params }
        if (sessionId) msg.sessionId = sessionId
        ws.send(JSON.stringify(msg))
      })
    },
  }
}

const errors = []
let session

async function send(method, params) {
  return session.send(method, params)
}

async function evalJson(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) fail(`eval ${expression.slice(0, 80)} :: ${JSON.stringify(result.exceptionDetails)}`)
  return result.result.value
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
}

async function mouse(type, x, y) {
  await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
}

async function click(x, y) {
  await mouse('mousePressed', x, y)
  await mouse('mouseReleased', x, y)
}

async function go(features, metrics) {
  await send('Emulation.setDeviceMetricsOverride', metrics)
  await send('Emulation.setEmulatedMedia', { features })
  await send('Network.clearBrowserCache')
  await send('Page.navigate', { url: PAGE })
  await sleep(50)
  for (let i = 0; i < 50; i++) {
    const ready = await evalJson('document.readyState')
    const canvas = await evalJson('!!document.querySelector("canvas")')
    if (ready === 'complete' && canvas) return
    await sleep(50)
  }
  fail('page did not load')
}

const dark = [
  { name: 'prefers-color-scheme', value: 'dark' },
  { name: 'prefers-reduced-motion', value: 'no-preference' },
]
const still = [
  { name: 'prefers-color-scheme', value: 'dark' },
  { name: 'prefers-reduced-motion', value: 'reduce' },
]
const desktop = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }
const phone = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }

const report = {}

try {
  const browser = cdp(await debuggerUrl())
  await browser.ready
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
  session = {
    send(method, params = {}) {
      return browser.send(method, params, sessionId)
    },
  }
  browser.on((msg) => {
    if (msg.sessionId !== sessionId) return
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text)
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
    }
  })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      const orig = window.requestAnimationFrame
      window.__frames = []
      window.requestAnimationFrame = function (cb) {
        return orig.call(window, (t) => {
          const a = performance.now()
          const out = cb(t)
          window.__frames.push({ t, dur: performance.now() - a })
          return out
        })
      }
    })()`,
  })

  const ink = () =>
    evalJson(`(() => {
      const c = document.querySelector('canvas')
      const g = c.getContext('2d')
      const { data, width, height } = g.getImageData(0, 0, c.width, c.height)
      const regions = { all: 0, mid: 0, corner: 0 }
      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          const i = (y * width + x) * 4
          const plain = data[i] < 30 && data[i + 1] < 30 && data[i + 2] < 30
          if (plain) continue
          regions.all += 1
          const cx = Math.abs(x - width / 2) < width * 0.18 && Math.abs(y - height / 2) < height * 0.18
          const corner = x < width * 0.12 && y < height * 0.12
          if (cx) regions.mid += 1
          if (corner) regions.corner += 1
        }
      }
      return regions
    })()`)

  await go(dark, desktop)
  await sleep(250)
  const phaseEarly = await evalJson('document.documentElement.dataset.phase')
  const inkEarly = await ink()
  await shot('portrait-250ms')
  if (phaseEarly !== 'portrait') fail(`expected portrait at 250ms, got ${phaseEarly}`)
  if (inkEarly.all < 20) fail(`portrait at 250ms is blank (${inkEarly.all})`)
  if (inkEarly.mid <= inkEarly.corner) fail(`center-out failed mid ${inkEarly.mid} corner ${inkEarly.corner}`)

  const skipBox = await evalJson(`(() => {
    const r = document.querySelector('[data-skip]').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: document.querySelector('[data-skip]').textContent }
  })()`)
  if (skipBox.text !== '跳过') fail(`skip label ${skipBox.text}`)
  const beforeSkip = performance.now()
  await click(skipBox.x, skipBox.y)
  await sleep(200)
  const phaseSkip = await evalJson('document.documentElement.dataset.phase')
  if (phaseSkip !== 'pond') fail(`skip left phase ${phaseSkip}`)
  report.skipMs = Math.round(performance.now() - beforeSkip)

  await go(dark, desktop)
  await sleep(120)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await sleep(200)
  const phaseEsc = await evalJson('document.documentElement.dataset.phase')
  if (phaseEsc !== 'pond') fail(`escape left phase ${phaseEsc}`)

  await go(dark, desktop)
  await sleep(120)
  await click(720, 450)
  await sleep(250)
  const phaseClick = await evalJson('document.documentElement.dataset.phase')
  const feedsAfterEnter = await evalJson('document.querySelector("[data-feeds]").value')
  if (phaseClick !== 'pond') fail(`canvas click left phase ${phaseClick}`)
  if (feedsAfterEnter !== '0') fail(`entering the pond counted a feed (${feedsAfterEnter})`)

  await click(720, 450)
  await sleep(200)
  const fed = await evalJson('document.querySelector("[data-feeds]").value')
  if (fed !== '1') fail(`calm click feeds ${fed}`)
  await shot('pond-dark')

  await mouse('mousePressed', 200, 500)
  for (let i = 1; i <= 6; i++) {
    await mouse('mouseMoved', 200 + i * 50, 500)
    await sleep(12)
  }
  await mouse('mouseReleased', 500, 500)
  await sleep(200)
  const afterScare = await evalJson('document.querySelector("[data-feeds]").value')
  if (afterScare !== '1') fail(`fast mouse changed feeds to ${afterScare}`)

  const touch = async (type, x, y) =>
    send('Input.dispatchTouchEvent', { type, touchPoints: [{ x, y, id: 1 }] })
  await touch('touchStart', 300, 600)
  await sleep(80)
  await touch('touchMove', 380, 600)
  await sleep(20)
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await sleep(200)
  const afterTouch = await evalJson('document.querySelector("[data-feeds]").value')
  if (afterTouch !== '2') fail(`slow touch feeds ${afterTouch}`)

  await touch('touchStart', 300, 640)
  for (let i = 1; i <= 4; i++) {
    await touch('touchMove', 300 + i * 80, 640)
    await sleep(10)
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await sleep(200)
  const afterTouchScare = await evalJson('document.querySelector("[data-feeds]").value')
  if (afterTouchScare !== '2') fail(`fast touch changed feeds to ${afterTouchScare}`)

  const theme = await evalJson(`(() => {
    const b = document.querySelector('[data-theme-toggle]')
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: b.textContent }
  })()`)
  if (theme.label !== '光') fail(`dark theme label ${theme.label}`)
  await click(theme.x, theme.y)
  await sleep(150)
  const light = await evalJson('document.documentElement.dataset.theme')
  const lightLabel = await evalJson('document.querySelector("[data-theme-toggle]").textContent')
  if (light !== 'light' || lightLabel !== '暗') fail(`theme toggle ${light} ${lightLabel}`)
  await shot('pond-light')

  const stored = await evalJson('localStorage.getItem("feeds")')
  if (stored !== '2') fail(`stored feeds ${stored}`)
  await send('Page.reload', { ignoreCache: true })
  await sleep(400)
  const themeAfterReload = await evalJson('document.documentElement.dataset.theme ?? ""')
  const feedsAfterReload = await evalJson('localStorage.getItem("feeds")')
  if (themeAfterReload !== '') fail(`theme persisted as ${themeAfterReload}`)
  if (feedsAfterReload !== '2') fail(`feeds did not persist (${feedsAfterReload})`)

  const credit = await evalJson(`(() => {
    const a = document.querySelector('footer a')
    return { href: a.href, text: a.textContent, note: document.querySelector('footer p').textContent }
  })()`)
  if (credit.href !== 'https://daoho.dev/' || credit.text !== '灵感来自 daoho.dev') fail(`credit ${JSON.stringify(credit)}`)
  if (!credit.note.includes('并非官方奥特曼商品')) fail(`disclaimer ${credit.note}`)

  await go(still, desktop)
  await sleep(200)
  const stillPhase = await evalJson('document.documentElement.dataset.phase')
  const stillInk = await ink()
  await shot('portrait-reduced-200ms')
  if (stillPhase !== 'portrait') fail(`reduced motion entered early (${stillPhase})`)
  if (stillInk.all < inkEarly.all * 3) fail(`reduced motion is not a full frame (${stillInk.all} vs moving ${inkEarly.all})`)
  await sleep(2200)
  const stillLater = await evalJson('document.documentElement.dataset.phase')
  if (stillLater !== 'pond') fail(`reduced motion never entered (${stillLater})`)
  const framesAtPond = await evalJson('window.__frames.length')
  await sleep(800)
  const framesAfter = await evalJson('window.__frames.length')
  report.stillRafDelta = framesAfter - framesAtPond
  if (report.stillRafDelta > 2) fail(`still pond kept scheduling frames (${report.stillRafDelta})`)
  await shot('pond-reduced')

  await go(dark, desktop)
  await sleep(100)
  await click(skipBox.x, skipBox.y)
  await sleep(300)
  const samples = []
  for (let n = 0; n < 5; n++) {
    await evalJson('window.__frames = []')
    await sleep(2000)
    const frames = await evalJson('window.__frames')
    if (!Array.isArray(frames) || frames.length < 20) fail(`fps sample ${n} saw ${frames?.length ?? 0} frames`)
    const gaps = []
    for (let i = 1; i < frames.length; i++) gaps.push(frames[i].t - frames[i - 1].t)
    gaps.sort((a, b) => a - b)
    const durs = frames.map((f) => f.dur).sort((a, b) => a - b)
    const mid = (xs) => xs[Math.floor(xs.length / 2)]
    samples.push({
      frames: frames.length,
      gapMedian: mid(gaps),
      gapMin: gaps[0],
      gapMax: gaps[gaps.length - 1],
      durMedian: mid(durs),
      durMax: durs[durs.length - 1],
    })
  }
  const gaps = samples.map((s) => s.gapMedian).sort((a, b) => a - b)
  report.fps = {
    samples,
    gapMedianOfMedians: gaps[2],
    gapRange: [gaps[0], gaps[4]],
    limiter: gaps[2] > 12 && gaps[2] < 22 ? 'vsync' : 'scheduler',
  }
  const moved = await evalJson(`(() => {
    const c = document.querySelector('canvas')
    const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const b = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
        let diff = 0
        for (let i = 0; i < a.length; i += 64) if (a[i] !== b[i]) diff += 1
        resolve(diff)
      }))
    })
  })()`)
  report.frameDiff = moved
  if (moved < 10) fail(`pond frames did not change the canvas (${moved})`)
  await shot('pond-moving')

  await go(dark, phone)
  await sleep(200)
  const phoneLayout = await evalJson(`(() => {
    const skip = document.querySelector('[data-skip]').getBoundingClientRect()
    const footer = document.querySelector('footer').getBoundingClientRect()
    return {
      phase: document.documentElement.dataset.phase,
      scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      skipInside: skip.right <= 390 && skip.bottom <= 844 && skip.width > 0,
      footerInside: footer.left >= 0 && footer.top >= 0 && footer.bottom <= 844,
    }
  })()`)
  if (phoneLayout.phase !== 'portrait') fail(`phone phase ${phoneLayout.phase}`)
  if (phoneLayout.scroll > 1) fail(`phone horizontal scroll ${phoneLayout.scroll}`)
  if (!phoneLayout.skipInside || !phoneLayout.footerInside) fail(`phone layout ${JSON.stringify(phoneLayout)}`)
  await shot('phone-portrait')
  await click(300, 800)
  await sleep(200)
  const phonePhase = await evalJson('document.documentElement.dataset.phase')
  if (phonePhase !== 'pond') fail(`phone skip-or-click left ${phonePhase}`)

  await evalJson('window.__frames = []')
  const { targetId: other } = await browser.send('Target.createTarget', { url: 'about:blank' })
  await browser.send('Target.activateTarget', { targetId: other })
  await sleep(800)
  const hidden = await evalJson('({ hidden: document.hidden, frames: window.__frames.length })')
  await browser.send('Target.activateTarget', { targetId })
  await sleep(400)
  const shownFrames = await evalJson('window.__frames.length')
  if (!hidden.hidden) fail('tab did not hide')
  if (hidden.frames > 2) fail(`hidden tab kept painting ${hidden.frames}`)
  if (shownFrames <= hidden.frames) fail('visible tab did not resume')
  report.hiddenFrames = hidden.frames
  report.shownFrames = shownFrames

  if (errors.length) fail(`page errors ${errors.join(' | ')}`)
  report.errors = errors.length
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  chrome.kill()
  process.exit(0)
} catch (err) {
  console.error(err)
  writeFileSync(`${OUT}/report.json`, JSON.stringify({ report, errors, crash: String(err) }, null, 2))
  chrome.kill()
  process.exit(1)
}
