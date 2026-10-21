import { useFocusable } from '../tv/focus/useFocusable.js'

/**
 * A recipe tile used in the home rows.
 */
export function RecipeTile({ recipe, rowId = 'main', onSelect, size = 'large' }) {
  const { focusableProps } = useFocusable({ id: `home-tile-${rowId}-${recipe.id}`, onSelect })

  return (
    <button
      type="button"
      className={`tile tile--${size}`}
      style={{ '--tile-from': recipe.art.from, '--tile-to': recipe.art.to }}
      {...focusableProps}
    >
      <span className="tile__art" aria-hidden="true">
        <span className={`tile__motif tile__motif--${recipe.motif}`} />
      </span>
      <span className="tile__body">
        <span className="tile__title">{recipe.title}</span>
        <span className="tile__meta">
          <span className="tile__meta-item">{recipe.totalMinutes} min</span>
          <span className="tile__dot" />
          <span className="tile__meta-item">{recipe.difficulty}</span>
          <span className="tile__dot" />
          <span className="tile__meta-item">{recipe.servings} servings</span>
        </span>
        <span className="tile__tags">
          {recipe.tags.slice(0, 2).map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </span>
      </span>
    </button>
  )
}
