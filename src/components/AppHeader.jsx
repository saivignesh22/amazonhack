import { useServices } from '../services/ServicesContext.js'

/**
 * App chrome. The pill shows which recipe source is live, because the app can
 * run on TheMealDB, the team's recipe engine or bundled sample data depending
 * on the one switch in src/services/servicesRegistry.js.
 */
export function AppHeader({ right }) {
  const { recipes } = useServices()
  const label = recipes?.dataSourceLabel || 'Sample data'

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">CookCue</span>
        <span className="brand-tag">cook along</span>
      </div>
      <div className="app-header__right">
        <span className="pill pill--muted" title={`Recipes from ${label}`}>
          {label}
        </span>
        {right}
      </div>
    </header>
  )
}
