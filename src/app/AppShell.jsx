import { useRouter } from './routerContext.js'
import { SCREENS } from './screens.js'

export function AppShell() {
  const { current } = useRouter()
  const Screen = SCREENS[current.screen] || SCREENS.home

  return (
    // key forces a fresh mount per route so each screen applies its own
    // focus scope and restores the item the user left behind.
    <div className="app" key={current.key}>
      <Screen params={current.params} restoreFocusId={current.focusId} />
    </div>
  )
}
