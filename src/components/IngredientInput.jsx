import { useState } from 'react'
import {
  addIngredients,
  clearIngredients,
  removeIngredient,
} from '../app/kitchenState.js'
import { useKitchen } from '../app/useKitchen.js'
import { canonicalIngredientName } from '../services/ingredientNames.js'
import { useFocusable } from '../tv/focus/useFocusable.js'
import { Button } from './Button.jsx'

/** Common pantry items, so the whole flow works without typing a letter. */
const QUICK_ADD = [
  'Eggs',
  'Tomatoes',
  'Onions',
  'Garlic',
  'Rice',
  'Chicken',
  'Pasta',
  'Potatoes',
  'Cheese',
  'Milk',
]

function slug(name) {
  return canonicalIngredientName(name).replace(/\s+/g, '-')
}

/**
 * The ingredient entry block on the home screen: a text field for the remote
 * (Select raises the Fire TV soft keyboard), an Add button, the primary
 * "Find recipes" action, removable chips, Clear all and a quick-add row.
 *
 * Layout order is deliberate: the actions sit directly under the field so one
 * press of Down from the field reaches "Find recipes" with no sideways
 * hunting. The field is its own component so it registers before the buttons,
 * which makes it the fallback when a chip is deleted.
 */
export function IngredientInput({ onFind }) {
  const { ingredients } = useKitchen()
  const [draft, setDraft] = useState('')

  const addDraft = () => {
    if (!draft.trim()) return
    addIngredients(draft)
    setDraft('')
  }

  const present = new Set(ingredients.map(canonicalIngredientName))

  return (
    <section className="kitchen" aria-labelledby="kitchen-title">
      <p className="hero__eyebrow">Your kitchen</p>
      <h1 className="hero__title" id="kitchen-title">
        {"What's in your kitchen today?"}
      </h1>
      <p className="hero__sub">
        Add what you already have. We will show what you can cook right now and what is still
        missing.
      </p>

      <div className="ing-input">
        <IngredientField
          value={draft}
          onChange={setDraft}
          onEnter={addDraft}
        />
        <Button id="home-ingredient-add" onSelect={addDraft} icon="+">
          Add
        </Button>
      </div>

      <div className="kitchen__actions">
        <Button
          id="home-find-recipes"
          variant="primary"
          onSelect={onFind}
          disabled={ingredients.length === 0}
        >
          Find recipes
        </Button>
      </div>

      {ingredients.length > 0 ? (
        <ul className="chips" aria-label="Ingredients in your kitchen">
          {ingredients.map((name) => (
            <li key={canonicalIngredientName(name)}>
              <Chip name={name} onRemove={() => removeIngredient(name)} />
            </li>
          ))}
          <li>
            <ClearChip />
          </li>
        </ul>
      ) : (
        <p className="kitchen__empty">
          No ingredients yet — add one above, or select a suggestion below.
        </p>
      )}

      {QUICK_ADD.length > 0 ? (
        <div className="quick-add">
          <span className="quick-add__label">Quick add</span>
          <ul className="quick-add__list">
            {QUICK_ADD.map((name) => (
              <li key={name}>
                <QuickAdd
                  name={name}
                  added={present.has(canonicalIngredientName(name))}
                  onSelect={() => addIngredients(name)}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="kitchen__hint">
        {ingredients.length === 0
          ? 'Add at least one ingredient, then press Find recipes.'
          : `${ingredients.length} ingredient${ingredients.length === 1 ? '' : 's'} ready — press Find recipes to see what you can cook.`}
      </p>
    </section>
  )
}

function IngredientField({ value, onChange, onEnter }) {
  const { focusableProps, ref } = useFocusable({
    id: 'home-ingredient-input',
    editable: true,
    onSelect: () => {
      if (value.trim()) {
        onEnter()
        return
      }
      // Empty field: Select (or a click) raises the Android soft keyboard.
      ref.current?.click()
    },
  })

  return (
    <input
      {...focusableProps}
      className="ing-input__field"
      type="text"
      value={value}
      placeholder="Eggs, tomatoes, onions, rice..."
      aria-label="Ingredients you have, separated by commas"
      autoComplete="off"
      spellCheck="false"
      onChange={(event) => onChange(event.target.value)}
      onClick={() => ref.current?.focus()}
    />
  )
}

function Chip({ name, onRemove }) {
  const { focusableProps } = useFocusable({
    id: `home-chip-${slug(name)}`,
    onSelect: onRemove,
  })

  return (
    <button
      type="button"
      className="chip"
      aria-label={`Remove ${name}`}
      {...focusableProps}
    >
      <span className="chip__label">{name}</span>
      <span className="chip__remove" aria-hidden="true">
        ×
      </span>
    </button>
  )
}

function ClearChip() {
  const { focusableProps } = useFocusable({
    id: 'home-ingredient-clear',
    onSelect: clearIngredients,
  })

  return (
    <button
      type="button"
      className="chip chip--clear"
      aria-label="Remove all ingredients"
      {...focusableProps}
    >
      <span className="chip__label">Clear all</span>
    </button>
  )
}

function QuickAdd({ name, added, onSelect }) {
  const { focusableProps } = useFocusable({ id: `home-quick-${slug(name)}`, onSelect })

  return (
    <button
      type="button"
      className={`quick-add__btn${added ? ' quick-add__btn--added' : ''}`}
      aria-label={added ? `${name} is in your kitchen` : `Add ${name}`}
      {...focusableProps}
    >
      <span aria-hidden="true">{added ? '✓' : '+'}</span>
      <span>{name}</span>
    </button>
  )
}
