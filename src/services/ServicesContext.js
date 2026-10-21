import { createContext, useContext } from 'react'
import { getServices } from './servicesRegistry.js'

/**
 * Services context and hook.
 *
 * Kept separate from `ServicesProvider.jsx` so that file only exports
 * components (React Fast Refresh requirement).
 */
export const ServicesContext = createContext(getServices())

export function useServices() {
  return useContext(ServicesContext)
}
