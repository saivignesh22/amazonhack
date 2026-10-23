/**
 * Cooking history: the recipes the user actually finished cooking.
 *
 * Only the completion screen records an entry - opening a recipe never does.
 * One entry per recipe (cooking it again moves it to the top instead of
 * adding a duplicate), newest first.
 *
 * @typedef {object} HistoryEntry
 * @property {string} id        recipe id
 * @property {string} title
 * @property {string|null} image
 * @property {number} cookedAt  epoch ms
 */
import { createLocalStorageAdapter } from './historyStorage.js'

export const MAX_HISTORY = 24

/** @param {HistoryEntry[]} entries */
function normalise(entries) {
  const seen = new Set()
  return (entries || [])
    .filter((entry) => entry && entry.id && !seen.has(String(entry.id)) && seen.add(String(entry.id)))
    .map((entry) => ({
      id: String(entry.id),
      title: String(entry.title || ''),
      image: entry.image || null,
      cookedAt: Number(entry.cookedAt) || 0,
    }))
    .sort((a, b) => b.cookedAt - a.cookedAt)
    .slice(0, MAX_HISTORY)
}

/**
 * @param {{read: () => HistoryEntry[], write: (entries: HistoryEntry[]) => void, persistent?: boolean}} [storage]
 */
export function createHistoryService(storage = createLocalStorageAdapter()) {
  let entries = normalise(storage.read())
  const listeners = new Set()

  function publish() {
    storage.write(entries)
    for (const listener of listeners) listener(entries)
  }

  return {
    /** Newest first. */
    list() {
      return entries
    },

    /**
     * Record a finished cook. Re-cooking moves the recipe to the top.
     * @param {{id: string, title?: string, image?: string|null, cookedAt?: number}} recipe
     */
    record({ id, title = '', image = null, cookedAt = Date.now() } = {}) {
      if (!id) return entries
      const entry = {
        id: String(id),
        title: String(title || ''),
        image: image || null,
        cookedAt: Number(cookedAt) || Date.now(),
      }
      entries = [entry, ...entries.filter((item) => item.id !== entry.id)].slice(0, MAX_HISTORY)
      publish()
      return entries
    },

    /** @param {string} id */
    remove(id) {
      const key = String(id)
      entries = entries.filter((entry) => entry.id !== key)
      publish()
      return entries
    },

    clear() {
      entries = []
      publish()
      return entries
    },

    /** @param {(entries: HistoryEntry[]) => void} listener */
    subscribe(listener) {
      listeners.add(listener)
      listener(entries)
      return () => listeners.delete(listener)
    },

    get persistent() {
      return Boolean(storage.persistent)
    },
  }
}
