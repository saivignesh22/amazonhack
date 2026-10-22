/**
 * Recipe domain contract — owned by the frontend, consumed by Person 2.
 *
 * The frontend only ever talks to a service that implements this shape.
 * src/services/servicesRegistry.js decides which implementation is wired in:
 *   - TheMealDB catalogue (default)
 *   - the team's recipe engine (src/services/recipeEngineAdapter.js)
 *   - bundled sample data (src/services/mock/recipeService.js)
 *
 * Source data is not uniformly rich. TheMealDB has no difficulty, servings or
 * calories, so those fields are nullable and the UI renders "Not listed"
 * rather than inventing a value. Do not assume they are present.
 *
 * @typedef {object} Ingredient
 * @property {string} id            stable id inside the recipe
 * @property {string} name          display name ("Cherry tomatoes")
 * @property {string} amount        display amount ("300 g")
 * @property {string} pantryKey      normalised key used for matching ("tomato")
 * @property {boolean} [optional]   optional pantry items do not block cooking
 * @property {{name: string, note: string}[]} [substitutions] known swaps
 *
 * @typedef {object} RecipeStep
 * @property {string} id
 * @property {string} title         short headline for the step
 * @property {string} text          the instruction shown on the TV
 * @property {number|null} [minutes] rough duration, drives the progress hint
 * @property {string|null} [tip]    one-line chef tip
 * @property {{label: string, seconds: number}|null} [timer] suggested timer
 *
 * @typedef {object} Recipe
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle      one-line description (cuisine / category)
 * @property {string} cuisine
 * @property {string} category
 * @property {string|null} difficulty    'Easy' | 'Medium' | 'Hard' | null
 * @property {number|null} totalMinutes
 * @property {number|null} servings
 * @property {number|null} calories
 * @property {string[]} tags
 * @property {{from: string, to: string}} art  gradient used when there is no photo
 * @property {string} motif          shape hint for the fallback artwork
 * @property {string|null} image     photo URL (local ./recipes/... or remote)
 * @property {Ingredient[]} ingredients
 * @property {RecipeStep[]} steps
 *
 * @typedef {object} IngredientMatch
 * @property {string} id
 * @property {string} name
 * @property {string} amount
 * @property {'have' | 'missing'} status
 * @property {{name: string, note: string}|null} substitution
 *
 * @typedef {object} IngredientReport
 * @property {string} recipeId
 * @property {IngredientMatch[]} items
 * @property {number} haveCount
 * @property {number} missingCount
 * @property {number} totalCount
 *
 * @typedef {object} RecipeMatch
 * @property {Recipe} recipe
 * @property {number} score          0-100, share of the recipe the user has
 * @property {string[]} missing      display names of missing ingredients
 *
 * @typedef {object} RecommendationResult
 * @property {RecipeMatch[]} matches     ranked best-first, max 10
 * @property {Recipe[]} alternatives     non-empty only when nothing matches
 * @property {number} total              recipes considered
 *
 * @typedef {object} RecipeSearchResult
 * @property {string} query
 * @property {{recipe: Recipe, score: number}[]} results
 * @property {'local'|'live'|'none'} source  where the answer came from
 *
 * @typedef {object} RecipeService
 * @property {string} dataSourceLabel   shown in the app header
 * @property {() => Promise<Recipe[]>} listRecipes
 * @property {(id: string) => Promise<Recipe|null>} getRecipe
 * @property {() => Promise<Recipe[]>} getRecommendations
 * @property {(recipeId: string, availableIngredients?: string[]) => Promise<IngredientReport>} matchIngredients
 * @property {(availableIngredients: string[]) => Promise<RecommendationResult>} recommendByIngredients
 * @property {(query: string) => Promise<RecipeSearchResult>} searchRecipes
 */
export {}
