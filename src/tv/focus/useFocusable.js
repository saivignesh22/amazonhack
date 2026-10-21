import { useContext, useEffect, useRef } from 'react'
import { FocusContext } from './FocusContext.js'
import { useScope } from './ScopeContext.js'

/**
 * Register an element as a focusable target.
 *
 * @param {object} options
 * @param {string} options.id unique id for the element (used for focus restore)
 * @param {() => void} [options.onSelect] called when the user presses Select
 * @param {boolean} [options.disabled] when true the element is skipped
 * @param {string} [options.group] optional grouping hint (e.g. a row)
 */
export function useFocusable({ id, onSelect, disabled = false, group }) {
  const focus = useContext(FocusContext)
  const scope = useScope()
  const ref = useRef(null)
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const el = ref.current
    if (!el || !focus) return undefined

    const unregister = focus.register({
      id,
      el,
      scope,
      group,
      disabled,
      onSelect: (event) => onSelectRef.current?.(event),
    })
    return unregister
  }, [id, focus, scope, group, disabled])

  const focusableProps = {
    ref,
    tabIndex: -1,
    'data-focusable': 'true',
    'data-focus-id': id,
    onClick: (event) => {
      // Mouse click (development convenience). On a TV the Enter key is
      // intercepted by the focus engine, so this never double-fires there.
      onSelectRef.current?.(event)
    },
  }

  return { ref, focusableProps }
}
