import { useFocusable } from '../tv/focus/useFocusable.js'

/**
 * One ingredient row on the "what do you have?" screen.
 *
 * The row is focusable, and pressing Select toggles it between "in your
 * kitchen" and "missing".
 */
export function IngredientRow({ id, name, amount, have, substitution, onToggle }) {
  const { focusableProps } = useFocusable({ id, onSelect: onToggle })

  return (
    <button type="button" className={`ing-row ing-row--${have ? 'have' : 'missing'}`} {...focusableProps}>
      <span className="ing-row__mark" aria-hidden="true">
        {have ? '✓' : '○'}
      </span>
      <span className="ing-row__text">
        <span className="ing-row__name">{name}</span>
        <span className="ing-row__amount">{amount}</span>
        {!have && substitution ? (
          <span className="ing-row__sub">
            Use {substitution.name} — {substitution.note}
          </span>
        ) : null}
      </span>
      <span className={`badge badge--${have ? 'have' : 'missing'}`}>
        {have ? 'In your kitchen' : 'Missing'}
      </span>
    </button>
  )
}
