import { useEffect, useState } from 'react'
import { getServices } from '../servicesRegistry.js'

/**
 * Live cooking history. Re-renders whenever an entry is recorded or removed.
 * @returns {import('./historyService.js').HistoryEntry[]}
 */
export function useCookingHistory() {
  const { history } = getServices()
  const [entries, setEntries] = useState(() => history.list())

  useEffect(() => history.subscribe(setEntries), [history])

  return entries
}
