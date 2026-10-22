/**
 * Build the offline recipe catalogue from TheMealDB.
 *
 * The app talks to TheMealDB at runtime (see
 * src/services/themealdbRecipeService.js), but a Fire TV may be offline or on
 * a flaky network, so the same catalogue is committed as a snapshot and used
 * as the fallback. This script regenerates that snapshot.
 *
 * Usage:  node scripts/fetch-catalogue.mjs
 * Output: src/data/themealdb/catalogue.json
 *
 * TheMealDB's free endpoints need no API key.
 *   https://www.themealdb.com/api/json/v1/1/search.php?f=<letter>
 * returns every meal whose name starts with that letter, with full details.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://www.themealdb.com/api/json/v1/1'
const UA = 'CookCue/1.0 (Amazon Fire TV cooking demo)'
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'src/data/themealdb/catalogue.json',
)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function getJson(url, attempt = 1) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (error) {
    if (attempt >= 3) throw error
    await sleep(600 * attempt)
    return getJson(url, attempt + 1)
  }
}

/** Pull the 20 ingredient slots TheMealDB returns into a compact list. */
function ingredientsOf(meal) {
  const out = []
  for (let i = 1; i <= 20; i += 1) {
    const name = String(meal[`strIngredient${i}`] || '').trim()
    const amount = String(meal[`strMeasure${i}`] || '').trim()
    if (name) out.push({ name, amount })
  }
  return out
}

function toSnapshotMeal(meal) {
  return {
    id: String(meal.idMeal),
    title: String(meal.strMeal || '').trim(),
    category: String(meal.strCategory || '').trim(),
    area: String(meal.strArea || '').trim(),
    tags: String(meal.strTags || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    image: String(meal.strMealThumb || '').trim(),
    instructions: String(meal.strInstructions || '').trim(),
    ingredients: ingredientsOf(meal),
  }
}

async function main() {
  const byId = new Map()

  for (const letter of LETTERS) {
    const data = await getJson(`${API}/search.php?f=${letter}`)
    const meals = Array.isArray(data.meals) ? data.meals : []
    for (const meal of meals) byId.set(String(meal.idMeal), toSnapshotMeal(meal))
    console.log(`  ${letter}: ${meals.length} meals (total ${byId.size})`)
  }

  const meals = [...byId.values()]
    .filter((meal) => meal.title && meal.instructions)
    .sort((a, b) => a.title.localeCompare(b.title))

  const payload = {
    source: `${API}/search.php?f=<a-z>`,
    generatedAt: new Date().toISOString().slice(0, 10),
    meals,
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(payload)}\n`, 'utf8')

  const ingredients = new Set()
  let withTiming = 0
  for (const meal of meals) {
    meal.ingredients.forEach((item) => ingredients.add(item.name.toLowerCase()))
    if (/\b\d+\s*(min|mins|minutes|hour|hours|hrs)\b/i.test(meal.instructions)) withTiming += 1
  }

  console.log(`\nwrote ${meals.length} meals to ${path.relative(process.cwd(), OUT)}`)
  console.log(`  distinct ingredients: ${ingredients.size}`)
  console.log(`  meals with a timing hint in the instructions: ${withTiming}`)
}

main().catch((error) => {
  console.error('catalogue build failed:', error)
  process.exitCode = 1
})
