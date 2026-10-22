import { useFocusable } from '../tv/focus/useFocusable.js'
import { formatRecipeTime } from '../utils/recipeTime.js'
import { TileArt } from './TileArt.jsx'

/**
 * A recommendation card: the photo, the dish, what it costs in time, and -
 * the point of the ingredient search - exactly which ingredients the user
 * already has and which are missing.
 *
 * The whole card is the action (a single D-pad stop per recipe) with a
 * "View recipe" affordance rather than a nested button, which would be both
 * invalid HTML and an extra focus stop on a remote.
 */
export function RecipeCard({ recipe, match, onSelect }) {
  const { focusableProps } = useFocusable({ id: `home-result-${recipe.id}`, onSelect })

  const missing = match?.missing || []
  const total = recipe.ingredients.length
  const have = Math.max(total - missing.length, 0)
  const score = Math.round(match?.score || 0)

  const meta = []
  const time = formatRecipeTime(recipe)
  if (time) meta.push(time)
  else if (recipe.steps?.length) meta.push(`${recipe.steps.length} steps`)
  if (recipe.difficulty) meta.push(recipe.difficulty)

  return (
    <button type="button" className="tile tile--card" {...focusableProps}>
      <span className="tile__art-wrap">
        <TileArt recipe={recipe} />
        <span className="match-badge">{score}% match</span>
      </span>
      <span className="tile__body">
        <span className="tile__title">{recipe.title}</span>
        <span className="tile__desc">{recipe.subtitle}</span>

        {meta.length > 0 ? (
          <span className="tile__meta">
            {meta.map((item, index) => (
              <span className="tile__meta-group" key={item}>
                {index > 0 ? <span className="tile__dot" /> : null}
                <span className="tile__meta-item">{item}</span>
              </span>
            ))}
          </span>
        ) : null}

        <span className="tile__kitchen">
          <span className="tile__kitchen-count">
            You have {have} of {total}
          </span>
          {missing.length === 0 ? (
            <span className="tile__ready">Everything you need</span>
          ) : (
            <span className="tile__missing">
              Needs: {missing.slice(0, 3).join(', ')}
              {missing.length > 3 ? ` +${missing.length - 3} more` : ''}
            </span>
          )}
        </span>

        <span className="tile__cta">View recipe ›</span>
      </span>
    </button>
  )
}
