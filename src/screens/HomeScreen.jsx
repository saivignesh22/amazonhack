import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '../app/routerContext.js'
import { useServices } from '../services/ServicesContext.js'
import { FocusScope } from '../tv/focus/FocusScope.jsx'
import { RecipeTile } from '../components/RecipeTile.jsx'
import { AppHeader } from '../components/AppHeader.jsx'

function Row({ title, hint, recipes, onOpen, tileSize = 'large', rowId }) {
  if (!recipes || recipes.length === 0) return null
  return (
    <section className="row">
      <div className="row__head">
        <h2 className="row__title">{title}</h2>
        {hint ? <span className="row__hint">{hint}</span> : null}
      </div>
      <div className="row__track scroll-x">
        {recipes.map((recipe) => (
          <RecipeTile
            key={recipe.id}
            recipe={recipe}
            rowId={rowId}
            size={tileSize}
            onSelect={() => onOpen(recipe)}
          />
        ))}
      </div>
    </section>
  )
}

export default function HomeScreen({ restoreFocusId }) {
  const { recipes: recipeService } = useServices()
  const { navigate } = useRouter()
  const [recipes, setRecipes] = useState([])
  const [recommendations, setRecommendations] = useState([])

  useEffect(() => {
    let alive = true
    Promise.all([recipeService.listRecipes(), recipeService.getRecommendations()]).then(
      ([all, picks]) => {
        if (!alive) return
        setRecipes(all)
        setRecommendations(picks)
      },
    )
    return () => {
      alive = false
    }
  }, [recipeService])

  const quick = useMemo(
    () => recipes.filter((recipe) => recipe.totalMinutes <= 30).slice(0, 6),
    [recipes],
  )

  const pantryPicks = useMemo(
    () =>
      recipes
        .filter((recipe) =>
          recipe.ingredients.some((ingredient) =>
            ['olive oil', 'garlic', 'tomato'].includes(ingredient.pantryKey),
          ),
        )
        .slice(0, 6),
    [recipes],
  )

  const openRecipe = (recipe) => navigate('details', { id: recipe.id })

  return (
    <FocusScope initialFocusId={restoreFocusId}>
      <div className="screen">
        <AppHeader />
        <div className="screen__body scroll-y">
          <div className="hero">
            <p className="hero__eyebrow">Tonight</p>
            <h1 className="hero__title">What are we cooking?</h1>
            <p className="hero__sub">
              Pick a recipe, tell us what is in the kitchen, and we will guide you through every
              step.
            </p>
          </div>

          <Row
            title="Recommended for you"
            hint="Based on what you have"
            recipes={recommendations.slice(0, 4)}
            rowId="picks"
            onOpen={openRecipe}
          />

          <Row
            title="On the table in 30 minutes"
            hint="Quick wins"
            recipes={quick}
            rowId="quick"
            tileSize="small"
            onOpen={openRecipe}
          />

          <Row
            title="Because you have olive oil, garlic and tomatoes"
            hint="Uses what is in your kitchen"
            recipes={pantryPicks}
            rowId="pantry"
            tileSize="small"
            onOpen={openRecipe}
          />

          <footer className="home-foot">
            <span className="home-foot__hint">
              Use the D-pad to move, Select to open, Back to go back.
            </span>
          </footer>
        </div>
      </div>
    </FocusScope>
  )
}
