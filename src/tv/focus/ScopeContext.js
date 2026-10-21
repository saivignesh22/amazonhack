import { createContext, useContext } from 'react'

/** Scope id of the FocusScope a focusable lives in. */
export const ScopeContext = createContext(null)

export function useScope() {
  return useContext(ScopeContext)
}
