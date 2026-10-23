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

/**
 * Gap between the active element and a candidate along the direction of
 * travel (always > 0 for candidates that are actually ahead).
 */
function forwardGap(direction, active, candidate) {
  if (direction === 'right') return candidate.left - active.right
  if (direction === 'left') return active.left - candidate.right
  if (direction === 'down') return candidate.top - active.bottom
  return active.top - candidate.bottom
}

// Candidates whose gap is within this band of the closest one are compared on
// alignment instead of raw distance. Without the band, a wide element far down
// the page (a full-width text field) beats the button directly below it,
// because the wide element's centre is horizontally much closer.
const BAND_MIN = 60
const BAND_RATIO = 0.75
// Cross-axis distance still breaks ties, and a candidate that is not aligned
// at all is the last resort.
const CROSS_WEIGHT = 1
const UNALIGNED_PENALTY = 1000

/**
 * Find the best candidate for a directional key press.
 *
 * Heuristic (tuned for a 10-foot UI):
 * 1. only consider candidates that are ahead in the pressed direction;
 * 2. keep the nearest "band" of candidates, so distance matters first;
 * 3. inside the band prefer cross-axis overlap, then the closest centre.
 *
 * @param {DOMRect|object} activeRect rectangle of the currently focused item
 * @param {Array<{id: string, rect: object}>} entries candidate items
 * @param {'left'|'up'|'right'|'down'} direction
 * @returns {{id: string, rect: object}|null}
 */
export function findNextCandidate(activeRect, entries, direction) {
  if (!activeRect || !entries || entries.length === 0) return null
  if (direction !== 'left' && direction !== 'up' && direction !== 'right' && direction !== 'down') {
    return null
  }

  const forward = []
  for (const entry of entries) {
    if (!entry.rect) continue
    const gap = forwardGap(direction, activeRect, entry.rect)
    if (gap <= 1) continue
    forward.push({ entry, gap })
  }
  if (forward.length === 0) return null

  const nearest = Math.min(...forward.map((candidate) => candidate.gap))
  const cutoff = nearest + Math.max(BAND_MIN, nearest * BAND_RATIO)
  const band = forward.filter((candidate) => candidate.gap <= cutoff)

  const activeCenter = rectCenter(activeRect)
  const crossAxis = direction === 'left' || direction === 'right' ? 'y' : 'x'

  let best = null
  let bestScore = Infinity

  for (const { entry, gap } of band) {
    const rect = entry.rect
    const center = rectCenter(rect)
    const cross =
      crossAxis === 'x' ? Math.abs(center.x - activeCenter.x) : Math.abs(center.y - activeCenter.y)
    const aligned = crossOverlap(activeRect, rect, crossAxis) > 0
    const score =
      (aligned ? 0 : UNALIGNED_PENALTY) + cross * CROSS_WEIGHT + gap * 0.1

    if (score < bestScore) {
      bestScore = score
      best = entry
    }
  }

  return best
}
