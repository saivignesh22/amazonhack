import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { FocusContext } from '../tv/focus/FocusContext.js'
import { RouterContext } from './routerContext.js'
import { setBackHandler } from '../tv/back.js'

/**
 * A very small stack router.
 *
 * The screen stack is what the Back button unwinds:
 *   Home -> Details -> Ingredients -> Cooking -> Completion
 *
 * Every entry remembers which item was focused when the user left it, so
 * going back lands on exactly the same tile/button instead of resetting.
 */
export function RouterProvider({ children }) {
  const focus = useContext(FocusContext)
  const [stack, setStack] = useState([{ key: 'home', screen: 'home', params: {}, focusId: null }])

  const stackRef = useRef(stack)

  useEffect(() => {
    stackRef.current = stack
  }, [stack])

  const getActiveId = useMemo(() => (focus ? focus.getActiveId : () => null), [focus])

  const navigate = useCallback((screen, params = {}) => {
    setStack((prev) => {
      const top = prev[prev.length - 1]
      const withFocus = { ...top, focusId: getActiveId() }
      const next = {
        key: `${screen}:${params.id ?? ''}:${prev.length}`,
        screen,
        params,
        focusId: null,
      }
      return [...prev.slice(0, -1), withFocus, next]
    })
  }, [getActiveId])

  const back = useCallback(() => {
    setStack((prev) => (prev.length <= 1 ? prev : prev.slice(0, -1)))
  }, [])

  const reset = useCallback((screen, params = {}) => {
    setStack([
      { key: `${screen}:${params.id ?? ''}:0`, screen, params, focusId: null },
    ])
  }, [])

  // One Back handler for the whole app: the remote Back key, the Escape key
  // and the native Android Back button all arrive here.
  useEffect(
    () =>
      setBackHandler(() => {
        if (stackRef.current.length > 1) {
          back()
          return true
        }
        // At the root screen the platform is allowed to close the app.
        return false
      }),
    [back],
  )

  const current = stack[stack.length - 1]

  const value = useMemo(
    () => ({ stack, current, navigate, back, reset, canGoBack: stack.length > 1 }),
    [stack, current, navigate, back, reset],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}
