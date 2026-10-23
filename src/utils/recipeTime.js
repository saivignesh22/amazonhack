/**
 * Display label for a recipe's time.
 *
 * TheMealDB publishes no total time, so its `totalMinutes` is derived from the
 * durations mentioned in the steps. Those are marked `timeEstimated` and get a
 * leading tilde: "~15 min" reads as an estimate, "15 min" as a published fact.
 *
 * @param {{totalMinutes?: number|null, timeEstimated?: boolean}|null} recipe
 * @returns {string|null} label, or null when the source has no time at all
 */
export function formatRecipeTime(recipe) {
  if (!recipe?.totalMinutes) return null
  return `${recipe.timeEstimated ? '~' : ''}${recipe.totalMinutes} min`
}
