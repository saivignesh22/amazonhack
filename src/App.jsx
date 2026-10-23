import { useEffect } from 'react'
import { ServicesProvider } from './services/ServicesProvider.jsx'
import { FocusProvider } from './tv/focus/FocusProvider.jsx'
import { RouterProvider } from './app/router.jsx'
import { AppShell } from './app/AppShell.jsx'
import { requestBack } from './tv/back.js'
import { resolveAction } from './tv/keys.js'

export default function App() {
  // Bridge for the Fire OS wrapper: the native side intercepts the Android
  // Back button and calls window.cookcue.handleBack().
  useEffect(() => {
    window.cookcue = {
      handleBack: () => requestBack(),
      closeApp: () => window.AndroidHost?.closeApp?.(),
    }
    return () => {
      delete window.cookcue
    }
  }, [])

  // In a desktop browser the Escape key stands in for the remote Back key.
  useEffect(() => {
    const onKeyDown = (event) => {
      // keys.js maps Backspace to Back for the remote's convenience, but in a
      // text field Backspace is Delete and must never navigate.
      const target = event.target
      const editing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (editing && event.key === 'Backspace') return

      if (resolveAction(event) === 'back') {
        const handled = requestBack()
        if (handled) event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <ServicesProvider>
      <FocusProvider>
        <RouterProvider>
          <AppShell />
        </RouterProvider>
      </FocusProvider>
    </ServicesProvider>
  )
}
