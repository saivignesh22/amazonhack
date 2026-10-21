/**
 * Recipe domain contract — owned by the frontend, consumed by Person 2.
 *
 * The frontend only ever talks to a service that implements this shape.
 * `src/services/index.js` decides which implementation is wired in; today
 * that is the mock, tomorrow it is the real recipe/ingredient engine.
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
 * @property {number} [minutes]     rough duration, drives the progress hint
 * @property {string} [tip]         one-line chef tip
 * @property {{label: string, seconds: number}} [timer] suggested timer
 *
 * @typedef {object} Recipe
 * @property {string} id
 * @property {string} title
 * @property {string} subtitle
 * @property {string} cuisine
 * @property {string} difficulty    'Easy' | 'Medium' | 'Hard'
 * @property {number} totalMinutes
 * @property {number} servings
 * @property {number} calories
 * @property {string[]} tags
 * @property {{from: string, to: string}} art  gradient used for the tile
 * @property {string} motif          shape hint for the tile artwork
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
 * @typedef {object} RecipeService
 * @property {() => Promise<Recipe[]>} listRecipes
 * @property {(id: string) => Promise<Recipe|null>} getRecipe
 * @property {() => Promise<Recipe[]>} getRecommendations
 * @property {(recipeId: string) => Promise<IngredientReport>} matchIngredients
 */
export {}
