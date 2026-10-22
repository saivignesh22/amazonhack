import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { creditFor, imageCount, imageFor } from '../src/services/recipeImages.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const manifest = JSON.parse(readFileSync(path.join(root, 'src/data/recipeImages.json'), 'utf8'))
const catalogue = JSON.parse(readFileSync(path.join(root, 'src/data/themealdb/catalogue.json'), 'utf8'))
const engineRecipes = JSON.parse(readFileSync(path.join(root, 'src/data/recipes.json'), 'utf8'))

const images = manifest.images

test('every catalogue meal ships with a photo', () => {
  const missing = catalogue.meals.filter((meal) => !images[meal.id])
  assert.deepEqual(missing.map((meal) => meal.id), [], 'meals without a photo')
  assert.ok(imageCount() >= catalogue.meals.length)
})

test('every engine recipe ships with a photo', () => {
  const missing = engineRecipes.filter((recipe) => !images[recipe.id])
  assert.deepEqual(missing.map((recipe) => recipe.id), [], 'engine recipes without a photo')
})

test('every referenced photo exists on disk and is not empty', () => {
  const broken = []
  for (const [id, entry] of Object.entries(images)) {
    const file = path.join(root, 'public', 'recipes', entry.file)
    if (!existsSync(file) || statSync(file).size < 1024) broken.push(`${id}:${entry.file}`)
  }
  assert.deepEqual(broken, [], 'missing or tiny image files')
})

test('photos are 16:9 and keep a sensible size', () => {
  const wrong = []
  for (const [id, entry] of Object.entries(images)) {
    const ratio = entry.width / entry.height
    if (Math.abs(ratio - 16 / 9) > 0.01) wrong.push(`${id}:${entry.width}x${entry.height}`)
    if (entry.width > 800 || entry.height > 450) wrong.push(`${id}: too large`)
  }
  assert.deepEqual(wrong, [], 'images that are not 16:9 or are oversized')
})

test('every photo carries provenance and a licence note', () => {
  const missing = []
  for (const [id, entry] of Object.entries(images)) {
    if (!entry.provider || !entry.source || !entry.license) missing.push(id)
  }
  assert.deepEqual(missing, [], 'photos without provider/source/licence')
})

test('imageFor returns a relative URL that works from a sub-path', () => {
  assert.equal(imageFor('52893'), './recipes/meals/52893.jpg')
  assert.equal(imageFor('tomato-pasta'), './recipes/local/tomato-pasta.jpg')
  assert.equal(imageFor('does-not-exist'), null)
  assert.equal(imageFor(''), null)
})

test('creditFor exposes the attribution without the file internals', () => {
  const credit = creditFor('52893')
  assert.equal(credit.provider, 'TheMealDB')
  assert.equal(credit.license, 'TheMealDB (free recipe database)')
  assert.equal(creditFor('nope'), null)
})

test('no two recipes point at the same file', () => {
  const seen = new Map()
  const duplicates = []
  for (const [id, entry] of Object.entries(images)) {
    if (seen.has(entry.file)) duplicates.push(`${id} and ${seen.get(entry.file)}`)
    seen.set(entry.file, id)
  }
  assert.deepEqual(duplicates, [], 'shared image files')
})
