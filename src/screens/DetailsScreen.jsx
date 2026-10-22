import { useEffect, useState } from 'react'
import { useRouter } from '../app/routerContext.js'
import { useServices } from '../services/ServicesContext.js'
import { FocusScope } from '../tv/focus/FocusScope.jsx'
import { formatRecipeTime } from '../utils/recipeTime.js'
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

  return (
    <FocusScope initialFocusId={restoreFocusId} defaultFocusId={`details-start-${recipe.id}`}>
      <div className="screen">
        <AppHeader />
        <div className="screen__body details">
          <div
            className="details__hero"
            style={{ '--tile-from': recipe.art.from, '--tile-to': recipe.art.to }}
          >
            <span className={`details__motif details__motif--${recipe.motif}`} aria-hidden="true" />
            <div className="details__hero-text">
              <p className="details__cuisine">{recipe.cuisine}</p>
              <h1 className="details__title">{recipe.title}</h1>
              <p className="details__subtitle">{recipe.subtitle}</p>
              <div className="details__tags">
                {recipe.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="details__body">
            <div className="details__stats">
              <Stat
                label="Time"
                value={formatRecipeTime(recipe) || 'Not listed'}
              />
              <Stat label="Serves" value={recipe.servings || 'Not listed'} />
              <Stat label="Difficulty" value={recipe.difficulty || 'Not listed'} />
              <Stat
                label="Per serving"
                value={recipe.calories ? `${recipe.calories} kcal` : 'Not listed'}
              />
            </div>

            {recipe.timeEstimated ? (
              <p className="details__note">
                Time is estimated from the timers in the steps; TheMealDB does not
                publish a total time.
              </p>
            ) : null}

            <div className="details__columns">
              <div className="panel">
                <h3 className="panel__title">What you will need</h3>
                <ul className="ingredient-preview">
                  {recipe.ingredients.map((ingredient) => (
                    <li className="ingredient-preview__row" key={ingredient.id}>
                      <span className="ingredient-preview__name">{ingredient.name}</span>
                      <span className="ingredient-preview__amount">{ingredient.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel">
                <h3 className="panel__title">The plan</h3>
                <ol className="step-preview">
                  {recipe.steps.map((step, index) => (
                    <li className="step-preview__row" key={step.id}>
                      <span className="step-preview__index">{index + 1}</span>
                      <span className="step-preview__title">{step.title}</span>
                      {step.minutes ? (
                        <span className="step-preview__time">{step.minutes} min</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

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
              <Button id={`details-back-${recipe.id}`} onSelect={() => navigate('home')}>
                Back to home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </FocusScope>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}
