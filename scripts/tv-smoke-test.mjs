/**
 * End-to-end TV smoke test.
 *
 * Boots the production build (vite preview), opens it in headless Chrome and
 * drives it with the DevTools Protocol exactly like a Fire TV remote would:
 * D-pad arrows, Select, Back and real text input. It verifies that
 *
 *   - the ingredient discovery page renders and starts on the text field,
 *   - typing (comma separated) adds deduped chips, D-pad removes them,
 *     Clear all empties the kitchen and quick-add works without typing,
 *   - "Find recipes" ranks the catalogue and every result photo loads at 16:9,
 *   - "Have a particular recipe in mind?" finds a dish, shows have/missing and
 *     offers alternatives when the dish does not exist,
 *   - the kitchen list survives the dish search,
 *   - details -> kitchen check -> cooking mode works, the timer counts down,
 *   - finishing the flow records the recipe in "Your Cooking History",
 *   - history survives a reload and can be opened again with the D-pad,
 *   - Back unwinds the stack and restores focus,
 *   - nothing is written to the console.
 *
 * Usage:  npm run test:tv
 *         TV_TEST_SHOTS=1 npm run test:tv   # also writes 1920x1080 screenshots
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
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
  // A throwaway profile per run: history and any other storage always start
  // empty, so the test is not affected by an earlier run.
  const profile = path.join(os.tmpdir(), `cookcue-tv-test-profile-${process.pid}`)
  rmSync(profile, { recursive: true, force: true })
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

const SHOTS_DIR = process.env.TV_TEST_SHOTS
  ? path.join(os.tmpdir(), 'cookcue-shots')
  : null

/** Save a 1920x1080 screenshot when TV_TEST_SHOTS is set (visual review). */
async function capture(ws, name) {
  if (!SHOTS_DIR) return
  mkdirSync(SHOTS_DIR, { recursive: true })
  const { data } = await send(ws, 'Page.captureScreenshot', { format: 'png' })
  const file = path.join(SHOTS_DIR, `${name}.png`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  console.log(`  shot: ${file}`)
}

const KEYS = {  left: ['ArrowLeft', 'ArrowLeft', 37],
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

/** Type into whatever element the app has focused (real key events). */
async function typeText(ws, text) {
  await send(ws, 'Input.insertText', { text })
  await sleep(120)
}

async function activeId(ws) {
  return evaluate(
    ws,
    `(() => {
      // The engine moves DOM focus to the active element, so prefer that.
      // The attribute is the fallback while the focus effect is still running.
      const focused = document.activeElement
      const direct = focused && focused.getAttribute ? focused.getAttribute('data-focus-id') : null
      if (direct) return direct
      const el = document.querySelector('[data-focus-active="true"]')
      return el ? el.getAttribute('data-focus-id') : null
    })()`,
  )
}

const DEBUG = Boolean(process.env.TV_TEST_DEBUG)

/** Press a direction until the focused element matches, like a user would. */
async function pressUntil(ws, key, matcher, max = 6) {
  const path = []
  for (let i = 0; i < max; i += 1) {
    const id = await activeId(ws)
    path.push(id)
    if (id && matcher(id)) {
      if (DEBUG) console.log(`  ${key} path: ${path.join(' > ')}`)
      return id
    }
    await press(ws, key)
  }
  const id = await activeId(ws)
  path.push(id)
  if (DEBUG) console.log(`  ${key} path (miss): ${path.join(' > ')}`)
  return id && matcher(id) ? id : null
}

async function count(ws, selector) {
  return evaluate(ws, `document.querySelectorAll(${JSON.stringify(selector)}).length`)
}

async function text(ws, selector) {
  return evaluate(ws, `document.querySelector(${JSON.stringify(selector)})?.innerText ?? null`)
}

async function waitFor(ws, expression, timeout = 6000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const value = await evaluate(ws, expression)
    if (value) return value
    await sleep(150)
  }
  return null
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

const chipLabels = `Array.from(document.querySelectorAll('.chip:not(.chip--clear) .chip__label')).map(n => n.innerText)`

// --------------------------------------------------------------------------
// the test
// --------------------------------------------------------------------------

async function runChecks(ws) {
  await send(ws, 'Runtime.enable')
  await send(ws, 'Log.enable')
  await send(ws, 'Page.enable')
  await send(ws, 'Page.navigate', { url: APP_URL })

  const booted = await waitFor(ws, `document.querySelector('.hero__title')?.innerText`, 15000)
  check('home screen renders the ingredient discovery page', booted === "What's in your kitchen today?", booted)

  // ---------------------------------------------------------------- home --
  await waitFor(ws, `document.querySelectorAll('[data-focus-active="true"]').length === 1`, 4000)
  let screen = await evaluate(ws, screenInfo)
  check('home has focusable items', screen.focusables > 15, `${screen.focusables} focusables`)
  check('exactly one focused element', screen.focusActive === 1, `${screen.focusActive}`)

  let id = await activeId(ws)
  check('focus starts on the ingredient field', id === 'home-ingredient-input', id)

  const historyEmpty = await text(ws, '.history__empty')
  check(
    'history starts with its empty state',
    historyEmpty === 'Your cooked recipes will appear here.',
    historyEmpty,
  )

  check('the kitchen starts empty', (await count(ws, '.chip')) === 0)
  check('the starter hint is visible', (await text(ws, '.kitchen__empty'))?.includes('No ingredients yet'))
  await capture(ws, '01-home-empty')

  // ---- typing, chips, dedupe -------------------------------------------
  await typeText(ws, 'Eggs, tomatoes, eggs, flour, sugar')
  await press(ws, 'enter')
  await sleep(250)

  let chips = await evaluate(ws, chipLabels)
  check('comma separated input becomes chips', chips.length === 4, chips.join(', '))
  check(
    'duplicate ingredients are dropped',
    chips.filter((chip) => /^eggs?$/i.test(chip)).length === 1,
    chips.join(', '),
  )

  await press(ws, 'down')
  id = await activeId(ws)
  check('ArrowDown leaves the text field for the primary action', id === 'home-find-recipes', id)

  id = await pressUntil(ws, 'down', (value) => value.startsWith('home-chip-'), 3)
  check('chips are reachable with the D-pad', Boolean(id?.startsWith('home-chip-')), id)

  id = await pressUntil(ws, 'right', (value) => value === 'home-chip-sugar', 6)
  check('chips are walked left to right', id === 'home-chip-sugar', id)

  await press(ws, 'enter')
  await sleep(250)
  chips = await evaluate(ws, chipLabels)
  check(
    'Select removes a chip',
    chips.length === 3 && !chips.some((chip) => chip.toLowerCase() === 'sugar'),
    chips.join(', '),
  )

  // Focus falls back to the field after a chip disappears.
  id = await activeId(ws)
  check('focus is not lost after removing a chip', Boolean(id), id)

  // ---- Clear all -------------------------------------------------------
  await typeText(ws, 'sugar')
  await press(ws, 'enter')
  await sleep(200)
  chips = await evaluate(ws, chipLabels)
  check('adding after removing restores the chip', chips.length === 4, chips.join(', '))

  id = await pressUntil(ws, 'down', (value) => value === 'home-find-recipes', 3)
  check('Find recipes is one press below the field', id === 'home-find-recipes', id)

  id = await pressUntil(ws, 'down', (value) => value.startsWith('home-chip-'), 3)
  id = await pressUntil(ws, 'right', (value) => value === 'home-ingredient-clear', 8)
  check('Clear all is reachable with the D-pad', id === 'home-ingredient-clear', id)

  await press(ws, 'enter')
  await sleep(250)
  check('Clear all empties the kitchen', (await count(ws, '.chip')) === 0)

  // ---- quick add -------------------------------------------------------
  id = await pressUntil(ws, 'down', (value) => value.startsWith('home-quick-'), 8)
  check('quick add is reachable with the D-pad', Boolean(id?.startsWith('home-quick-')), id)

  await press(ws, 'enter')
  await sleep(200)
  chips = await evaluate(ws, chipLabels)
  check('quick add works without typing', chips.length === 1, chips.join(', '))

  // Back to a useful pantry for the matching checks.
  id = await pressUntil(ws, 'up', (value) => value === 'home-ingredient-input', 8)
  await typeText(ws, 'tomatoes, flour, sugar')
  await press(ws, 'enter')
  await sleep(250)
  chips = await evaluate(ws, chipLabels)
  check('multiple ingredients can be added again', chips.length === 4, chips.join(', '))
  await capture(ws, '02-kitchen')

  // ---- recommendations -------------------------------------------------
  id = await pressUntil(ws, 'down', (value) => value === 'home-find-recipes', 12)
  check('Find recipes is reachable with the D-pad', id === 'home-find-recipes', id)

  await press(ws, 'enter')
  const cardsLoaded = await waitFor(ws, `document.querySelectorAll('.tile--card').length > 0`)
  check('Find recipes lists recipes you can make', Boolean(cardsLoaded))

  const cards = await evaluate(
    ws,
    `Array.from(document.querySelectorAll('.tile--card')).map(card => ({
       title: card.querySelector('.tile__title')?.innerText,
       badge: card.querySelector('.match-badge')?.innerText,
       kitchen: card.querySelector('.tile__kitchen-count')?.innerText,
       missing: card.querySelector('.tile__missing')?.innerText || null,
       cta: card.querySelector('.tile__cta')?.innerText,
     }))`,
  )
  check('results are capped at 10', cards.length > 0 && cards.length <= 10, `${cards.length} cards`)
  check(
    'every result shows have/missing counts and a view action',
    cards.every((card) => /\d+ of \d+/.test(card.kitchen || '') && /View recipe/i.test(card.cta || '')),
    JSON.stringify(cards[0] || null),
  )
  check(
    'results explain the missing ingredients',
    cards.some((card) => Boolean(card.missing)),
    cards[0]?.missing || '',
  )

  // Images: scroll each card in (they are lazy), then check they decoded at 16:9.
  await evaluate(
    ws,
    `(async () => {
       for (const img of document.querySelectorAll('.results .tile__img')) {
         img.scrollIntoView({ block: 'nearest', inline: 'center' })
         await new Promise((resolve) => setTimeout(resolve, 120))
       }
       return true
     })()`,
  )
  await sleep(1200)
  const images = await evaluate(
    ws,
    `Array.from(document.querySelectorAll('.results .tile__img')).map(img => {
       const box = img.getBoundingClientRect()
       return {
         ok: img.complete && img.naturalWidth > 0,
         ratio: img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0,
         boxRatio: box.height ? box.width / box.height : 0,
         width: Math.round(box.width),
         height: Math.round(box.height),
         alt: img.getAttribute('alt'),
       }
     })`,
  )
  check('result cards show real photos', images.length > 0, `${images.length} images`)
  check(
    'every result photo loaded',
    images.every((image) => image.ok),
    images.map((image) => image.ok).join(','),
  )
  check(
    'photos are 16:9',
    images.every((image) => Math.abs(image.ratio - 16 / 9) < 0.02),
    images.map((image) => image.ratio.toFixed(2)).join(','),
  )
  check(
    'photo slots are 16:9 (rendered)',
    images.every((image) => Math.abs(image.boxRatio - 16 / 9) < 0.02),
    images.map((image) => `${image.width}x${image.height}`).join(','),
  )
  check(
    'photos are card sized, not thumbnails',
    images.every((image) => image.width >= 280),
    images.map((image) => image.width).join(','),
  )
  check(
    'photos have alt text',
    images.every((image) => Boolean(image.alt) && image.alt.length > 3),
    images[0]?.alt,
  )
  await evaluate(
    ws,
    `document.querySelector('.results .tile--card')?.scrollIntoView({ block: 'center' })`,
  )
  await sleep(400)
  await capture(ws, '03-results')

  // ---- a dish that does not exist --------------------------------------
  id = await pressUntil(ws, 'down', (value) => value === 'home-dish-input', 25)
  check('the dish search field is reachable', id === 'home-dish-input', id)

  await typeText(ws, 'Zanzibar Moon Pie')
  await press(ws, 'enter')
  const missingDish = await waitFor(ws, `document.querySelectorAll('.dish__suggestion').length > 0`)
  check('an unknown dish offers alternatives instead of inventing one', Boolean(missingDish))
  const missingCopy = await text(ws, '.dish__panel .dish__note')
  check(
    'the unknown dish is explained',
    Boolean(missingCopy && /couldn.t find/i.test(missingCopy)),
    missingCopy,
  )

  id = await pressUntil(ws, 'down', (value) => value === 'home-dish-clear-none', 8)
  check('the unknown dish can be dismissed', id === 'home-dish-clear-none', id)
  await press(ws, 'enter')
  await sleep(250)

  // ---- a dish that exists ----------------------------------------------
  id = await pressUntil(ws, 'down', (value) => value === 'home-dish-input', 25)
  check('the dish field keeps focus after clearing', id === 'home-dish-input', id)

  const DISH = 'Apple & Blackberry Crumble'
  await typeText(ws, DISH)
  await press(ws, 'enter')
  const dishName = await waitFor(ws, `document.querySelector('.dish__name')?.innerText`)
  check('the requested dish is found', dishName === DISH, dishName)

  const dishReport = await evaluate(
    ws,
    `({
       have: document.querySelectorAll('.dish__item--have').length,
       missing: document.querySelectorAll('.dish__item--missing').length,
       badge: document.querySelector('.dish__panel .badge')?.innerText,
     })`,
  )
  check(
    'the dish shows what the user has and what is missing',
    dishReport.have > 0 && dishReport.missing > 0,
    JSON.stringify(dishReport),
  )
  check(
    'the dish compares against the kitchen',
    /in your kitchen/.test(dishReport.badge || ''),
    dishReport.badge,
  )

  chips = await evaluate(ws, chipLabels)
  check('the ingredient list survives the dish search', chips.length === 4, chips.join(', '))
  await evaluate(ws, `document.querySelector('.dish__panel')?.scrollIntoView({ block: 'start' })`)
  await sleep(300)
  await capture(ws, '04-dish-found')

  // ---- details ---------------------------------------------------------
  id = await pressUntil(ws, 'down', (value) => value === 'home-dish-open', 8)
  check('Open recipe is reachable', id === 'home-dish-open', id)

  await press(ws, 'enter')
  await sleep(500)
  screen = await evaluate(ws, screenInfo)
  check('Open recipe shows the dish details', screen.title === DISH, screen.title)

  id = await activeId(ws)
  check('details focuses the primary action', Boolean(id?.startsWith('details-start-')), id)
  const recipeId = id ? id.slice('details-start-'.length) : ''

  const detailsText = await evaluate(ws, `document.querySelector('.details')?.innerText || ''`)
  check('details never show undefined', !detailsText.includes('undefined'))

  await press(ws, 'right')
  id = await activeId(ws)
  check('ArrowRight moves between detail actions', id === `details-check-${recipeId}`, id)

  // ---- kitchen check ---------------------------------------------------
  await press(ws, 'enter')
  await sleep(450)
  screen = await evaluate(ws, screenInfo)
  check('Select opens the kitchen check', screen.title === 'What do you have?', screen.title)

  const missingBefore = await count(ws, '.ing-row--missing')
  id = await activeId(ws)
  check('the kitchen check focuses an ingredient', Boolean(id?.startsWith(`ing-${recipeId}-`)), id)

  const rowState = `(() => {
    const row = document.querySelector('.ing-row[data-focus-active="true"]')
    return row ? { missing: row.classList.contains('ing-row--missing'),
                   badge: row.querySelector('.badge')?.innerText || null } : null
  })()`
  const beforeRow = await evaluate(ws, rowState)

  await press(ws, 'enter')
  await sleep(350)
  const missingAfter = await count(ws, '.ing-row--missing')

  check(
    'Select toggles an ingredient',
    beforeRow && missingAfter === missingBefore + (beforeRow.missing ? -1 : 1),
    `${missingBefore} -> ${missingAfter}`,
  )

  const afterRow = await evaluate(ws, rowState)
  check(
    'the toggled row shows the new state',
    Boolean(afterRow) && afterRow.badge !== beforeRow.badge,
    `${beforeRow?.badge} -> ${afterRow?.badge}`,
  )

  // ---- cooking mode ----------------------------------------------------
  id = await pressUntil(ws, 'right', (value) => value === `ing-start-${recipeId}`)
  check('the start button is reachable with the D-pad', id === `ing-start-${recipeId}`, id)

  await press(ws, 'enter')
  await sleep(600)
  const counter = await text(ws, '.cooking__counter')
  check('Start cooking opens cooking mode', /step 1 of \d+/i.test(counter || ''), counter)

  const cookingTitle = await text(ws, '.pill--ember')
  check('cooking mode keeps the recipe name', cookingTitle === DISH, cookingTitle)

  const timerA = await text(ws, '.timer__digits')
  await sleep(2200)
  const timerB = await text(ws, '.timer__digits')
  check(
    'the step timer counts down',
    /^\d{2}:\d{2}$/.test(timerA || '') && timerA !== timerB,
    `${timerA} -> ${timerB}`,
  )

  const timerLabel = await text(ws, '.timer__label')
  check('the timer is running', /running/i.test(timerLabel || ''), timerLabel)
  await capture(ws, '05-cooking')

  const totalSteps = Number((counter || '').match(/of (\d+)/i)?.[1] || 0)
  check('the recipe has real steps', totalSteps >= 2, `${totalSteps} steps`)

  id = await pressUntil(ws, 'right', (value) => value === `cook-next-${recipeId}`)
  check('the next button is reachable with the D-pad', id === `cook-next-${recipeId}`, id)

  // Walk the remaining steps; the button keeps focus between steps.
  for (let step = 1; step < totalSteps; step += 1) {
    await press(ws, 'enter')
    await sleep(450)
  }
  const lastCounter = await text(ws, '.cooking__counter')
  check('the last step is reached', new RegExp(`step ${totalSteps} of ${totalSteps}`, 'i').test(lastCounter || ''), lastCounter)

  await press(ws, 'enter')
  await sleep(600)
  screen = await evaluate(ws, screenInfo)
  check('Finish opens the completion screen', screen.title === 'Dinner is ready', screen.title)

  const doneSubtitle = await text(ws, '.done__subtitle')
  check('the completion screen names the dish', (doneSubtitle || '').includes(DISH), doneSubtitle)

  const stored = await evaluate(
    ws,
    `(() => {
       try { return JSON.parse(localStorage.getItem('cookcue.history.v1') || '[]') } catch { return [] }
     })()`,
  )
  check(
    'finishing the flow records the recipe in history',
    Array.isArray(stored) && stored.length === 1 && stored[0].id === recipeId,
    JSON.stringify(stored),
  )

  // ---- history on the home screen -------------------------------------
  await press(ws, 'enter')
  await sleep(600)
  screen = await evaluate(ws, screenInfo)
  check('Back to home returns to the discovery page', screen.title === "What's in your kitchen today?", screen.title)

  const historyCard = await text(ws, '.history-card__title')
  check('the cooked recipe appears in history', historyCard === DISH, historyCard)

  const historyId = await evaluate(
    ws,
    `document.querySelector('.history-card')?.getAttribute('data-focus-id') || null`,
  )
  check('the history entry is focusable', Boolean(historyId?.startsWith('home-history-')), historyId)

  // ---- persistence ----------------------------------------------------
  await send(ws, 'Page.reload')
  const reloaded = await waitFor(ws, `document.querySelector('.hero__title')?.innerText`, 15000)
  check('the app reloads cleanly', reloaded === "What's in your kitchen today?", reloaded)

  const historyAfterReload = await text(ws, '.history-card__title')
  check('history survives a reload', historyAfterReload === DISH, historyAfterReload)
  check('the kitchen does not persist between launches', (await count(ws, '.chip')) === 0)
  await evaluate(ws, `document.querySelector('.history')?.scrollIntoView({ block: 'center' })`)
  await sleep(300)
  await capture(ws, '06-history')

  // ---- open again from history ----------------------------------------
  id = await pressUntil(ws, 'down', (value) => value.startsWith('home-history-'), 40)
  check('the history entry is reachable with the D-pad', Boolean(id?.startsWith('home-history-')), id)

  await press(ws, 'enter')
  await sleep(500)
  screen = await evaluate(ws, screenInfo)
  check('Select on a history entry opens the recipe again', screen.title === DISH, screen.title)

  await press(ws, 'back')
  await sleep(500)
  screen = await evaluate(ws, screenInfo)
  check('Back returns to history', screen.title === "What's in your kitchen today?", screen.title)

  id = await activeId(ws)
  check('focus is restored on the history entry', id === historyId, id)

  // ---- a kitchen with no matches ---------------------------------------
  id = await pressUntil(ws, 'up', (value) => value === 'home-ingredient-input', 20)
  check('the ingredient field is reachable from the bottom of the page', id === 'home-ingredient-input', id)

  await typeText(ws, 'dragonfruit')
  await press(ws, 'enter')
  await sleep(250)

  id = await pressUntil(ws, 'down', (value) => value === 'home-find-recipes', 3)
  check('Find recipes is reachable again with a new kitchen', id === 'home-find-recipes', id)

  await press(ws, 'enter')
  const emptyTitle = await waitFor(
    ws,
    `document.querySelector('.results__empty-title')?.innerText`,
    8000,
  )
  check(
    'a kitchen with no matches gets the helpful empty state',
    /No exact matches yet/.test(emptyTitle || ''),
    emptyTitle,
  )
  const alternativeCount = await count(ws, '.results__empty .tile')
  check(
    'the empty state still offers alternative recipes',
    alternativeCount > 0,
    `${alternativeCount} alternatives`,
  )
  await evaluate(ws, `document.querySelector('.results')?.scrollIntoView({ block: 'center' })`)
  await sleep(300)
  await capture(ws, '07-empty-results')

  const consumed = await evaluate(ws, `window.cookcue ? window.cookcue.handleBack() : 'no-bridge'`)
  check('Back at the root is not consumed by the app', consumed === false, String(consumed))

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
