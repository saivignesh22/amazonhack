import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findNextCandidate, rectCenter, crossOverlap } from '../src/tv/focus/spatial.js'

/** Build a rectangle from top/left plus a size. */
function rect(top, left, width = 100, height = 40) {
  return { top, left, right: left + width, bottom: top + height, width, height }
}

const item = (id, r) => ({ id, rect: r })

test('rectCenter returns the middle of the rectangle', () => {
  assert.deepEqual(rectCenter(rect(0, 0, 100, 50)), { x: 50, y: 25 })
})

test('crossOverlap measures the shared span on an axis', () => {
  assert.equal(crossOverlap(rect(0, 0, 100, 50), rect(0, 50, 100, 50), 'x'), 50)
  assert.equal(crossOverlap(rect(0, 0, 100, 50), rect(0, 200, 100, 50), 'x'), 0)
  assert.equal(crossOverlap(rect(0, 0, 100, 50), rect(25, 0, 100, 50), 'y'), 25)
})

test('right picks the nearest item in the same row', () => {
  const active = rect(100, 100)
  const entries = [
    item('far', rect(100, 400)),
    item('near', rect(100, 220)),
    item('other-row', rect(400, 220)),
  ]
  assert.equal(findNextCandidate(active, entries, 'right').id, 'near')
})

test('left picks the nearest item on the left', () => {
  const active = rect(100, 300)
  const entries = [item('near', rect(100, 180)), item('far', rect(100, 20))]
  assert.equal(findNextCandidate(active, entries, 'left').id, 'near')
})

test('down prefers the item below in the same column', () => {
  const active = rect(100, 100)
  const entries = [
    item('below', rect(200, 110)),
    item('far-below', rect(600, 110)),
    item('sideways', rect(200, 900)),
  ]
  assert.equal(findNextCandidate(active, entries, 'down').id, 'below')
})

test('up never returns an item below the active one', () => {
  const active = rect(300, 100)
  const entries = [item('below', rect(400, 100)), item('above', rect(100, 100))]
  assert.equal(findNextCandidate(active, entries, 'up').id, 'above')
})

test('no candidate is returned when nothing is in that direction', () => {
  const active = rect(100, 100)
  assert.equal(findNextCandidate(active, [item('right', rect(100, 200))], 'left'), null)
  assert.equal(findNextCandidate(active, [], 'down'), null)
  assert.equal(findNextCandidate(null, [item('a', rect(0, 0))], 'down'), null)
})

test('a row of tiles is walked left to right', () => {
  const tiles = [0, 1, 2, 3].map((i) => item(`tile-${i}`, rect(100, 100 + i * 120)))
  const active = tiles[1]
  const rest = tiles.filter((t) => t.id !== active.id)
  assert.equal(findNextCandidate(active.rect, rest, 'right').id, 'tile-2')
  assert.equal(findNextCandidate(active.rect, rest, 'left').id, 'tile-0')
})

test('down prefers the control just below over a wide field far down the page', () => {
  // The regression this guards: a full-width text field further down the page
  // used to win on centre distance over the button directly underneath.
  const field = rect(100, 0, 1100, 64)
  const button = rect(180, 0, 220, 56)
  const farField = rect(900, 0, 1100, 64)
  const entries = [item('button', button), item('far-field', farField)]

  assert.equal(findNextCandidate(field, entries, 'down').id, 'button')
})

test('inside the nearest band the horizontally aligned item wins', () => {
  const active = rect(100, 500)
  const aligned = rect(180, 520)
  const offset = rect(180, 1000)
  const entries = [item('aligned', aligned), item('offset', offset)]

  assert.equal(findNextCandidate(active, entries, 'down').id, 'aligned')
})

test('a wrapped row is walked line by line', () => {
  const firstLine = [0, 1, 2].map((i) => item(`a-${i}`, rect(100, 100 + i * 220)))
  const secondLine = [0, 1, 2].map((i) => item(`b-${i}`, rect(160, 100 + i * 220)))
  const entries = [...firstLine, ...secondLine]

  assert.equal(findNextCandidate(firstLine[0].rect, entries, 'down').id, 'b-0')
  assert.equal(findNextCandidate(firstLine[2].rect, entries, 'down').id, 'b-2')
})
