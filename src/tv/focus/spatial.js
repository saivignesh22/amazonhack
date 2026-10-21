// Pure spatial-navigation search.
//
// Kept free of React and of the DOM so it can be reasoned about (and unit
// tested) on its own: you feed it the active rectangle plus a list of
// candidate rectangles and it returns the best candidate for a direction.

/** Centre point of a DOMRect-like object. */
export function rectCenter(rect) {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 }
}

/**
 * Overlap between two rectangles along one axis.
 * @param {'x'|'y'} axis
 * @returns {number} overlapping length in px (0 when they do not overlap)
 */
export function crossOverlap(a, b, axis) {
  const [start, end] = axis === 'x' ? ['left', 'right'] : ['top', 'bottom']
  return Math.max(0, Math.min(a[end], b[end]) - Math.max(a[start], b[start]))
}

// Off-axis distance is penalised so that "right" prefers the nearest item on
// the same row over an item that is slightly closer but on another row.
const CROSS_PENALTY = 3
// Items that overlap the active element on the cross axis get a bonus.
const ALIGNED_BONUS = 0.6

/**
 * Find the best candidate for a directional key press.
 *
 * @param {DOMRect|object} activeRect rectangle of the currently focused item
 * @param {Array<{id: string, rect: object}>} entries candidate items
 * @param {'left'|'up'|'right'|'down'} direction
 * @returns {{id: string, rect: object}|null}
 */
export function findNextCandidate(activeRect, entries, direction) {
  if (!activeRect || !entries || entries.length === 0) return null

  const a = rectCenter(activeRect)
  let best = null
  let bestScore = Infinity

  for (const entry of entries) {
    const rect = entry.rect
    if (!rect) continue

    const c = rectCenter(rect)
    let forward
    let cross
    let crossAxis

    if (direction === 'right') {
      forward = c.x - a.x
      cross = Math.abs(c.y - a.y)
      crossAxis = 'y'
    } else if (direction === 'left') {
      forward = a.x - c.x
      cross = Math.abs(c.y - a.y)
      crossAxis = 'y'
    } else if (direction === 'down') {
      forward = c.y - a.y
      cross = Math.abs(c.x - a.x)
      crossAxis = 'x'
    } else if (direction === 'up') {
      forward = a.y - c.y
      cross = Math.abs(c.x - a.x)
      crossAxis = 'x'
    } else {
      return null
    }

    // Only consider items that are actually in the direction of travel.
    if (forward <= 1) continue

    const aligned = crossOverlap(activeRect, rect, crossAxis) > 0
    const score = forward + cross * CROSS_PENALTY - (aligned ? forward * ALIGNED_BONUS : 0)

    if (score < bestScore) {
      bestScore = score
      best = entry
    }
  }

  return best
}
