/**
 * RecipeService over the recipe engine (Person 2): src/data/recipes.json +
 * src/utils/ingredients.js + src/utils/substitutions.js.
 *
 * TheMealDB is the default implementation (src/services/themealdbRecipeService.js)
 * because it ships a wide catalogue. This adapter is the other side of the
 * switch: one line in src/services/servicesRegistry.js makes the team's own
 * engine the live data source, with the same contract and no screen changes.
 *
 *   setServiceImplementation('recipes', recipeEngineService)
 */
import engineRecipes from '../data/recipes.json'
import { matchReport, rankRecipes } from './recipeMatching.js'
import { imageFor } from './recipeImages.js'
import { normaliseEngineRecipe } from './recipeNormalisers.js'

const recipes = engineRecipes.map((recipe) =>
  normaliseEngineRecipe(recipe, { image: imageFor(recipe.id) }),
)
const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]))

function searchLocal(query, limit = 5) {
  const needle = String(query || '').toLowerCase().trim()
  if (!needle) return []
  return recipes
    .map((recipe) => {
      const title = recipe.title.toLowerCase()
      if (title === needle) return { recipe, score: 100 }
      if (title.startsWith(needle)) return { recipe, score: 90 }
      if (title.includes(needle)) return { recipe, score: 80 }
      return null
    })
    .filter(Boolean)
    .slice(0, limit)
}

export const recipeEngineService = {
  dataSourceLabel: 'Recipe engine · sample data',

  async listRecipes() {
    return recipes
  },

  async getRecipe(id) {
    return byId.get(String(id)) || null
  },

  async getRecommendations() {
    return recipes
      .filter((recipe) => recipe.totalMinutes && recipe.totalMinutes <= 30)
      .slice(0, 8)
  },

  async matchIngredients(recipeId, availableIngredients = []) {
    const recipe = byId.get(String(recipeId))
    if (!recipe) {
      return { recipeId, items: [], haveCount: 0, missingCount: 0, totalCount: 0 }
    }
    return matchReport(recipe, availableIngredients)
  },

  async recommendByIngredients(availableIngredients = []) {
    const matches = rankRecipes(recipes, availableIngredients, 10)
    return {
      matches,
      alternatives: matches.length === 0 ? recipes.slice(0, 6) : [],
      total: recipes.length,
    }
  },

  async searchRecipes(query) {
    const results = searchLocal(query)
    return { query: String(query || ''), results, source: results.length > 0 ? 'local' : 'none' }
  },

  async getStatus() {
    return { totalRecipes: recipes.length, live: null }
  },
}
