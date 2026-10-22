import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { findNextCandidate } from './spatial.js'
import { resolveAction } from '../keys.js'
import { FocusContext } from './FocusContext.js'

/**
 * Owns the single source of truth for "what is focused right now".
 *
 * Design notes for Fire TV:
 * - A single capture-phase keydown listener owns the arrow keys. We call
 *   preventDefault() so the WebView's own spatial navigation does not fight
 *   ours (the Fire OS WebView implements spatial focus on some builds).
 * - Focus is moved programmatically, so the visible focus ring is driven by
 *   the `data-focus-active` attribute instead of relying on :focus-visible,
 *   which is unreliable when focus is moved by script.
 * - The context value is referentially stable. If it changed on every
 *   registration, each focusable would re-register in an endless loop.
 */
export function FocusProvider({ children }) {
  const entriesRef = useRef(new Map())
  const registryListenersRef = useRef(new Set())
  const [activeId, setActiveId] = useState(null)
  const [registryVersion, setRegistryVersion] = useState(0)
  const activeIdRef = useRef(null)

  const setActive = useCallback((id) => {
    activeIdRef.current = id
    setActiveId(id)
  }, [])

  const notifyRegistry = useCallback(() => {
    registryListenersRef.current.forEach((listener) => listener())
  }, [])

  /** Notified whenever a focusable registers or unregisters. */
  const subscribeRegistry = useCallback((listener) => {
    registryListenersRef.current.add(listener)
    return () => registryListenersRef.current.delete(listener)
  }, [])

  const getEntries = useCallback(() => Array.from(entriesRef.current.values()), [])

  /** The id of the focused element, or null when nothing is focused. */
  const getActiveId = useCallback(() => {
    const id = activeIdRef.current
    if (!id) return null
    return entriesRef.current.has(id) ? id : null
  }, [])

  const focusId = useCallback(
    (id) => {
      if (!id) return false
      if (!entriesRef.current.has(id)) return false
      setActive(id)
      return true
    },
    [setActive],
  )

  /** Visible, enabled entries with a real box on screen. */
  const visibleEntries = useCallback(() => {
    const out = []
    for (const entry of entriesRef.current.values()) {
      const el = entry.el
      if (!el || !el.isConnected) continue
      if (entry.disabled) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      out.push({ id: entry.id, el, rect, group: entry.group, scope: entry.scope })
    }
    return out
  }, [])

  /**
   * Register a focusable. The cleanup re-places focus when the focused element
   * is removed from the DOM (a chip was deleted, a row was replaced by its
   * results) so the user is never left without a focus ring. A plain
   * re-registration of an element that is still connected is left alone.
   */
  const register = useCallback(
    (entry) => {
      entriesRef.current.set(entry.id, entry)
      setRegistryVersion((v) => v + 1)
      notifyRegistry()

      return () => {
        entriesRef.current.delete(entry.id)
        if (activeIdRef.current === entry.id && !entry.el?.isConnected) {
          const first = visibleEntries()[0]
          if (first) setActive(first.id)
        }
        setRegistryVersion((v) => v + 1)
        notifyRegistry()
      }
    },
    [notifyRegistry, setActive, visibleEntries],
  )

  const moveFocus = useCallback(
    (direction) => {
      const entries = visibleEntries()
      if (entries.length === 0) return

      const currentId = getActiveId()
      const current = entries.find((e) => e.id === currentId)
      if (!current) {
        setActive(entries[0].id)
        return
      }

      const next = findNextCandidate(
        current.rect,
        entries.filter((e) => e.id !== currentId),
        direction,
      )
      if (next) setActive(next.id)
    },
    [getActiveId, setActive, visibleEntries],
  )

  // Arrow + select handling. Capture phase so we win over the WebView.
  useEffect(() => {
    const onKeyDown = (event) => {
      const action = resolveAction(event)
      if (!action) return

      const active = entriesRef.current.get(activeIdRef.current)

      // In a text field Left/Right belong to the caret, not to spatial
      // navigation. Up/Down still move focus out of the field, which is the
      // only way to leave it with a remote once the soft keyboard is closed.
      if (active?.editable && (action === 'left' || action === 'right')) return

      if (action === 'left' || action === 'up' || action === 'right' || action === 'down') {
        event.preventDefault()
        moveFocus(action)
        return
      }

      if (action === 'enter') {
        const entry = entriesRef.current.get(activeIdRef.current)
        if (entry && entry.onSelect) {
          // Stop the browser from also firing a click on a native <button>.
          event.preventDefault()
          entry.onSelect(event)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [moveFocus])

  // Apply focus to the DOM whenever the active element or registry changes.
  useEffect(() => {
    for (const entry of entriesRef.current.values()) {
      const el = entry.el
      if (!el || !el.isConnected) continue
      const isActive = entry.id === activeId
      if (isActive) {
        el.setAttribute('data-focus-active', 'true')
        if (document.activeElement !== el) el.focus({ preventScroll: true })
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      } else if (el.getAttribute('data-focus-active')) {
        el.removeAttribute('data-focus-active')
      }
    }
  }, [activeId, registryVersion])

  // Keep the engine in sync when a registered element is focused natively
  // (mouse click or Tab). Without this the engine would still believe the
  // previous element is active and route Select to it.
  useEffect(() => {
    const onFocusIn = (event) => {
      const el = event.target
      const id = el && typeof el.getAttribute === 'function' ? el.getAttribute('data-focus-id') : null
      if (id && entriesRef.current.has(id) && id !== activeIdRef.current) {
        setActive(id)
      }
    }
    window.addEventListener('focusin', onFocusIn)
    return () => window.removeEventListener('focusin', onFocusIn)
  }, [setActive])

  const value = useMemo(
    () => ({
      register,
      getEntries,
      getActiveId,
      focusId,
      visibleEntries,
      subscribeRegistry,
    }),
    [register, getEntries, getActiveId, focusId, visibleEntries, subscribeRegistry],
  )

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
}
