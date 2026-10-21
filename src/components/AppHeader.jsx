import { DATA_SOURCE_LABEL } from '../services/servicesRegistry.js'

export function AppHeader({ right }) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">CookCue</span>
        <span className="brand-tag">cook along</span>
      </div>
      <div className="app-header__right">
        <span className="pill pill--muted" title="The app currently runs on bundled sample data">
          {DATA_SOURCE_LABEL}
        </span>
        {right}
      </div>
    </header>
  )
}
