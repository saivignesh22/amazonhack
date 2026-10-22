import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  minutesFromText,
  normaliseEngineRecipe,
  normaliseMeal,
  splitInstructionBlocks,
  stepsFromInstructions,
} from '../src/services/recipeNormalisers.js'

test('splitInstructionBlocks splits step markers into steps', () => {
  const blocks = splitInstructionBlocks(
    'Step 1\nHeat the oven to 200C.\n\nStep 2\nMix the flour and the sugar.\n\nStep 3\nBake for 20 minutes.',
  )
  assert.equal(blocks.length, 3)
  assert.match(blocks[0], /Heat the oven/)
  assert.match(blocks[2], /Bake for 20 minutes/)
  // The "Step N" markers never show up in the text the user reads.
  assert.ok(blocks.every((block) => !/^step\s*\d+/i.test(block)))
})

test('splitInstructionBlocks folds headings into the next instruction', () => {
  const blocks = splitInstructionBlocks('For the sauce:\nStir the tomatoes into the pan.')
  assert.equal(blocks.length, 1)
  assert.match(blocks[0], /^For the sauce: Stir the tomatoes/)
})

test('splitInstructionBlocks breaks a single long paragraph into readable steps', () => {
  const sentence = 'Stir the mixture well and keep it moving so it does not stick.'
  const blocks = splitInstructionBlocks(Array.from({ length: 8 }, () => sentence).join(' '))
  assert.ok(blocks.length > 1, `expected several steps, got ${blocks.length}`)
  assert.ok(blocks.every((block) => block.length < 260))
})

test('splitInstructionBlocks handles empty input', () => {
  assert.deepEqual(splitInstructionBlocks(''), [])
  assert.deepEqual(splitInstructionBlocks(null), [])
})

test('minutesFromText reads minutes, hours and ranges', () => {
  assert.equal(minutesFromText('Bake for 20 minutes.'), 20)
  assert.equal(minutesFromText('Rest for 2 hours.'), 120)
  assert.equal(minutesFromText('Simmer for 1-2 hours.'), 120)
  assert.equal(minutesFromText('Fry for 5 mins.'), 5)
})

test('minutesFromText ignores text without a usable duration', () => {
  assert.equal(minutesFromText('Stir until smooth.'), null)
  assert.equal(minutesFromText('Bake for 500 minutes.'), null)
  assert.equal(minutesFromText(''), null)
})

test('stepsFromInstructions assigns ids, timers and titles', () => {
  const steps = stepsFromInstructions(
    'Step 1\nBoil the pasta for 10 minutes.\nStep 2\nStir in the sauce and serve.',
    'recipe-1',
  )
  assert.equal(steps.length, 2)
  assert.equal(steps[0].id, 'recipe-1-s1')
  assert.equal(steps[1].id, 'recipe-1-s2')
  assert.equal(steps[0].timer.seconds, 600)
  assert.equal(steps[0].minutes, 10)
  assert.equal(steps[1].timer, null)
  assert.ok(steps.every((step) => step.text.length > 0))
})

test('stepsFromInstructions caps very long recipes and folds the tail', () => {
  const blocks = Array.from({ length: 20 }, (_, i) => `Step ${i + 1}\nDo the thing number ${i + 1}.`)
  const steps = stepsFromInstructions(blocks.join('\n'), 'long')
  assert.equal(steps.length, 12)
  assert.match(steps[11].text, /thing number 20/)
})

test('normaliseMeal maps TheMealDB data and leaves missing facts null', () => {
  const recipe = normaliseMeal({
    id: '52893',
    title: 'Apple & Blackberry Crumble',
    area: 'British',
    category: 'Dessert',
    tags: ['Pudding'],
    instructions: 'Step 1\nHeat the oven to 190C and bake for 15 minutes.\nStep 2\nServe warm.',
    ingredients: [
      { name: 'plain flour', amount: '100g' },
      { name: 'caster sugar', amount: '75g' },
    ],
  })

  assert.equal(recipe.id, '52893')
  assert.equal(recipe.title, 'Apple & Blackberry Crumble')
  assert.equal(recipe.subtitle, 'British · Dessert')
  assert.equal(recipe.difficulty, null)
  assert.equal(recipe.servings, null)
  assert.equal(recipe.calories, null)
  assert.equal(recipe.image, null)
  assert.equal(recipe.totalMinutes, 15)
  assert.equal(recipe.timeEstimated, true)
  assert.deepEqual(
    recipe.ingredients.map((item) => item.pantryKey),
    ['flour', 'sugar'],
  )
  assert.equal(recipe.steps.length, 2)
  assert.equal(recipe.steps[0].timer.seconds, 900)
  assert.ok(recipe.art.from.startsWith('#'), 'fallback art is always present')
})

test('normaliseMeal does not turn a minor step timer into a total time', () => {
  const recipe = normaliseMeal({
    id: '53193',
    title: 'Drunken noodles (pad kee mao)',
    instructions:
      'step 1\nPrepare the noodles and mix the sauce.\nstep 2\nStir-fry the steak for 1 minute, then the broccoli for another 1-2 mins.',
    ingredients: [],
  })

  // The only timed action is one minute of stir-frying; that is not the total.
  assert.equal(recipe.totalMinutes, null)
  assert.equal(recipe.timeEstimated, false)
})

test('normaliseMeal rejects a timer sum that is impossible for the step count', () => {
  const instructions = Array.from(
    { length: 12 },
    (_, i) => `Step ${i + 1}\nPrepare part ${i + 1} for 1 minute.`,
  ).join('\n')
  const recipe = normaliseMeal({
    id: 'twelve-steps',
    title: 'Twelve step dish',
    instructions,
    ingredients: [],
  })

  // 12 minutes of timers across 12 steps is not a plausible total.
  assert.equal(recipe.steps.length, 12)
  assert.equal(recipe.totalMinutes, null)
  assert.equal(recipe.timeEstimated, false)
})

test('normaliseMeal keeps a provided photo', () => {
  const recipe = normaliseMeal(
    { id: '1', title: 'Toast', instructions: 'Toast the bread.', ingredients: [] },
    { image: './recipes/meals/1.jpg' },
  )
  assert.equal(recipe.image, './recipes/meals/1.jpg')
  assert.equal(recipe.totalMinutes, null)
  assert.equal(recipe.timeEstimated, false)
  assert.equal(recipe.subtitle, 'From TheMealDB')
})

test('normaliseEngineRecipe maps the team engine shape', () => {
  const recipe = normaliseEngineRecipe({
    id: 'tomato-pasta',
    name: 'Tomato Pasta',
    category: 'Pasta',
    servings: 2,
    prepMinutes: 5,
    cookMinutes: 15,
    ingredients: [{ name: 'spaghetti', quantity: 250, unit: 'g' }],
    steps: [{ instruction: 'Boil the pasta.', timerSeconds: 600 }],
  })

  assert.equal(recipe.title, 'Tomato Pasta')
  assert.equal(recipe.totalMinutes, 20)
  assert.equal(recipe.timeEstimated, false)
  assert.equal(recipe.servings, 2)
  assert.equal(recipe.difficulty, null)
  assert.equal(recipe.ingredients[0].amount, '250 g')
  assert.equal(recipe.ingredients[0].pantryKey, 'spaghetti')
  assert.equal(recipe.steps[0].timer.seconds, 600)
  assert.equal(recipe.steps[0].minutes, 10)
})
