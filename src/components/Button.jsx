import { useFocusable } from '../tv/focus/useFocusable.js'

/**
 * TV button. Focus is driven by the focus engine, so the button is styled
 * from the `data-focus-active` attribute rather than :hover.
 */
export function Button({
  id,
  children,
  onSelect,
  variant = 'ghost',
  icon,
  hint,
  disabled = false,
  className = '',
}) {
  const { focusableProps } = useFocusable({ id, onSelect, disabled })

  return (
    <button
      type="button"
      className={`btn btn--${variant}${className ? ` ${className}` : ''}`}
      disabled={disabled}
      aria-disabled={disabled}
      {...focusableProps}
    >
      {icon ? <span className="btn__icon">{icon}</span> : null}
      <span className="btn__label">{children}</span>
      {hint ? <span className="btn__hint">{hint}</span> : null}
    </button>
  )
}
