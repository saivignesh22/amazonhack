/**
 * Glue between the contract recipes and the recipe engine's matcher
 * (src/utils/ingredients.js + src/utils/substitutions.js, Person 2).
 *
 * The block/rank logic itself lives in the engine. This module only:
 *   - normalises the user's list into pantry keys,
 *   - hands the engine a minimal view of a recipe,
 *   - decorates the answer with substitutions and contract shapes.
 */
import { getMatchScore, getMissingIngredients } from '../utils/ingredients.js'
import { getSubstitutions } from '../utils/substitutions.js'
import { canonicalIngredientName } from './ingredientNames.js'

/** @param {string[]} ingredients */
export function pantryKeys(ingredients) {
  return (ingredients || []).map(canonicalIngredientName).filter(Boolean)
}

/** The engine's matcher only reads `recipe.ingredients[].name`. */
function engineView(recipe) {
  return { ingredients: recipe.ingredients.map((item) => ({ name: item.pantryKey })) }
}

/**
 * @param {import('../contracts/recipes.js').Recipe} recipe
 * @param {string[]} available
 * @returns {import('../contracts/recipes.js').IngredientReport}
 */
export function matchReport(recipe, available) {
  const missing = new Set(
    getMissingIngredients(engineView(recipe), pantryKeys(available)).map(
      canonicalIngredientName,
    ),
  )

  const items = recipe.ingredients.map((item) => {
    const have = !missing.has(item.pantryKey)
    let substitution = null
    if (!have) {
      const options = getSubstitutions(item.pantryKey)
      if (options.length > 0) {
        substitution = { name: options[0].name, note: options[0].note }
      }
    }
    return {
      id: item.id,
      name: item.name,
      amount: item.amount,
      status: have ? 'have' : 'missing',
      substitution,
    }
  })

  const haveCount = items.filter((item) => item.status === 'have').length

  return {
    recipeId: recipe.id,
    items,
    haveCount,
    missingCount: items.length - haveCount,
    totalCount: items.length,
  }
}

/**
 * Rank recipes by how much of the user's kitchen they use.
 * @param {import('../contracts/recipes.js').Recipe[]} recipes
 * @param {string[]} available
 * @param {number} [limit]
 * @returns {{recipe: import('../contracts/recipes.js').Recipe, score: number, missing: string[]}[]}
 */
export function rankRecipes(recipes, available, limit = 10) {
  const pantry = pantryKeys(available)
  if (pantry.length === 0) return []

  const scored = []
  for (const recipe of recipes) {
    const view = engineView(recipe)
    const score = getMatchScore(view, pantry)
    if (score <= 0) continue
    scored.push({
      recipe,
      score,
      missing: getMissingIngredients(view, pantry),
    })
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.missing.length - b.missing.length ||
      (a.recipe.totalMinutes || 999) - (b.recipe.totalMinutes || 999) ||
      a.recipe.title.localeCompare(b.recipe.title),
  )

  return scored.slice(0, limit)
}
