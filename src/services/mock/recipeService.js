import { SAMPLE_RECIPES } from '../../data/recipes.js'
import { matchReport, rankRecipes } from '../recipeMatching.js'

/**
 * MOCK SERVICE — bundled sample recipes only.
 *
 * Implements the RecipeService contract (src/contracts/recipes.js) against
 * src/data/recipes.js. Kept as the labelled demo/fixture data and as the
 * offline fallback for tests. Matching goes through the same shared glue as
 * the real services, so the behaviour never drifts.
 */
export const mockRecipeService = {
  dataSourceLabel: 'Sample data',

  async listRecipes() {
    return SAMPLE_RECIPES
  },

  async getRecipe(id) {
    return SAMPLE_RECIPES.find((recipe) => recipe.id === id) || null
  },

  async getRecommendations() {
    return SAMPLE_RECIPES.filter((recipe) => recipe.totalMinutes <= 30)
  },

  async matchIngredients(recipeId, availableIngredients = []) {
    const recipe = SAMPLE_RECIPES.find((item) => item.id === recipeId)
    if (!recipe) {
      return { recipeId, items: [], haveCount: 0, missingCount: 0, totalCount: 0 }
    }
    return matchReport(recipe, availableIngredients)
  },

  async recommendByIngredients(availableIngredients = []) {
    const matches = rankRecipes(SAMPLE_RECIPES, availableIngredients, 10)
    return {
      matches,
      alternatives: matches.length === 0 ? SAMPLE_RECIPES.slice(0, 6) : [],
      total: SAMPLE_RECIPES.length,
    }
  },

  async searchRecipes(query) {
    const needle = String(query || '').toLowerCase().trim()
    if (!needle) return { query: '', results: [], source: 'none' }
    const results = SAMPLE_RECIPES.filter((recipe) =>
      recipe.title.toLowerCase().includes(needle),
    ).map((recipe) => ({ recipe, score: 80 }))
    return { query: needle, results, source: results.length > 0 ? 'local' : 'none' }
  },

  async getStatus() {
    return { totalRecipes: SAMPLE_RECIPES.length, live: null }
  },
}
