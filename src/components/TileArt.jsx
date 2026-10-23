import { useState } from 'react'
import { imageFor } from '../services/recipeImages.js'

/**
 * The artwork slot shared by tiles, cards and history thumbnails.
 *
 * Uses the recipe's real photo when one ships with the app and falls back to
 * the designed gradient/motif when it does not (or when the image fails to
 * load). `object-fit: cover` keeps the 16:9 source from distorting inside
 * whatever box the parent gives it.
 */
export function TileArt({ recipe, className = '' }) {
  const [failed, setFailed] = useState(false)
  const source = failed ? null : recipe.image || imageFor(recipe.id)

  return (
    <span
      className={`tile__art${source ? ' tile__art--image' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--tile-from': recipe.art?.from, '--tile-to': recipe.art?.to }}
    >
      {source ? (
        <img
          className="tile__img"
          src={source}
          alt={`${recipe.title} photo`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={`tile__motif tile__motif--${recipe.motif || 'round'}`}
          aria-hidden="true"
        />
      )}
    </span>
  )
}
