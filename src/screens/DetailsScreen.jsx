
import { useEffect, useState } from 'react'
import { useRouter } from '../app/routerContext.js'
import { useServices } from '../services/ServicesContext.js'
import { FocusScope } from '../tv/focus/FocusScope.jsx'
import { AppHeader } from '../components/AppHeader.jsx'
import { Button } from '../components/Button.jsx'

export default function DetailsScreen({ params, restoreFocusId }) {
  const { recipes: recipeService } = useServices()
  const { navigate } = useRouter()
  const [recipe, setRecipe] = useState(null)

  useEffect(() => {
    let alive = true
    recipeService.getRecipe(params.id).then((result) => {
      if (alive) setRecipe(result)
    })
    return () => {
      alive = false
    }
  }, [recipeService, params.id])

  if (!recipe) {
    return (
      <div className="screen">
        <AppHeader />
        <div className="screen__body">
          <p className="muted">Loading recipe…</p>
        </div>
      </div>
    )
  }

  const ingredients = recipe.ingredients || []
  const useTwoColumns = ingredients.length > 9

  return (
    <FocusScope
      initialFocusId={restoreFocusId}
      defaultFocusId={`details-start-${recipe.id}`}
    >
      <div className="screen screen--details">
        <AppHeader />

        <div className="screen__body details details--ingredients">
          <div className="details__body">
            <section className="panel details__ingredients-panel">
              <h2 className="panel__title">
                What you will need ({ingredients.length})
              </h2>

              <ul
                className={`ingredient-preview ${
                  useTwoColumns
                    ? 'ingredient-preview--two-columns'
                    : 'ingredient-preview--one-column'
                }`}
              >
                {ingredients.map((ingredient) => (
                  <li
                    className="ingredient-preview__row"
                    key={ingredient.id}
                  >
                    <span className="ingredient-preview__name">
                      {ingredient.name}
                    </span>
                    <span className="ingredient-preview__amount">
                      {ingredient.amount}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="details__actions">
              <Button
                id={`details-start-${recipe.id}`}
                variant="primary"
                onSelect={() => navigate('cooking', { id: recipe.id })}
              >
                Start cooking
              </Button>

              <Button
                id={`details-check-${recipe.id}`}
                onSelect={() => navigate('ingredients', { id: recipe.id })}
              >
                Check my kitchen
              </Button>

              <Button
                id={`details-back-${recipe.id}`}
                onSelect={() => navigate('home')}
              >
                Back to home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </FocusScope>
  )
}
