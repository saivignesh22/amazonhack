import { createContext, useContext } from 'react'

/**
 * Router context and hook.
 *
 * Kept separate from `router.jsx` so that file only exports components
 * (React Fast Refresh requirement).
 */
export const RouterContext = createContext(null)

export function useRouter() {
  const router = useContext(RouterContext)
  if (!router) throw new Error('useRouter must be used inside a RouterProvider')
  return router
}
