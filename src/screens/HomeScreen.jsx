import { useEffect, useMemo, useState } from 'react'
import { useKitchen } from '../app/useKitchen.js'
import { setSearched } from '../app/kitchenState.js'
import { useRouter } from '../app/routerContext.js'
import { useServices } from '../services/ServicesContext.js'
import { FocusScope } from '../tv/focus/FocusScope.jsx'
import { AppHeader } from '../components/AppHeader.jsx'
import { CookingHistoryPanel } from '../components/CookingHistoryPanel.jsx'
import { DishSearch } from '../components/DishSearch.jsx'
import { IngredientInput } from '../components/IngredientInput.jsx'
import { RecipeCard } from '../components/RecipeCard.jsx'
import { RecipeTile } from '../components/RecipeTile.jsx'

const PASTA_TITLE = /pasta|spaghetti|noodle|lasagne|linguine|macaroni|penne|rigatoni|tagliatelle/i

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
  const { ingredients, searched } = useKitchen()

  const [catalogue, setCatalogue] = useState([])
  const [picks, setPicks] = useState([])
  const [result, setResult] = useState(null)

  const requestKey = ingredients.join('|')
  // Derived, not stored: the moment the kitchen changes, the previous ranking
  // is stale and we show the loading line until the matching result arrives.
  const loading = searched && ingredients.length > 0 && result?.key !== requestKey

  useEffect(() => {
    let alive = true
    Promise.all([recipeService.listRecipes(), recipeService.getRecommendations()]).then(
      ([all, recommended]) => {
        if (!alive) return
        setCatalogue(all)
        setPicks(recommended)
      },
    )
    return () => {
      alive = false
    }
  }, [recipeService])

  // Re-rank whenever the kitchen changes after the first "Find recipes", so
  // removing a chip immediately updates what the user can cook.
  useEffect(() => {
    if (!searched || ingredients.length === 0) return undefined
    let alive = true
    recipeService.recommendByIngredients(ingredients).then((next) => {
      if (!alive) return
      setResult({ ...next, key: ingredients.join('|') })
    })
    return () => {
      alive = false
    }
  }, [recipeService, searched, ingredients])

  const pasta = useMemo(
    () => catalogue.filter((recipe) => PASTA_TITLE.test(recipe.title)).slice(0, 8),
    [catalogue],
  )

  const openRecipe = (recipe) => navigate('details', { id: recipe.id })

  return (
    <FocusScope initialFocusId={restoreFocusId} defaultFocusId="home-ingredient-input">
      <div className="screen">
        <AppHeader />
        <div className="screen__body scroll-y">
          <IngredientInput onFind={() => setSearched(true)} />

          {searched ? (
            <Recommendations
              result={result}
              loading={loading}
              ingredients={ingredients}
              onOpen={openRecipe}
            />
          ) : null}

          <DishSearch />

          <Row
            title="Quick dinners"
            hint="Under 45 minutes"
            recipes={picks.slice(0, 8)}
            rowId="picks"
            onOpen={openRecipe}
          />

          <Row
            title="Pasta night"
            hint="Twirl something together"
            recipes={pasta}
            rowId="pasta"
            tileSize="small"
            onOpen={openRecipe}
          />

          <CookingHistoryPanel onOpen={(entry) => navigate('details', { id: entry.id })} />

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

function Recommendations({ result, loading, ingredients, onOpen }) {
  const matches = result?.matches || []
  const alternatives = result?.alternatives || []
  const total = result?.total || 0

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="row__head">
        <h2 className="row__title" id="results-title">
          Recipes you can make
        </h2>
        <span className="row__hint">Using {ingredients.join(', ')}</span>
      </div>

      {loading ? <p className="results__status">Looking through the recipes…</p> : null}

      {!loading && matches.length > 0 ? (
        <>
          <p className="results__count">
            {matches.length} recipe{matches.length === 1 ? '' : 's'} ranked by how much of your
            kitchen {matches.length === 1 ? 'it uses' : 'they use'}.
          </p>

          {matches.length < 6 ? (
            <p className="results__note">
              Only {matches.length} of {total} recipes come close with these ingredients — the rest
              need more than you have right now. Adding one more ingredient usually opens things up.
            </p>
          ) : null}

          <div className="row__track scroll-x">
            {matches.map(({ recipe, score, missing }) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                match={{ score, missing }}
                onSelect={() => onOpen(recipe)}
              />
            ))}
          </div>
        </>
      ) : null}

      {!loading && matches.length === 0 ? (
        <div className="results__empty">
          <p className="results__empty-title">
            No exact matches yet. Try adding another ingredient or explore these alternative
            recipes.
          </p>
          {alternatives.length > 0 ? (
            <div className="row__track scroll-x">
              {alternatives.map((recipe) => (
                <RecipeTile
                  key={recipe.id}
                  recipe={recipe}
                  rowId="alternative"
                  size="small"
                  onSelect={() => onOpen(recipe)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
