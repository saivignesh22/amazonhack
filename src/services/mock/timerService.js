/**
 * MOCK SERVICE — sample timers.
 *
 * Implements the TimerService contract (src/contracts/timers.js).
 * Replace with `setServiceImplementation('timers', realService)`.
 */
export const mockTimerService = {
  createTimer({ id, label, seconds }) {
    const total = seconds
    let status = 'idle'
    let remaining = seconds
    let endsAt = 0
    let handle = null
    const listeners = new Set()

    const getState = () => ({
      id,
      label,
      status,
      remainingSeconds: remaining,
      totalSeconds: total,
    })

    const notify = () => {
      const state = getState()
      listeners.forEach((listener) => listener(state))
    }

    const clear = () => {
      if (handle !== null) {
        clearInterval(handle)
        handle = null
      }
    }

    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
      remaining = left
      if (left <= 0) {
        clear()
        status = 'done'
        remaining = 0
        notify()
        return
      }
      notify()
    }

    const start = () => {
      if (status === 'running') return
      if (status === 'done') remaining = total
      status = 'running'
      endsAt = Date.now() + remaining * 1000
      clear()
      handle = setInterval(tick, 250)
      notify()
    }

    const pause = () => {
      if (status !== 'running') return
      remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
      clear()
      status = 'paused'
      notify()
    }

    const resume = () => {
      if (status !== 'paused') return
      status = 'running'
      endsAt = Date.now() + remaining * 1000
      clear()
      handle = setInterval(tick, 250)
      notify()
    }

    const stop = () => {
      clear()
      status = 'idle'
      remaining = total
      notify()
    }

    const subscribe = (listener) => {
      listeners.add(listener)
      listener(getState())
      return () => listeners.delete(listener)
    }

    return { id, label, start, pause, resume, stop, getState, subscribe }
  },
}
