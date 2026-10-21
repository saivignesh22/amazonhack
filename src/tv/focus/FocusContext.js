import { createContext } from 'react'

/**
 * The focus engine context.
 *
 * Kept in its own file so `FocusProvider.jsx` only exports components
 * (React Fast Refresh requirement).
 */
export const FocusContext = createContext(null)
