import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '../app/routerContext.js'
import { useKitchen } from '../app/useKitchen.js'
import { useServices } from '../services/ServicesContext.js'
import { FocusScope } from '../tv/focus/FocusScope.jsx'
import { AppHeader } from '../components/AppHeader.jsx'
import { Button } from '../components/Button.jsx'
import { IngredientRow } from '../components/IngredientRow.jsx'

export default function IngredientsScreen({ params, restoreFocusId }) {
  const { recipes: recipeService } = useServices()
  const { navigate } = useRouter()
  const { ingredients: kitchenIngredients } = useKitchen()
  const [recipe, setRecipe] = useState(null)
  const [report, setReport] = useState(null)
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    let alive = true
    Promise.all([
      recipeService.getRecipe(params.id),
      recipeService.matchIngredients(params.id, kitchenIngredients),
    ]).then(([loadedRecipe, loadedReport]) => {
      if (!alive) return
      setRecipe(loadedRecipe)
      setReport(loadedReport)
    })
    return () => {
      alive = false
    }
  }, [recipeService, params.id, kitchenIngredients])

  const items = useMemo(() => {
    if (!report) return []
    return report.items.map((item) => ({
      ...item,
      status: overrides[item.id] || item.status,
      substitution: overrides[item.id] === 'have' ? null : item.substitution,
    }))
  }, [report, overrides])

  const haveCount = items.filter((item) => item.status === 'have').length
  const missingCount = items.length - haveCount
  const ratio = items.length ? haveCount / items.length : 0

  const toggle = (id) => {
    setOverrides((previous) => {
      const current = previous[id]
      if (!current) {
        const found = items.find((item) => item.id === id)
        return { ...previous, [id]: found && found.status === 'have' ? 'missing' : 'have' }
      }
      const next = { ...previous }
      delete next[id]
      return next
    })
  }

  if (!recipe || !report) {
    return (
      <div className="screen">
        <AppHeader />
        <div className="screen__body">
          <p className="muted">Checking your kitchen…</p>
        </div>
      </div>
    )
  }

  return (
    <FocusScope
      initialFocusId={restoreFocusId}
      defaultFocusId={`ing-${recipe.id}-${items[0] ? items[0].id : ''}`}
    >
      <div className="screen">
        <AppHeader />
        <div className="screen__body ingredients">
          <div className="ingredients__list scroll-y">
            <h1 className="ingredients__title">What do you have?</h1>
            <p className="ingredients__hint">
              {recipe.title} — press Select on an item to say you have it anyway.
            </p>

            <ul className="ing-list">
              {items.map((item) => {
                const have = item.status === 'have'
                return (
                  <li key={item.id}>
                    <IngredientRow
                      id={`ing-${recipe.id}-${item.id}`}
                      name={item.name}
                      amount={item.amount}
                      have={have}
                      substitution={item.substitution}
                      onToggle={() => toggle(item.id)}
                    />
                  </li>
                )
              })}
            </ul>
          </div>

          <aside className="ingredients__side">
            <div className="panel panel--summary">
              <p className="summary__count">
                <span className="summary__have">{haveCount}</span>
                <span className="summary__of"> of {items.length}</span>
              </p>
              <p className="summary__label">ingredients in your kitchen</p>
              <div className="meter" aria-hidden="true">
                <div className="meter__fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
              </div>
              <p className="summary__missing">
                {missingCount === 0
                  ? 'You have everything. Let us cook.'
                  : `${missingCount} to pick up — swaps are suggested below each item.`}
              </p>
            </div>

            <div className="ingredients__actions">
              <Button
                id={`ing-start-${recipe.id}`}
                variant="primary"
                onSelect={() => navigate('cooking', { id: recipe.id })}
              >
                Start cooking
              </Button>
              <Button
                id={`ing-back-${recipe.id}`}
                onSelect={() => navigate('details', { id: recipe.id })}
              >
                Back to recipe
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </FocusScope>
  )
}
