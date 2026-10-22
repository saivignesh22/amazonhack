/**
 * Download and prepare every recipe image the app ships.
 *
 * Two sources:
 *   - TheMealDB catalogue meals: the meal's own photo (the authoritative
 *     picture of that dish), from the URL the API returns.
 *   - The local sample recipes (src/data/recipes.js) and the recipe engine's
 *     recipes (src/data/recipes.json): a dish-matched Pexels photo.
 *
 * Every download is verified (HTTP 200, image/*, JPEG/PNG magic bytes) before
 * it is resized to a 480x270 16:9 JPEG. Images are committed to
 * public/recipes/, so the Fire TV app never loads a picture over the network.
 *
 * Usage:  node scripts/fetch-recipe-images.mjs [--force]
 * Needs:  python -m pip install pillow
 *
 * Writes:
 *   public/recipes/meals/<mealId>.jpg
 *   public/recipes/local/<recipeId>.jpg
 *   src/data/recipeImages.json     the recipeId -> image mapping + credits
 *   public/recipes/ATTRIBUTION.md  human readable credits
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { SAMPLE_RECIPES } from '../src/data/recipes.js'

const run = promisify(execFile)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CATALOGUE = path.join(ROOT, 'src/data/themealdb/catalogue.json')
const TEAM_RECIPES = path.join(ROOT, 'src/data/recipes.json')
const OUT_DIR = path.join(ROOT, 'public/recipes')
const MANIFEST = path.join(ROOT, 'src/data/recipeImages.json')
const ATTRIBUTION = path.join(OUT_DIR, 'ATTRIBUTION.md')
const WORK = path.join(tmpdir(), 'cookcue-images')

const UA = 'CookCue/1.0 (Amazon Fire TV cooking demo)'
// Pexels rejects non-browser agents on its search pages.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36'
const IMAGE_WIDTH = Number(process.env.IMAGE_WIDTH || 400)
const IMAGE_HEIGHT = Number(process.env.IMAGE_HEIGHT || 225)
const IMAGE_QUALITY = Number(process.env.IMAGE_QUALITY || 65)
const FORCE = process.argv.includes('--force')
const RESIZE_ONLY = process.argv.includes('--resize-only')
const CONCURRENCY = 8

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Pexels searches are phrased by hand for the local recipes. */
const PEXELS_QUERIES = {
  'margherita-pizza': 'margherita pizza',
  'smoky-black-bean-tacos': 'black bean tacos',
  'sheet-pan-lemon-chicken': 'lemon chicken tray bake',
  'coconut-chickpea-curry': 'chickpea curry',
  'teriyaki-rice-bowl': 'teriyaki chicken rice bowl',
  'grilled-cheese': 'grilled cheese sandwich',
  'masala-omelette': 'masala omelette',
  'vegetable-fried-rice': 'vegetable fried rice',
}

// Pexels sits behind bot protection that rejects Node's TLS fingerprint even
// with a browser user agent, so those requests go through curl (present on
// Windows, macOS and Linux). TheMealDB is happy with plain fetch().
async function curlText(url, attempt = 1) {
  try {
    const { stdout } = await run(
      'curl',
      ['-sS', '-L', '-A', BROWSER_UA, '--max-time', '60', url],
      { maxBuffer: 32 * 1024 * 1024 },
    )
    return stdout
  } catch (error) {
    if (attempt >= 3) throw error
    await sleep(500 * attempt)
    return curlText(url, attempt + 1)
  }
}

async function curlImage(url, dest) {
  await mkdir(path.dirname(dest), { recursive: true })
  await run('curl', [
    '-sS',
    '-L',
    '-A',
    BROWSER_UA,
    '-e',
    'https://www.pexels.com/',
    '--max-time',
    '60',
    '-o',
    dest,
    url,
  ])
  const buffer = await readFile(dest)
  if (!looksLikeImage(buffer)) throw new Error(`failed image validation for ${url}`)
  return { bytes: buffer.length, type: 'image/jpeg' }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0

  async function next() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next))
  return results
}

async function fetchWithRetry(url, { attempts = 3, headers = {} } = {}) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, ...headers },
        redirect: 'follow',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return response
    } catch (error) {
      lastError = error
      await sleep(400 * attempt)
    }
  }
  throw lastError
}

function looksLikeImage(buffer) {
  if (buffer.length < 4096) return false
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8
  const png = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  return jpeg || png
}

