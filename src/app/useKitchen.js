import { useEffect, useState } from 'react'
import { getKitchenState, subscribeKitchen } from './kitchenState.js'

/**
 * Subscribe a component to the kitchen store.
 * @returns {import('./kitchenState.js').KitchenState}
 */
export function useKitchen() {
  const [state, setState] = useState(getKitchenState)

  useEffect(() => subscribeKitchen(setState), [])

  return state
}
