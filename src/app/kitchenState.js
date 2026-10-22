/**
 * The user's kitchen: the ingredient list they typed on the home screen.
 *
 * It lives in a module-level store rather than component state because the
 * home screen, the results and the per-recipe "What do you have?" screen all
 * read it, and it must survive navigating away and back. It is deliberately
 * not persisted: a demo on a Fire TV should start clean.
 *
 * Dedupe and parsing rules come from src/services/ingredientNames.js, which is
 * also what the recipe matcher uses, so "Eggs" and "eggs " never both appear.
 */
import { canonicalIngredientName, mergeIngredients, splitIngredientList } from '../services/ingredientNames.js'

/** @typedef {{ingredients: string[], searched: boolean}} KitchenState */

/** @type {KitchenState} */
let state = { ingredients: [], searched: false }

/** @type {Set<(state: KitchenState) => void>} */
const listeners = new Set()

/** @param {Partial<KitchenState>} patch */
function update(patch) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener(state)
  return state
}

/** Current snapshot (stable between updates). */
export function getKitchenState() {
  return state
}

/**
 * Subscribe to changes. Returns an unsubscribe function.
 * @param {(state: KitchenState) => void} listener
 */
export function subscribeKitchen(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Add everything in `input` (comma/semicolon/newline separated).
 * Empty strings and duplicates are dropped; returns the new list.
 * @param {string|string[]} input
 */
export function addIngredients(input) {
  const additions = Array.isArray(input) ? input : splitIngredientList(input)
  const ingredients = mergeIngredients(state.ingredients, additions)
  if (ingredients.length === state.ingredients.length) return state.ingredients
  return update({ ingredients }).ingredients
}

/** @param {string} name */
export function removeIngredient(name) {
  const key = canonicalIngredientName(name)
  const ingredients = state.ingredients.filter((item) => canonicalIngredientName(item) !== key)
  if (ingredients.length === state.ingredients.length) return state.ingredients
  return update({ ingredients }).ingredients
}

export function clearIngredients() {
  if (state.ingredients.length === 0) return state.ingredients
  return update({ ingredients: [], searched: false }).ingredients
}

/** Remember that the user has asked for recommendations at least once. */
export function setSearched(searched) {
  if (state.searched === searched) return state
  return update({ searched })
}

/** Reset everything (used by tests and by "start over"). */
export function resetKitchen() {
  return update({ ingredients: [], searched: false })
}