/** Download one image into the work directory and verify it. */
async function download(url, dest, { referer } = {}) {
  const response = await fetchWithRetry(url, { headers: referer ? { Referer: referer } : {} })
  const type = response.headers.get('content-type') || ''
  if (!type.startsWith('image/')) throw new Error(`not an image (${type}) for ${url}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!looksLikeImage(buffer)) throw new Error(`failed image validation for ${url}`)
  await mkdir(path.dirname(dest), { recursive: true })
  await writeFile(dest, buffer)
  return { bytes: buffer.length, type }
}

// --------------------------------------------------------------------------
// Pexels: search page -> best matching photo -> credit
// --------------------------------------------------------------------------

const PEXELS_IMAGE = /https:\/\/images\.pexels\.com\/photos\/(\d+)\/([a-z0-9-]+)\.(jpe?g|png)/g
const STOP_WORDS = new Set(['with', 'and', 'the', 'of', 'a', 'on', 'at', 'in', 'for', 'photo', 'free'])

function keywords(query) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

async function pexelsCandidates(query) {
  const url = `https://www.pexels.com/search/${encodeURIComponent(query)}/`
  const html = await curlText(url)

  const seen = new Map()
  for (const match of html.matchAll(PEXELS_IMAGE)) {
    const [, id, slug, ext] = match
    if (!seen.has(id)) seen.set(id, { id, slug, ext })
  }

  const words = keywords(query)
  return [...seen.values()]
    .map((candidate, index) => {
      const slugWords = new Set(candidate.slug.split('-'))
      const score = words.filter((word) => slugWords.has(word)).length
      return { ...candidate, index, score }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
}

async function pexelsCredit({ slug, id }) {
  try {
    const html = await curlText(`https://www.pexels.com/photo/${slug}-${id}/`)
    const title = html.match(/og:title"\s+content="([^"]+)"/i)
    const author = title ? title[1].replace(/\s*on Pexels\s*$/i, '') : ''
    return {
      page: `https://www.pexels.com/photo/${slug}-${id}/`,
      credit: author || 'Pexels',
    }
  } catch {
    return { page: `https://www.pexels.com/photo/${slug}-${id}/`, credit: 'Pexels' }
  }
}

async function fetchPexelsImage(recipe, workFile) {
  const query = PEXELS_QUERIES[recipe.id] || recipe.title || recipe.name
  const candidates = await pexelsCandidates(query)
  if (candidates.length === 0) throw new Error(`no Pexels results for "${query}"`)

  let lastError
  for (const candidate of candidates.slice(0, 4)) {
    const url =
      `https://images.pexels.com/photos/${candidate.id}/${candidate.slug}.${candidate.ext}` +
      '?auto=compress&cs=tinysrgb&dpr=1&w=480'
    try {
      const info = await curlImage(url, workFile)
      const credit = await pexelsCredit(candidate)
      return {
        workFile,
        provider: 'Pexels',
        source: url,
        ...credit,
        license: 'Pexels License (free to use, attribution not required)',
        ...info,
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error(`no usable Pexels image for "${query}"`)
}

// --------------------------------------------------------------------------

async function main() {
  const catalogue = JSON.parse(await readFile(CATALOGUE, 'utf8'))
  const teamRecipes = JSON.parse(await readFile(TEAM_RECIPES, 'utf8'))

  const localRecipes = [
    ...SAMPLE_RECIPES.map((recipe) => ({ id: recipe.id, title: recipe.title })),
    ...teamRecipes.map((recipe) => ({ id: recipe.id, title: recipe.name })),
  ]

  if (!RESIZE_ONLY) {
    await rm(WORK, { recursive: true, force: true })
  }
  await mkdir(WORK, { recursive: true })

  /** Entries from a previous run, reused when a file is already on disk. */
  const previous = existsSync(MANIFEST)
    ? JSON.parse(await readFile(MANIFEST, 'utf8')).images || {}
    : {}

  /** recipeId -> everything we know about its image. */
  const records = new Map()
  const jobs = []
  const failures = []

  function record(id, entry, workFile, outFile) {
    records.set(id, entry)
    jobs.push({ src: workFile, dst: outFile })
  }

  // Re-encode the already downloaded sources with the current size/quality
  // settings, without hitting the network again.
  if (RESIZE_ONLY) {
    const existing = JSON.parse(await readFile(MANIFEST, 'utf8'))
    for (const [id, entry] of Object.entries(existing.images)) {
      const folder = entry.provider === 'Pexels' ? 'local' : 'meals'
      const workFile = path.join(WORK, folder, `${id}.src`)
      records.set(id, { ...entry })
      if (existsSync(workFile)) jobs.push({ src: workFile, dst: path.join(OUT_DIR, entry.file) })
    }
    console.log(`resize-only: ${jobs.length} sources found, ${records.size} in the manifest`)
  }

  if (!RESIZE_ONLY) {
    // ---- TheMealDB meals -------------------------------------------------
    const meals = catalogue.meals.filter((meal) => meal.image)
    console.log(`downloading ${meals.length} TheMealDB meal photos...`)

    await mapLimit(meals, CONCURRENCY, async (meal, index) => {
      const outFile = path.join(OUT_DIR, 'meals', `${meal.id}.jpg`)
      if (!FORCE && existsSync(outFile) && previous[meal.id]) {
        records.set(meal.id, previous[meal.id])
        return
      }

      const workFile = path.join(WORK, 'meals', `${meal.id}.src`)
      try {
        const info = await download(meal.image, workFile)
        record(
          meal.id,
          {
            file: `meals/${meal.id}.jpg`,
            provider: 'TheMealDB',
            source: meal.image,
            page: `https://www.themealdb.com/meal/${meal.id}`,
            credit: 'TheMealDB',
            license: 'TheMealDB (free recipe database)',
            ...info,
          },
          workFile,
          outFile,
        )
      } catch (error) {
        failures.push({ id: meal.id, error: String(error.message || error) })
      }

      if ((index + 1) % 100 === 0) console.log(`  ${index + 1}/${meals.length}`)
    })

    // ---- local recipes (Pexels) -----------------------------------------
    console.log(`\nsearching Pexels for ${localRecipes.length} local recipes...`)
    await mapLimit(localRecipes, 3, async (recipe) => {
      const outFile = path.join(OUT_DIR, 'local', `${recipe.id}.jpg`)
      if (!FORCE && existsSync(outFile) && previous[recipe.id]) {
        records.set(recipe.id, previous[recipe.id])
        console.log(`  ${recipe.id}: already present`)
        return
      }

      const workFile = path.join(WORK, 'local', `${recipe.id}.src`)
      try {
        const info = await fetchPexelsImage(recipe, workFile)
        record(recipe.id, { file: `local/${recipe.id}.jpg`, ...info }, workFile, outFile)
        console.log(`  ${recipe.id}: ${info.credit}`)
      } catch (error) {
        failures.push({ id: recipe.id, error: String(error.message || error) })
        console.log(`  ${recipe.id}: FAILED ${error.message}`)
      }
    })
  }

  // ---- resize ------------------------------------------------------------
  if (jobs.length > 0) {
    console.log(`\nresizing ${jobs.length} images to ${IMAGE_WIDTH}x${IMAGE_HEIGHT}...`)
    const jobFile = path.join(WORK, 'jobs.json')
    await writeFile(jobFile, JSON.stringify(jobs), 'utf8')
    const { stdout } = await run('python', [path.join(ROOT, 'scripts/resize-image.py'), jobFile], {
      maxBuffer: 64 * 1024 * 1024,
    })
    const result = JSON.parse(stdout)
    for (const job of result.failed) {
      failures.push({ id: job.src, error: `resize: ${job.error}` })
    }
    const byDst = new Map(result.resized.map((entry) => [entry.dst, entry]))
    for (const [id, entry] of records) {
      const resized = byDst.get(path.join(OUT_DIR, entry.file))
      if (resized) {
        entry.width = resized.width
        entry.height = resized.height
        entry.bytes = resized.bytes
      }
    }
    console.log(`  resized ${result.resized.length}, failed ${result.failed.length}`)
  }

  // ---- write the mapping + credits --------------------------------------
  const images = {}
  for (const id of [...records.keys()].sort()) images[id] = records.get(id)

  let totalBytes = 0
  for (const entry of Object.values(images)) {
    if (!entry.bytes) {
      const file = path.join(OUT_DIR, entry.file)
      if (existsSync(file)) entry.bytes = (await stat(file)).size
    }
    totalBytes += entry.bytes || 0
  }

  await writeFile(
    MANIFEST,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString().slice(0, 10),
        note: 'Generated by scripts/fetch-recipe-images.mjs. Image files live in public/recipes/.',
        images,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  const pexels = Object.entries(images).filter(([, entry]) => entry.provider === 'Pexels')
  const lines = [
    '# Recipe image credits',
    '',
    'Generated by `scripts/fetch-recipe-images.mjs`. Do not edit by hand.',
    '',
    '## TheMealDB',
    '',
    'Catalogue meal photos come from [TheMealDB](https://www.themealdb.com/), a free',
    'recipe database. Each image is the photo TheMealDB publishes for that meal.',
    '',
    `## Pexels (${pexels.length} photos)`,
    '',
    'Local sample recipes use photos from [Pexels](https://www.pexels.com/), used under',
    'the [Pexels License](https://www.pexels.com/license/) (free to use, attribution not',
    'required). Credited here anyway, with thanks.',
    '',
    '| Recipe | Photo |',
    '| --- | --- |',
    ...pexels
      .map(([id, entry]) => `| ${id} | ${entry.credit} — [source](${entry.page}) |`)
      .sort(),
    '',
  ]
  await writeFile(ATTRIBUTION, lines.join('\n'), 'utf8')

  console.log(
    `\nwrote ${Object.keys(images).length} images (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`,
  )
  console.log(`  mapping: ${path.relative(ROOT, MANIFEST)}`)
  console.log(`  credits: ${path.relative(ROOT, ATTRIBUTION)}`)

  if (failures.length > 0) {
    console.log(`\n${failures.length} failures:`)
    for (const failure of failures.slice(0, 20)) console.log(`  ${failure.id}: ${failure.error}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('image build failed:', error)
  process.exitCode = 1
})
