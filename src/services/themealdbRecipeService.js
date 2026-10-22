/**
 * RecipeService backed by TheMealDB (https://www.themealdb.com/).
 *
 * The catalogue is committed as a snapshot (src/data/themealdb/catalogue.json,
 * 790 meals) so a Fire TV that is offline still gets the full experience with
 * every photo. The live API is used for dishes that are not in the snapshot,
 * which keeps "have a particular recipe in mind?" useful beyond the bundle.
 *
 * Ingredient matching is NOT reimplemented here: it goes through
 * src/services/recipeMatching.js, which calls the recipe engine
 * (src/utils/ingredients.js + src/utils/substitutions.js, Person 2).
 */
import catalogue from '../data/themealdb/catalogue.json'
import { matchReport, rankRecipes } from './recipeMatching.js'
import { imageFor } from './recipeImages.js'
import { normaliseMeal } from './recipeNormalisers.js'

const API = 'https://www.themealdb.com/api/json/v1/1'
const TIMEOUT_MS = 6000
const MAX_RESULTS = 10

/** @type {Map<string, import('../contracts/recipes.js').Recipe>|null} */
let recipesById = null
let liveReachable = null

function allRecipes() {
  if (!recipesById) {
    recipesById = new Map()
    for (const meal of catalogue.meals) {
      recipesById.set(String(meal.id), normaliseMeal(meal, { image: imageFor(meal.id) }))
    }
  }
  return recipesById
}

async function fetchLive(path) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${API}/${path}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    liveReachable = true
    return await response.json()
  } catch (error) {
    liveReachable = false
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** Raw TheMealDB API meal -> the shape normaliseMeal() expects. */
function snapshotShape(meal) {
  const ingredients = []
  for (let i = 1; i <= 20; i += 1) {
    const name = String(meal[`strIngredient${i}`] || '').trim()
    if (name) ingredients.push({ name, amount: String(meal[`strMeasure${i}`] || '').trim() })
  }
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
    ingredients,
  }
}

/** Keep a live result in the cache so its photo and steps stay available. */
function rememberLiveMeal(meal) {
  const shaped = snapshotShape(meal)
  if (!allRecipes().has(shaped.id)) {
    allRecipes().set(
      shaped.id,
      normaliseMeal(shaped, { image: imageFor(shaped.id) || shaped.image || null }),
    )
  }
  return allRecipes().get(shaped.id)
}

function localSearch(query, limit = 5) {
  const needle = query.toLowerCase().trim()
  const needleWords = needle.split(/[^a-z0-9]+/).filter((word) => word.length > 2)

  const scored = []
  for (const recipe of allRecipes().values()) {
    const title = recipe.title.toLowerCase()
    let score = 0

    if (title === needle) score = 100
    else if (title.startsWith(needle)) score = 90
    else if (title.includes(needle)) score = 80
    else if (needleWords.length > 0) {
      const words = new Set(title.split(/[^a-z0-9]+/))
      const hits = needleWords.filter((word) => words.has(word)).length
      if (hits > 0) score = Math.round((hits / needleWords.length) * 70)
    }

    if (score > 0) scored.push({ recipe, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title))
    .slice(0, limit)
}

function quickPicks(limit) {
  return [...allRecipes().values()]
    .filter((recipe) => recipe.totalMinutes && recipe.totalMinutes <= 45)
    .sort((a, b) => a.totalMinutes - b.totalMinutes || a.title.localeCompare(b.title))
    .slice(0, limit)
}

export const themealdbRecipeService = {
  /** Shown in the app header so the data source is never a mystery. */
  dataSourceLabel: 'TheMealDB',

  async listRecipes() {
    return [...allRecipes().values()]
  },

  async getRecipe(id) {
    const key = String(id)
    if (allRecipes().has(key)) return allRecipes().get(key)

    try {
      const data = await fetchLive(`lookup.php?i=${encodeURIComponent(key)}`)
      const meal = Array.isArray(data.meals) ? data.meals[0] : null
      return meal ? rememberLiveMeal(meal) : null
    } catch {
      return null
    }
  },

  async getRecommendations() {
    return quickPicks(8)
  },

  async matchIngredients(recipeId, availableIngredients = []) {
    const recipe = await this.getRecipe(recipeId)
    if (!recipe) {
      return { recipeId, items: [], haveCount: 0, missingCount: 0, totalCount: 0 }
    }
    return matchReport(recipe, availableIngredients)
  },

  /**
   * Rank the catalogue by how much of the user's kitchen each recipe uses.
   * @param {string[]} availableIngredients
   */
  async recommendByIngredients(availableIngredients = []) {
    const matches = rankRecipes([...allRecipes().values()], availableIngredients, MAX_RESULTS)
    return {
      matches,
      // Nothing uses what the user has: still offer something to cook, but say
      // why, instead of pretending these are ingredient matches.
      alternatives: matches.length === 0 ? quickPicks(6) : [],
      total: allRecipes().size,
    }
  },

  /**
   * "Have a particular recipe in mind?" - local catalogue first, then the
   * live API for dishes that are not in the snapshot.
   */
  async searchRecipes(query) {
    const text = String(query || '').trim()
    if (!text) return { query: text, results: [], source: 'none' }

    const local = localSearch(text, 5)
    if (local.length > 0 && local[0].score >= 70) {
      return { query: text, results: local, source: 'local' }
    }

    try {
      const data = await fetchLive(`search.php?s=${encodeURIComponent(text)}`)
      const meals = Array.isArray(data.meals) ? data.meals : []
      const results = meals
        .slice(0, 5)
        .map((meal) => ({ recipe: rememberLiveMeal(meal), score: 95 }))
      if (results.length > 0) return { query: text, results, source: 'live' }
    } catch {
      // Offline: fall through to whatever the snapshot could suggest.
    }

    return { query: text, results: local, source: local.length > 0 ? 'local' : 'none' }
  },

  async getStatus() {
    return { totalRecipes: allRecipes().size, live: liveReachable }
  },
}
