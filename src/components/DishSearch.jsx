import { useEffect, useState } from 'react'
import { useRouter } from '../app/routerContext.js'
import { useKitchen } from '../app/useKitchen.js'
import { useServices } from '../services/ServicesContext.js'
import { useFocusable } from '../tv/focus/useFocusable.js'
import { Button } from './Button.jsx'

/**
 * "Have a particular recipe in mind?" - search by dish name, then compare the
 * result against the ingredients already in the kitchen.
 *
 * When the dish is not in the catalogue we say so and offer the closest
 * matches instead of making something up. The ingredient list above is never
 * touched by this component, so a failed search cannot cost the user their
 * pantry.
 */
export function DishSearch() {
  const { recipes: recipeService } = useServices()
  const { navigate } = useRouter()
  const { ingredients } = useKitchen()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [outcome, setOutcome] = useState(null)

  const { focusableProps, ref } = useFocusable({
    id: 'home-dish-input',
    editable: true,
    onSelect: () => {
      if (query.trim()) runSearch()
      else ref.current?.click()
    },
  })

  const foundId = outcome?.type === 'found' ? outcome.recipe.id : null

  // If the kitchen changes while a dish is on screen, re-check it instead of
  // showing a stale have/missing report.
  useEffect(() => {
    if (!foundId) return undefined
    let alive = true
    recipeService.matchIngredients(foundId, ingredients).then((report) => {
      if (!alive) return
      setOutcome((previous) =>
        previous && previous.type === 'found' ? { ...previous, report } : previous,
      )
    })
    return () => {
      alive = false
    }
  }, [foundId, ingredients, recipeService])

  async function runSearch() {
    const text = query.trim()
    if (!text) return

    setLoading(true)
    try {
      const found = await recipeService.searchRecipes(text)
      const best = found.results[0]

      if (best && best.score >= 60) {
        const report = await recipeService.matchIngredients(best.recipe.id, ingredients)
        setOutcome({
          type: 'found',
          recipe: best.recipe,
          report,
          source: found.source,
        })
      } else {
        const suggestions =
          found.results.length > 0
            ? found.results.slice(0, 3).map((result) => result.recipe)
            : (await recipeService.getRecommendations()).slice(0, 3)
        setOutcome({ type: 'none', query: text, suggestions })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="dish" aria-labelledby="dish-title">
      <div className="row__head">
        <h2 className="row__title" id="dish-title">
          Have a particular recipe in mind?
        </h2>
        <span className="row__hint">We will check it against your kitchen</span>
      </div>

      <div className="ing-input dish__input">
        <input
          {...focusableProps}
          className="ing-input__field"
          type="text"
          value={query}
          placeholder="Try “chicken curry” or “pancakes”"
          aria-label="Search for a recipe by name"
          autoComplete="off"
          spellCheck="false"
          onChange={(event) => setQuery(event.target.value)}
          onClick={() => ref.current?.focus()}
        />
        <Button
          id="home-dish-search"
          onSelect={runSearch}
          disabled={!query.trim()}
        >
          Find dish
        </Button>
      </div>

      {loading ? <p className="dish__status">Looking for {query.trim()}…</p> : null}

      {outcome?.type === 'found' ? (
        <FoundPanel
          recipe={outcome.recipe}
          report={outcome.report}
          source={outcome.source}
          hasKitchen={ingredients.length > 0}
          onOpen={() => navigate('details', { id: outcome.recipe.id })}
          onClear={() => {
            setOutcome(null)
            setQuery('')
          }}
        />
      ) : null}

      {outcome?.type === 'none' ? (
        <div className="dish__panel">
          <p className="dish__note">
            We couldn&rsquo;t find &ldquo;{outcome.query}&rdquo; in our recipes. Try one of these
            instead — your ingredients are still in your kitchen.
          </p>
          <SuggestionList suggestions={outcome.suggestions} onOpen={(recipe) => navigate('details', { id: recipe.id })} />
          <div className="dish__actions">
            <Button
              id="home-dish-clear-none"
              onSelect={() => {
                setOutcome(null)
                setQuery('')
              }}
            >
              Clear search
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function FoundPanel({ recipe, report, source, hasKitchen, onOpen, onClear }) {
  const items = report?.items || []
  const have = items.filter((item) => item.status === 'have')
  const missing = items.filter((item) => item.status === 'missing')

  return (
    <div className="dish__panel">
      <div className="dish__panel-head">
        <div className="dish__panel-title">
          <h3 className="dish__name">{recipe.title}</h3>
          <p className="dish__meta">
            {[recipe.cuisine, recipe.totalMinutes ? `${recipe.totalMinutes} min` : null]
              .filter(Boolean)
              .join(' · ')}
            {source === 'live' ? ' · found in the live TheMealDB catalogue' : ''}
          </p>
          <span
            className={`badge ${report && report.missingCount === 0 ? 'badge--have' : 'badge--missing'}`}
          >
            {report ? `${report.haveCount} of ${report.totalCount} in your kitchen` : 'Not checked yet'}
          </span>
        </div>

        <div className="dish__panel-actions">
          <Button id="home-dish-open" variant="primary" onSelect={onOpen}>
            Open recipe
          </Button>
          <Button id="home-dish-clear" onSelect={onClear}>
            Clear search
          </Button>
        </div>
      </div>

      {!hasKitchen ? (
        <p className="dish__note">
          Add ingredients above and we will tick off what this recipe needs.
        </p>
      ) : null}

      <div className="dish__columns">
        <div>
          <h4 className="dish__col-title">
            You have <span className="dish__col-count">{have.length}</span>
          </h4>
          {have.length > 0 ? (
            <ul className="dish__list">
              {have.map((item) => (
                <li className="dish__item dish__item--have" key={item.id}>
                  <span className="dish__tick" aria-hidden="true">
                    ✓
                  </span>
                  <span className="dish__item-name">{item.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dish__note">Nothing from this recipe yet.</p>
          )}
        </div>

        <div>
          <h4 className="dish__col-title">
            You need <span className="dish__col-count">{missing.length}</span>
          </h4>
          {missing.length > 0 ? (
            <ul className="dish__list">
              {missing.map((item) => (
                <li className="dish__item dish__item--missing" key={item.id}>
                  <span className="dish__tick" aria-hidden="true">
                    ×
                  </span>
                  <span className="dish__item-text">
                    <span className="dish__item-name">
                      {item.name}
                      {item.amount ? <span className="dish__amount"> · {item.amount}</span> : null}
                    </span>
                    {item.substitution ? (
                      <span className="dish__sub">
                        Swap: {item.substitution.name} — {item.substitution.note}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dish__note">Nothing missing. Let us cook.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SuggestionList({ suggestions, onOpen }) {
  if (!suggestions || suggestions.length === 0) return null
  return (
    <ul className="dish__suggestions">
      {suggestions.map((recipe) => (
        <li key={recipe.id}>
          <Suggestion recipe={recipe} onSelect={() => onOpen(recipe)} />
        </li>
      ))}
    </ul>
  )
}

function Suggestion({ recipe, onSelect }) {
  const { focusableProps } = useFocusable({
    id: `home-dish-suggest-${recipe.id}`,
    onSelect,
  })

  return (
    <button type="button" className="dish__suggestion" {...focusableProps}>
      <span className="dish__suggestion-title">{recipe.title}</span>
      <span className="dish__suggestion-meta">
        {[recipe.cuisine, recipe.totalMinutes ? `${recipe.totalMinutes} min` : null]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </button>
  )
}
