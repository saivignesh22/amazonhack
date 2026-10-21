/**
 * End-to-end TV smoke test.
 *
 * Boots the production build (vite preview), opens it in headless Chrome and
 * drives it with the DevTools Protocol exactly like a Fire TV remote would:
 * D-pad arrows, Select and Back. It verifies that
 *
 *   - all five screens render,
 *   - the focus engine moves focus in every direction,
 *   - Select activates the focused item,
 *   - the timer counts down and pauses when you leave cooking mode,
 *   - Back unwinds the screen stack and restores focus,
 *   - nothing is written to the console.
 *
 * Usage:  npm run test:tv
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_PORT = Number(process.env.TV_TEST_PORT || 4173)
const APP_URL = `http://127.0.0.1:${APP_PORT}/`
const CDP_PORT = Number(process.env.CDP_PORT || 9222)
const HTTP = `http://127.0.0.1:${CDP_PORT}`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --------------------------------------------------------------------------
// browser discovery
// --------------------------------------------------------------------------

function findChrome() {
  const candidates =
    process.platform === 'win32'
      ? [
          process.env.CHROME_PATH,
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        ]
      : process.platform === 'darwin'
        ? [
            process.env.CHROME_PATH,
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
          ]
        : [
            process.env.CHROME_PATH,
            '/usr/bin/google-chrome',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
          ]

  const found = candidates.find((p) => p && existsSync(p))
  if (!found) {
    throw new Error(
      'No Chrome/Chromium found. Install Chrome or set CHROME_PATH to the browser binary.',
    )
  }
  return found
}

// --------------------------------------------------------------------------
// process helpers
// --------------------------------------------------------------------------

const children = []

function killAll() {
  for (const child of children) {
    try {
      child.kill()
    } catch {
      /* already gone */
    }
  }
}

async function waitForHttp(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function startPreviewServer() {
  // Run vite through node directly: it avoids the .cmd shim on Windows and
  // needs no shell.
  const viteBin = path.join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(viteBin)) {
    throw new Error('vite is not installed. Run `npm install` first.')
  }
  const child = spawn(
    process.execPath,
    [viteBin, 'preview', '--port', String(APP_PORT), '--strictPort'],
    { cwd: repoRoot, stdio: 'ignore' },
  )
  children.push(child)
  await waitForHttp(APP_URL)
  console.log(`preview server ready on ${APP_URL}`)
}

async function startBrowser() {
  const chrome = findChrome()
  const profile = path.join(os.tmpdir(), 'cookcue-tv-test-profile')
  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--window-size=1920,1080',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  children.push(child)
  await waitForHttp(`${HTTP}/json/version`)
  console.log(`browser ready on ${HTTP}`)
}

// --------------------------------------------------------------------------
// devtools protocol
// --------------------------------------------------------------------------

async function getPageTarget() {
  const res = await fetch(`${HTTP}/json/list`)
  const targets = await res.json()
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  return page
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.onopen = () => resolve(ws)
    ws.onerror = (e) => reject(new Error(`ws error ${e.message || ''}`))
  })
}

let msgId = 0
const pending = new Map()
const consoleErrors = []

function handleMessage(raw) {
  const msg = JSON.parse(raw)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
    return
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    consoleErrors.push(`EXCEPTION: ${d.exception?.description || d.text}`)
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(
      `console.error: ${msg.params.args.map((a) => a.description || a.value).join(' ')}`,
    )
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    consoleErrors.push(`log: ${msg.params.entry.text}`)
  }
}

