import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatRecipeTime } from '../src/utils/recipeTime.js'

test('formatRecipeTime marks derived times with a tilde', () => {
  assert.equal(formatRecipeTime({ totalMinutes: 15, timeEstimated: true }), '~15 min')
  assert.equal(formatRecipeTime({ totalMinutes: 20, timeEstimated: false }), '20 min')
  assert.equal(formatRecipeTime({ totalMinutes: 30 }), '30 min')
})

test('formatRecipeTime returns null when the time is unknown', () => {
  assert.equal(formatRecipeTime({ totalMinutes: null, timeEstimated: false }), null)
  assert.equal(formatRecipeTime({}), null)
  assert.equal(formatRecipeTime(null), null)
})
