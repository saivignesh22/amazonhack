/**
 * Turn source recipes into the shape the screens use (src/contracts/recipes.js).
 *
 * TheMealDB gives us a name, a category, a photo, 20 ingredient slots and one
 * blob of instructions. We split that blob into steps on paragraph breaks
 * (739 of 790 meals are written that way) and pull real durations out of the
 * text ("simmer for 20 minutes") so cooking mode keeps its timers.
 *
 * Nothing here invents facts: a field TheMealDB does not publish (difficulty,
 * servings, calories) is left null and the UI says so.
 */
import { canonicalIngredientName, titleCaseIngredient } from './ingredientNames.js'

const GRADIENTS = [
  { from: '#e2703a', to: '#8f3418' },
  { from: '#f2b544', to: '#a86a12' },
  { from: '#cf7359', to: '#7a3a2a' },
  { from: '#7fa88b', to: '#2f5741' },
  { from: '#e2703a', to: '#b05a30' },
  { from: '#cf7359', to: '#6d2f20' },
  { from: '#7fa88b', to: '#3c6b52' },
  { from: '#f2b544', to: '#c07a12' },
]

const MOTIFS = ['round', 'wide', 'square']

const MAX_STEPS = 12

/**
 * TheMealDB does not publish a total time, so the only time data is the
 * durations mentioned inside steps. Their sum is a lower bound, not a total:
 * a dish with one "stir for 1 minute" would otherwise claim "1 min".
 *
 * A total is only shown when the sum is both at least ten minutes and at least
 * two minutes per step - a twelve-step dish cannot honestly claim ten minutes.
 * Otherwise the recipe shows "Not listed" (or its step count) instead.
 */
const MIN_ESTIMATED_MINUTES = 10
const MIN_MINUTES_PER_STEP = 2
const STEP_MARKER = /^step\s*\d+\s*[:.)-]?\s*$/i
const STEP_PREFIX = /^step\s*\d+\s*[:.)-]\s*/i
const TIME_PATTERN =
  /\b(\d{1,3})(?:\s*(?:-|–|to)\s*(\d{1,3}))?\s*(minutes?|mins?|hours?|hrs?)\b/i

/** Stable hash so a recipe always gets the same fallback artwork. */
function hash(value) {
  let total = 0
  for (let i = 0; i < value.length; i += 1) total = (total * 31 + value.charCodeAt(i)) % 100000
  return total
}

function artFor(id) {
  const index = hash(String(id)) % GRADIENTS.length
  return GRADIENTS[index]
}

function motifFor(id) {
  return MOTIFS[hash(String(id)) % MOTIFS.length]
}

/** First duration mentioned in a step, in whole minutes (null when absent). */
export function minutesFromText(text) {
  const match = TIME_PATTERN.exec(String(text || ''))
  if (!match) return null

  const hours = /^h/i.test(match[3])
  const value = Number(match[2] || match[1])
  if (!Number.isFinite(value) || value <= 0) return null

  const minutes = hours ? value * 60 : value
  if (minutes < 1 || minutes > 300) return null
  return Math.round(minutes)
}

