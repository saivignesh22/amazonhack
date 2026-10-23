/**
 * Persistence for the cooking history.
 *
 * localStorage is the right tool for a prototype, but a WebView can refuse it
 * (private mode, storage disabled). This adapter probes once and falls back to
 * memory, so the UI never crashes - it just forgets between launches.
 *
 * Swapping in a real backend later means replacing this object; the history
 * service above it does not care where the bytes go.
 */

const KEY = 'cookcue.history.v1'

function parse(raw) {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function createLocalStorageAdapter({ key = KEY } = {}) {
  let memory = []
  /** @type {boolean|null} */
  let usable = null

  function storage() {
    if (usable === null) {
      usable = false
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const probe = '__cookcue_probe__'
          window.localStorage.setItem(probe, '1')
          window.localStorage.removeItem(probe)
          usable = true
        }
      } catch {
        usable = false
      }
    }
    return usable ? window.localStorage : null
  }

  return {
    read() {
      const store = storage()
      if (!store) return [...memory]
      const stored = parse(store.getItem(key))
      memory = stored
      return [...stored]
    },

    write(entries) {
      memory = [...entries]
      const store = storage()
      if (!store) return
      try {
        store.setItem(key, JSON.stringify(entries))
      } catch {
        // Quota exceeded or storage revoked: keep the in-memory copy so the
        // current session still behaves correctly.
        usable = false
      }
    },

    get persistent() {
      return storage() !== null
    },
  }
}
