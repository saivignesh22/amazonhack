import { useContext, useEffect, useId, useRef } from 'react'
import { FocusContext } from './FocusContext.js'
import { ScopeContext } from './ScopeContext.js'

/**
 * Groups focusables into a scope and decides where focus lands.
 *
 * @param {object} props
 * @param {string} [props.initialFocusId] id to focus on mount (used to restore
 *   the exact item the user was on when they navigated away and came back)
 * @param {string} [props.defaultFocusId] fallback id
 *
 * The scope also listens for registrations, because a screen can render its
 * focusables only after data arrives. Once focus has been placed we never
 * take it away again, so late registrations cannot steal the user's focus.
 */
export function FocusScope({ initialFocusId, defaultFocusId, children }) {
  const focus = useContext(FocusContext)
  const scopeId = useId()
  const placedRef = useRef(false)

  useEffect(() => {
    if (!focus) return undefined

    const apply = () => {
      const entries = focus.getEntries()
      if (entries.length === 0) return

      const target = initialFocusId || defaultFocusId
      if (!placedRef.current && target && entries.some((e) => e.id === target)) {
        placedRef.current = true
        focus.focusId(target)
        return
      }

      // The user (or another screen) already owns the focus.
      if (placedRef.current || focus.getActiveId()) return

      const inScope = entries.filter((e) => e.scope === scopeId)
      const first = inScope[0] || entries[0]
      if (first) {
        placedRef.current = true
        focus.focusId(first.id)
      }
    }

    apply()
    return focus.subscribeRegistry(apply)
  }, [focus, scopeId, initialFocusId, defaultFocusId])

  return <ScopeContext.Provider value={scopeId}>{children}</ScopeContext.Provider>
}
