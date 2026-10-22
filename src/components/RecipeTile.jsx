import { useFocusable } from '../tv/focus/useFocusable.js'
import { formatRecipeTime } from '../utils/recipeTime.js'
import { TileArt } from './TileArt.jsx'

/**
 * A recipe tile used in the home rows.
 *
 * Meta fields are optional in the contract: TheMealDB does not publish
 * difficulty or servings, so those chips simply do not render rather than
 * showing "undefined".
 */
export function RecipeTile({ recipe, rowId = 'main', onSelect, size = 'large' }) {
  const { focusableProps } = useFocusable({ id: `home-tile-${rowId}-${recipe.id}`, onSelect })

  const meta = []
  const time = formatRecipeTime(recipe)
  if (time) meta.push(time)
  else if (recipe.steps?.length) meta.push(`${recipe.steps.length} steps`)
  if (recipe.difficulty) meta.push(recipe.difficulty)
  if (recipe.servings) meta.push(`Serves ${recipe.servings}`)

  const tags = (recipe.tags || []).slice(0, 2)

  return (
    <button
      type="button"
      className={`tile tile--${size}`}
      style={{ '--tile-from': recipe.art?.from, '--tile-to': recipe.art?.to }}
      {...focusableProps}
    >
      <TileArt recipe={recipe} />
      <span className="tile__body">
        <span className="tile__title">{recipe.title}</span>
        {meta.length > 0 ? (
          <span className="tile__meta">
            {meta.map((item, index) => (
              <span className="tile__meta-group" key={item}>
                {index > 0 ? <span className="tile__dot" /> : null}
                <span className="tile__meta-item">{item}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="tile__meta">
            <span className="tile__meta-item">{recipe.subtitle}</span>
          </span>
        )}
        {tags.length > 0 ? (
          <span className="tile__tags">
            {tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </button>
  )
}