function splitSentences(block) {
  return String(block)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Split an instruction blob into step-sized paragraphs.
 * Handles "Step 1" markers, heading lines and one-paragraph recipes.
 * @param {string} instructions
 * @returns {string[]}
 */
export function splitInstructionBlocks(instructions) {
  const lines = String(instructions || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const blocks = []
  for (const line of lines) {
    if (STEP_MARKER.test(line)) continue
    const text = line.replace(STEP_PREFIX, '').trim()
    if (!text) continue

    // A very short line is usually a heading ("For the sauce:") - keep it with
    // the next instruction instead of making it its own step.
    if (text.length < 18 && text.endsWith(':') && blocks.length >= 0) {
      blocks.push({ heading: true, text })
      continue
    }

    const previous = blocks[blocks.length - 1]
    if (previous && !previous.heading && text.length < 25 && !/[.!?]$/.test(previous.text)) {
      previous.text = `${previous.text} ${text}`
      continue
    }

    blocks.push({ heading: false, text })
  }

  // Fold headings into whatever follows them.
  const merged = []
  let pendingHeading = ''
  for (const block of blocks) {
    if (block.heading) {
      pendingHeading = pendingHeading ? `${pendingHeading} ${block.text}` : block.text
      continue
    }
    merged.push(pendingHeading ? `${pendingHeading} ${block.text}` : block.text)
    pendingHeading = ''
  }
  if (pendingHeading) merged.push(pendingHeading)

  // A recipe written as one long paragraph still deserves a readable step
  // list, so group its sentences a few at a time.
  if (merged.length === 1 && merged[0].length > 260) {
    const sentences = splitSentences(merged[0])
    if (sentences.length >= 4) {
      const grouped = []
      for (let i = 0; i < sentences.length; i += 2) {
        grouped.push(sentences.slice(i, i + 2).join(' '))
      }
      return grouped
    }
  }

  return merged
}

function titleAndText(block, index) {
  const sentences = splitSentences(block)
  const first = sentences[0]
  if (sentences.length > 1 && first.length <= 64) {
    const rest = sentences.slice(1).join(' ').trim()
    if (rest.length >= 12) {
      return { title: first.replace(/[.:;]$/, ''), text: rest }
    }
  }
  return { title: `Step ${index + 1}`, text: block }
}

/**
 * Instruction blob -> contract RecipeStep[].
 * @param {string} instructions
 * @param {string} recipeId
 * @returns {import('../contracts/recipes.js').RecipeStep[]}
 */
export function stepsFromInstructions(instructions, recipeId) {
  const blocks = splitInstructionBlocks(instructions)

  // Keep the list skimmable on a TV: fold anything past the cap into the last
  // step rather than making the user tap through twenty screens.
  let list = blocks
  if (list.length > MAX_STEPS) {
    const head = list.slice(0, MAX_STEPS - 1)
    const tail = list.slice(MAX_STEPS - 1).join(' ')
    list = [...head, tail]
  }

  return list.map((block, index) => {
    const { title, text } = titleAndText(block, index)
    const minutes = minutesFromText(text)
    const label = title.length <= 28 ? title : `Step ${index + 1}`
    return {
      id: `${recipeId}-s${index + 1}`,
      title,
      text,
      minutes,
      tip: null,
      timer: minutes ? { label, seconds: minutes * 60 } : null,
    }
  })
}

/**
 * The recipe engine's shape (src/data/recipes.json, Person 2) -> contract
 * Recipe. Used by src/services/recipeEngineAdapter.js when the team switches
 * the live service to the local engine.
 * @param {object} recipe
 * @param {{image?: string|null}} [options]
 * @returns {import('../contracts/recipes.js').Recipe}
 */
export function normaliseEngineRecipe(recipe, { image = null } = {}) {
  const totalMinutes = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0)
  const steps = (recipe.steps || []).map((step, index) => {
    const seconds = Number(step.timerSeconds) || 0
    return {
      id: `${recipe.id}-s${index + 1}`,
      title: `Step ${index + 1}`,
      text: step.instruction,
      minutes: seconds > 0 ? Math.round(seconds / 60) : null,
      tip: null,
      timer: seconds > 0 ? { label: `Step ${index + 1}`, seconds } : null,
    }
  })

  return {
    id: recipe.id,
    title: recipe.name,
    subtitle: recipe.category || '',
    cuisine: recipe.category || '',
    category: recipe.category || '',
    difficulty: null,
    totalMinutes: totalMinutes > 0 ? totalMinutes : null,
    timeEstimated: false,
    servings: recipe.servings || null,
    calories: null,
    tags: [recipe.category].filter(Boolean),
    art: artFor(recipe.id),
    motif: motifFor(recipe.id),
    image,
    ingredients: (recipe.ingredients || []).map((item, index) => ({
      id: `${recipe.id}-i${index + 1}`,
      name: titleCaseIngredient(item.name),
      amount: [item.quantity, item.unit].filter(Boolean).join(' '),
      pantryKey: canonicalIngredientName(item.name),
    })),
    steps,
  }
}

/**
 * TheMealDB meal -> contract Recipe.
 * @param {object} meal snapshot entry from src/data/themealdb/catalogue.json
 * @param {{image?: string|null}} [options]
 * @returns {import('../contracts/recipes.js').Recipe}
 */
export function normaliseMeal(meal, { image = null } = {}) {
  const steps = stepsFromInstructions(meal.instructions, meal.id)
  const timerMinutes = steps.reduce((total, step) => total + (step.minutes || 0), 0)
  const plausible = Math.max(MIN_ESTIMATED_MINUTES, steps.length * MIN_MINUTES_PER_STEP)
  const totalMinutes = timerMinutes >= plausible ? timerMinutes : null

  const ingredients = (meal.ingredients || []).map((item, index) => ({
    id: `${meal.id}-i${index + 1}`,
    name: titleCaseIngredient(item.name),
    amount: item.amount || '',
    pantryKey: canonicalIngredientName(item.name),
  }))

  const tags = (meal.tags || []).filter(Boolean)
  const subtitleParts = [meal.area, meal.category].filter(Boolean)

  return {
    id: String(meal.id),
    title: meal.title,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(' · ') : 'From TheMealDB',
    cuisine: meal.area || meal.category || '',
    category: meal.category || '',
    difficulty: null,
    totalMinutes,
    // Marked so the UI can render "~15 min" instead of implying TheMealDB
    // published a total time.
    timeEstimated: totalMinutes !== null,
    servings: null,
    calories: null,
    tags: tags.length > 0 ? tags.slice(0, 2) : [meal.category].filter(Boolean),
    art: artFor(meal.id),
    motif: motifFor(meal.id),
    image,
    ingredients,
    steps,
  }
}
