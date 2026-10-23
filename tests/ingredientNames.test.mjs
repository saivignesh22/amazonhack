import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalIngredientName,
  mergeIngredients,
  splitIngredientList,
  titleCaseIngredient,
} from '../src/services/ingredientNames.js'

test('canonicalIngredientName removes prep words, units and plurals', () => {
  assert.equal(canonicalIngredientName('Garlic Cloves'), 'garlic')
  assert.equal(canonicalIngredientName('garlic clove'), 'garlic')
  assert.equal(canonicalIngredientName('Caster Sugar'), 'sugar')
  assert.equal(canonicalIngredientName('chopped parsley'), 'parsley')
  assert.equal(canonicalIngredientName('Red Onions'), 'red onion')
  assert.equal(canonicalIngredientName('  Tomatoes  '), 'tomato')
  assert.equal(canonicalIngredientName('potatoes'), 'potato')
  assert.equal(canonicalIngredientName('plain flour'), 'flour')
})

test('canonicalIngredientName survives empty and odd values', () => {
  assert.equal(canonicalIngredientName(''), '')
  assert.equal(canonicalIngredientName(null), '')
  assert.equal(canonicalIngredientName(undefined), '')
  // Non-strings that are not real names reduce to an empty key.
  assert.equal(canonicalIngredientName(0), '')
})

test('canonicalIngredientName drops parentheticals and trailing serving notes', () => {
  assert.equal(canonicalIngredientName('Tomatoes (ripe)'), 'tomato')
  assert.equal(canonicalIngredientName('Parsley to taste'), 'parsley')
  assert.equal(canonicalIngredientName('Butter for greasing'), 'butter')
})

test('titleCaseIngredient keeps the user spelling but tidies whitespace', () => {
  assert.equal(titleCaseIngredient('  olive   oil '), 'Olive oil')
  assert.equal(titleCaseIngredient(''), '')
})

test('splitIngredientList splits commas, semicolons and newlines', () => {
  assert.deepEqual(splitIngredientList('eggs, milk; flour\nsugar'), [
    'eggs',
    'milk',
    'flour',
    'sugar',
  ])
  assert.deepEqual(splitIngredientList('eggs, and milk, , '), ['eggs', 'milk'])
  assert.deepEqual(splitIngredientList(''), [])
  assert.deepEqual(splitIngredientList(null), [])
})

test('mergeIngredients drops empties and duplicates, keeping first spelling', () => {
  assert.deepEqual(mergeIngredients([], 'Eggs, tomatoes, eggs'), ['Eggs', 'tomatoes'])
  assert.deepEqual(mergeIngredients(['Eggs'], 'eggs, EGGS, milk'), ['Eggs', 'milk'])
  assert.deepEqual(mergeIngredients(['Tomatoes'], 'tomato'), ['Tomatoes'])
  assert.deepEqual(mergeIngredients(['Eggs'], ['', '  ', 'milk']), ['Eggs', 'milk'])
  assert.deepEqual(mergeIngredients(undefined, 'salt'), ['salt'])
})
