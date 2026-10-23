import { useState } from 'react'
import { useCookingHistory } from '../services/history/useCookingHistory.js'
import { imageFor } from '../services/recipeImages.js'
import { useFocusable } from '../tv/focus/useFocusable.js'

/**
 * "Your Cooking History" - the recipes the user actually finished, newest
 * first. Recorded by the completion screen only (see CompletionScreen), so
 * browsing a recipe never adds an entry.
 */
export function CookingHistoryPanel({ onOpen }) {
  const entries = useCookingHistory()

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="row__head">
        <h2 className="row__title" id="history-title">
          Your Cooking History
        </h2>
        <span className="row__hint">
          {entries.length > 0 ? 'Newest first · Select to open again' : 'Saved on this device'}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="history__empty">Your cooked recipes will appear here.</p>
      ) : (
        <div className="row__track scroll-x">
          {entries.map((entry) => (
            <HistoryCard key={entry.id} entry={entry} onOpen={() => onOpen(entry)} />
          ))}
        </div>
      )}
    </section>
  )
}

function formatCookedAt(timestamp) {
  const cooked = new Date(timestamp)
  if (Number.isNaN(cooked.getTime())) return 'Cooked recently'

  const today = new Date()
  if (cooked.toDateString() === today.toDateString()) return 'Cooked today'

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (cooked.toDateString() === yesterday.toDateString()) return 'Cooked yesterday'

  return `Cooked ${cooked.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
}

function HistoryCard({ entry, onOpen }) {
  const { focusableProps } = useFocusable({ id: `home-history-${entry.id}`, onSelect: onOpen })
  const [failed, setFailed] = useState(false)
  const source = failed ? null : entry.image || imageFor(entry.id)

  return (
    <button type="button" className="history-card" {...focusableProps}>
      <span className="history-card__thumb">
        {source ? (
          <img
            className="history-card__img"
            src={source}
            alt={`${entry.title} photo`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="history-card__fallback" aria-hidden="true">
            🍲
          </span>
        )}
      </span>
      <span className="history-card__body">
        <span className="history-card__title">{entry.title}</span>
        <span className="history-card__date">{formatCookedAt(entry.cookedAt)}</span>
        <span className="history-card__cta">Open again ›</span>
      </span>
    </button>
  )
}
