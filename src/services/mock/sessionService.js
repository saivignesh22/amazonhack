/**
 * MOCK SERVICE — sample cooking sessions.
 *
 * Implements the SessionService contract (src/contracts/session.js).
 * Replace with `setServiceImplementation('session', realService)`.
 */
export const mockSessionService = {
  createSession({ recipeId, steps }) {
    const list = steps || []
    const total = list.length
    let stepIndex = 0
    let completed = false
    let startedAt = 0
    const listeners = new Set()

    const getState = () => ({
      recipeId,
      stepIndex,
      total,
      completed,
      startedAt,
    })

    const notify = () => {
      const state = getState()
      listeners.forEach((listener) => listener(state))
    }

    const clamp = (index) => Math.min(Math.max(index, 0), Math.max(total - 1, 0))

    const goTo = (index) => {
      stepIndex = clamp(index)
      if (!startedAt) startedAt = Date.now()
      notify()
    }

    const next = () => {
      if (startedAt === 0) startedAt = Date.now()
      if (stepIndex < total - 1) {
        stepIndex += 1
      } else {
        completed = true
      }
      notify()
    }

    const previous = () => {
      stepIndex = clamp(stepIndex - 1)
      notify()
    }

    const repeat = () => {
      if (startedAt === 0) startedAt = Date.now()
      notify()
    }

    const complete = () => {
      completed = true
      notify()
    }

    const subscribe = (listener) => {
      listeners.add(listener)
      listener(getState())
      return () => listeners.delete(listener)
    }

    return {
      getState,
      getCurrent: () => list[stepIndex] || null,
      getIndex: () => stepIndex,
      getTotal: () => total,
      next,
      previous,
      repeat,
      goTo,
      complete,
      subscribe,
    }
  },
}
