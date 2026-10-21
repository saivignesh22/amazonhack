/**
 * Session and timer caches.
 *
 * The cooking screen is mounted and unmounted as the user moves between
 * screens, so the session (which step we are on) and the timers have to
 * outlive the screen. Caching them here keeps "step 3 of 5" and a running
 * timer intact when the user backs out to the ingredient list and returns.
 */

const sessionCache = new Map()
const timerCache = new Map()

export function getCookingSession(service, recipe) {
  const existing = sessionCache.get(recipe.id)
  if (existing && existing.service === service) return existing.session

  const session = service.createSession({ recipeId: recipe.id, steps: recipe.steps })
  sessionCache.set(recipe.id, { service, session })
  return session
}

export function resetCookingSession(recipeId) {
  sessionCache.delete(recipeId)
}

export function getStepTimer(service, recipeId, step) {
  if (!step.timer) return null

  const key = `${recipeId}:${step.id}`
  const existing = timerCache.get(key)
  if (existing && existing.service === service) return existing.timer

  const timer = service.createTimer({
    id: key,
    label: step.timer.label,
    seconds: step.timer.seconds,
  })
  timerCache.set(key, { service, timer })
  return timer
}

export function clearTimerCaches() {
  timerCache.clear()
}