function send(ws, method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(ws, expression) {
  const result = await send(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails) {
    throw new Error(`eval failed: ${result.exceptionDetails.exception?.description}`)
  }
  return result.result.value
}

const KEYS = {
  left: ['ArrowLeft', 'ArrowLeft', 37],
  up: ['ArrowUp', 'ArrowUp', 38],
  right: ['ArrowRight', 'ArrowRight', 39],
  down: ['ArrowDown', 'ArrowDown', 40],
  enter: ['Enter', 'Enter', 13],
  back: ['Escape', 'Escape', 27],
}

async function press(ws, name) {
  const [key, code, keyCode] = KEYS[name]
  await send(ws, 'Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  })
  await send(ws, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  })
  await sleep(150)
}

async function activeId(ws) {
  return evaluate(
    ws,
    `(() => {
      const el = document.querySelector('[data-focus-active="true"]')
      return el ? el.getAttribute('data-focus-id') : null
    })()`,
  )
}

/** Press a direction until the focused element matches, like a user would. */
async function pressUntil(ws, key, matcher, max = 6) {
  for (let i = 0; i < max; i += 1) {
    const id = await activeId(ws)
    if (id && matcher(id)) return id
    await press(ws, key)
  }
  const id = await activeId(ws)
  return id && matcher(id) ? id : null
}

const results = []
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const screenInfo = `(() => ({
  title: document.querySelector('.hero__title')?.innerText
     || document.querySelector('.details__title')?.innerText
     || document.querySelector('.ingredients__title')?.innerText
     || document.querySelector('.cooking__title')?.innerText
     || document.querySelector('.done__title')?.innerText
     || null,
  focusables: document.querySelectorAll('[data-focusable]').length,
  focusActive: document.querySelectorAll('[data-focus-active="true"]').length,
}))()`

// --------------------------------------------------------------------------
// the test
// --------------------------------------------------------------------------

async function runChecks(ws) {
  await send(ws, 'Runtime.enable')
  await send(ws, 'Log.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Page.navigate', { url: APP_URL })
  await sleep(2500)

  // ---- home -----------------------------------------------------------
  let screen = await evaluate(ws, screenInfo)
  check('home screen renders', screen.title === 'What are we cooking?', screen.title)
  check('home has focusable items', screen.focusables > 5, `${screen.focusables} focusables`)
  check('exactly one focused element', screen.focusActive === 1, `${screen.focusActive}`)

  const tiles = await evaluate(
    ws,
    `Array.from(document.querySelectorAll('.tile')).map(t => ({
       id: t.getAttribute('data-focus-id'),
       title: t.querySelector('.tile__title').innerText,
     }))`,
  )
  const recipeTitle = tiles[0].title
  // focus ids look like home-tile-<rowId>-<recipeId>
  const recipeId = tiles[0].id.split('-').slice(3).join('-')

  let id = await activeId(ws)
  check('focus starts on the first tile', id === tiles[0].id, `${id} vs ${tiles[0].id}`)

  await press(ws, 'right')
  id = await activeId(ws)
  check('ArrowRight moves focus to the next tile', id === tiles[1].id, `${id} vs ${tiles[1].id}`)

  await press(ws, 'down')
  id = await activeId(ws)
  check(
    'ArrowDown moves focus into the row below',
    id !== tiles[1].id && id?.startsWith('home-tile-'),
    id,
  )

  await press(ws, 'up')
  id = await activeId(ws)
  check('ArrowUp returns to the row above', id?.startsWith('home-tile-'), id)

  await press(ws, 'left')
  id = await activeId(ws)
  check('ArrowLeft moves focus to the previous tile', id === tiles[0].id, id)

  // ---- details --------------------------------------------------------
  await press(ws, 'enter')
  await sleep(450)
  screen = await evaluate(ws, screenInfo)
  check('Select opens the recipe details', screen.title === recipeTitle, `${screen.title} vs ${recipeTitle}`)

  id = await activeId(ws)
  check('details focuses the primary action', id === `details-start-${recipeId}`, id)

  await press(ws, 'right')
  id = await activeId(ws)
  check('ArrowRight moves between detail buttons', id === `details-check-${recipeId}`, id)

  await press(ws, 'enter')
  await sleep(450)
  screen = await evaluate(ws, screenInfo)
  check('Select opens the ingredient check', screen.title === 'What do you have?', screen.title)

  // ---- ingredients ----------------------------------------------------
  const before = await evaluate(ws, `document.querySelectorAll('.ing-row--missing').length`)
  id = await activeId(ws)
  check('ingredient screen focuses an ingredient row', id?.startsWith(`ing-${recipeId}-`), id)

  await press(ws, 'enter')
  await sleep(350)
  const after = await evaluate(ws, `document.querySelectorAll('.ing-row--missing').length`)
  check('Select toggles an ingredient to "I have it"', after === before - 1, `${before} -> ${after}`)

  const badge = await evaluate(
    ws,
    `document.querySelector('.ing-row[data-focus-active="true"] .badge')?.innerText`,
  )
  check('the toggled row shows the new state', badge === 'In your kitchen', badge)

  // ---- cooking mode ---------------------------------------------------
  id = await pressUntil(ws, 'right', (v) => v === `ing-start-${recipeId}`)
  check('the start button is reachable with the D-pad', id === `ing-start-${recipeId}`, id)

  await press(ws, 'enter')
  await sleep(500)
  screen = await evaluate(ws, screenInfo)
  check('Start cooking opens cooking mode', screen.title === 'Boil the pasta', screen.title)

  const timerA = await evaluate(ws, `document.querySelector('.timer__digits')?.innerText`)
  await sleep(2200)
  const timerB = await evaluate(ws, `document.querySelector('.timer__digits')?.innerText`)
  check('timer counts down', /^\d{2}:\d{2}$/.test(timerA || '') && timerA !== timerB, `${timerA} -> ${timerB}`)

  const timerLabel = await evaluate(ws, `document.querySelector('.timer__label')?.innerText`)
  check('timer is running', /running/i.test(timerLabel || ''), timerLabel)

  id = await pressUntil(ws, 'right', (v) => v === `cook-next-${recipeId}`)
  check('the next button is reachable with the D-pad', id === `cook-next-${recipeId}`, id)

  await press(ws, 'enter')
  await sleep(450)
  screen = await evaluate(ws, screenInfo)
  check('Next step advances the session', screen.title === 'Burst the tomatoes', screen.title)

  const stepLabel = await evaluate(ws, `document.querySelector('.cooking__counter')?.innerText`)
  check('step counter updates', /step 2 of 4/i.test(stepLabel || ''), stepLabel)

  const progressWidth = await evaluate(ws, `document.querySelector('.cooking__bar-fill')?.style.width`)
  check('progress bar reflects the step', progressWidth === '50%', progressWidth)

  // ---- Back unwinds the stack -----------------------------------------
  await press(ws, 'back')
  await sleep(500)
  screen = await evaluate(ws, screenInfo)
  check('Back returns to the ingredient screen', screen.title === 'What do you have?', screen.title)

  await press(ws, 'back')
  await sleep(450)
  screen = await evaluate(ws, screenInfo)
  check('Back returns to the details screen', screen.title === recipeTitle, screen.title)

  await press(ws, 'back')
  await sleep(450)
  screen = await evaluate(ws, screenInfo)
  check('Back returns to home', screen.title === 'What are we cooking?', screen.title)

  id = await activeId(ws)
  check('focus is restored on the tile that was opened', id === tiles[0].id, id)

  const consumed = await evaluate(ws, `window.cookcue ? window.cookcue.handleBack() : 'no-bridge'`)
  check('Back at the root is not consumed by the app', consumed === false, String(consumed))

  // ---- re-entering cooking keeps the session and pauses the timer ------
  await press(ws, 'enter')
  await sleep(450)
  await press(ws, 'right')
  await press(ws, 'enter')
  await sleep(450)
  await pressUntil(ws, 'right', (v) => v === `ing-start-${recipeId}`)
  await press(ws, 'enter')
  await sleep(500)

  screen = await evaluate(ws, screenInfo)
  check('cooking mode can be re-entered', screen.title === 'Burst the tomatoes', screen.title)

  const stepAgain = await evaluate(ws, `document.querySelector('.cooking__counter')?.innerText`)
  check('the session keeps the current step', /step 2 of 4/i.test(stepAgain || ''), stepAgain)

  const labelAgain = await evaluate(ws, `document.querySelector('.timer__label')?.innerText`)
  check('the timer comes back paused', /paused/i.test(labelAgain || ''), labelAgain)

  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
}

async function main() {
  await startPreviewServer()
  await startBrowser()

  const target = await getPageTarget()
  const ws = await connect(target.webSocketDebuggerUrl)
  ws.onmessage = (e) => handleMessage(e.data)

  await runChecks(ws)
  ws.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('Failed checks:')
    failed.forEach((f) => console.log(`  - ${f.name} ${f.detail}`))
  }
  return failed.length === 0
}

main()
  .then((ok) => {
    killAll()
    process.exit(ok ? 0 : 1)
  })
  .catch((error) => {
    console.error('TV smoke test failed to run:', error.message)
    killAll()
    process.exit(2)
  })
