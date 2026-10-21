/**
 * Cooking session contract — owned by Person 3.
 *
 * A session owns "where am I in this recipe" so that stepping forward and
 * back survives screen changes (the cooking screen can be left and re-entered
 * without losing the current step).
 *
 * @typedef {object} SessionState
 * @property {string} recipeId
 * @property {number} stepIndex     zero based index of the current step
 * @property {number} total         number of steps in the recipe
 * @property {boolean} completed
 * @property {number} startedAt     epoch ms, 0 when not started
 *
 * @typedef {object} Session
 * @property {() => SessionState} getState
 * @property {() => import('./recipes.js').RecipeStep|null} getCurrent
 * @property {() => number} getIndex
 * @property {() => number} getTotal
 * @property {() => void} next
 * @property {() => void} previous
 * @property {() => void} repeat       replay the current step (timer restart)
 * @property {(index: number) => void} goTo
 * @property {() => void} complete
 * @property {(listener: (state: SessionState) => void) => () => void} subscribe
 *
 * @typedef {object} SessionService
 * @property {(config: {recipeId: string, steps: import('./recipes.js').RecipeStep[]}) => Session} createSession
 */
export {}
