import { useEffect, useState } from 'react'
import { useRouter } from '../app/routerContext.js'
import { useServices } from '../services/ServicesContext.js'
import { resetCookingSession } from '../app/cookingState.js'
import { imageFor } from '../services/recipeImages.js'
import { FocusScope } from '../tv/focus/FocusScope.jsx'
import { AppHeader } from '../components/AppHeader.jsx'
import { Button } from '../components/Button.jsx'

export default function CompletionScreen({ params, restoreFocusId }) {
  const { recipes: recipeService, history } = useServices()
  const { navigate, reset } = useRouter()
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

  // The only place a recipe is marked as cooked. Browsing a recipe (details,
  // ingredients, cooking) never records anything; finishing the last step
  // lands here and this effect writes the history entry.
  useEffect(() => {
    if (!recipe) return
    history.record({
      id: recipe.id,
      title: recipe.title,
      image: recipe.image || imageFor(recipe.id),
    })
  }, [history, recipe])

  if (!recipe) {
    return (
      <div className="screen">
        <AppHeader />
        <div className="screen__body">
          <p className="muted">Plating up…</p>
        </div>
      </div>
    )
  }

  return (
    <FocusScope
      initialFocusId={restoreFocusId}
      defaultFocusId={`done-home-${recipe.id}`}
    >
      <div className="screen screen--done">
        <AppHeader />
        <div className="screen__body done">
          <div
            className="done__hero"
            style={{ '--tile-from': recipe.art.from, '--tile-to': recipe.art.to }}
          >
            <span className="done__check" aria-hidden="true">
              ✓
            </span>
            <h1 className="done__title">Dinner is ready</h1>
            <p className="done__subtitle">
              {recipe.title}
              {recipe.servings ? ` — served for ${recipe.servings}.` : ' — served hot.'}
            </p>

            <div className="done__stats">
              <Stat
                label="Time in the kitchen"
                value={recipe.totalMinutes ? `${recipe.totalMinutes} min` : 'Not listed'}
              />
              <Stat label="Steps completed" value={recipe.steps.length} />
              <Stat label="Ingredients used" value={recipe.ingredients.length} />
              <Stat label="Difficulty" value={recipe.difficulty || 'Not listed'} />
            </div>

            <div className="done__actions">
              <Button id={`done-home-${recipe.id}`} variant="primary" onSelect={() => reset('home')}>
                Back to home
              </Button>
              <Button
                id={`done-again-${recipe.id}`}
                onSelect={() => {
                  resetCookingSession(recipe.id)
                  navigate('cooking', { id: recipe.id })
                }}
              >
                Cook it again
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
    <div className="stat stat--done">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}
