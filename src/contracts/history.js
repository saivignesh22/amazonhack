/**
 * Cooking history contract.
 *
 * A history entry exists only because the user finished the cooking flow (the
 * completion screen records it). Opening a recipe never creates one.
 *
 * The service is deliberately storage-agnostic: today it persists to
 * localStorage through src/services/history/historyStorage.js, and swapping in
 * a backend means replacing that adapter, not the screens.
 *
 * @typedef {object} HistoryEntry
 * @property {string} id         recipe id
 * @property {string} title
 * @property {string|null} image  thumbnail URL at the time it was cooked
 * @property {number} cookedAt   epoch milliseconds
 *
 * @typedef {object} HistoryRecordInput
 * @property {string} id
 * @property {string} [title]
 * @property {string|null} [image]
 * @property {number} [cookedAt]
 *
 * @typedef {object} HistoryService
 * @property {() => HistoryEntry[]} list            newest first
 * @property {(entry: HistoryRecordInput) => HistoryEntry[]} record
 * @property {(id: string) => HistoryEntry[]} remove
 * @property {() => HistoryEntry[]} clear
 * @property {(listener: (entries: HistoryEntry[]) => void) => () => void} subscribe
 * @property {boolean} persistent
 */
export {}
