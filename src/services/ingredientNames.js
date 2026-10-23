/**
 * Ingredient name normalisation.
 *
 * Three sources name the same ingredient differently:
 *   - TheMealDB says "garlic clove", "red onions", "chopped parsley"
 *   - the recipe engine normalises a few plurals of its own
 *   - the user types whatever they like, comma separated
 *
 * `canonicalIngredientName` reduces all of them to one pantry key so that
 * "Garlic Cloves", "garlic clove" and "garlic" compare equal. The matching
 * itself stays in the recipe engine (src/utils/ingredients.js); this module
 * only prepares names for it.
 */

/** Words that describe how an ingredient is prepped or sold, not what it is. */
const QUALIFIERS = new Set([
  'fresh',
  'freshly',
  'dried',
  'ground',
  'chopped',
  'diced',
  'sliced',
  'minced',
  'grated',
  'peeled',
  'crushed',
  'torn',
  'halved',
  'quartered',
  'large',
  'small',
  'medium',
  'whole',
  'plain',
  'all',
  'purpose',
  'organic',
  'raw',
  'cooked',
  'boiled',
  'roasted',
  'toasted',
  'melted',
  'softened',
  'caster',
  'granulated',
  'brown',
  'light',
  'dark',
  'boneless',
  'skinless',
])

/** Unit or cut words that can trail the actual ingredient ("garlic clove"). */
const TRAILING_UNITS = new Set([
  'clove',
  'sprig',
  'can',
  'tin',
  'jar',
  'slice',
  'piece',
  'fillet',
  'breast',
  'thigh',
  'leaf',
  'stick',
  'bunch',
  'head',
  'pinch',
  'handful',
  'packet',
  'tub',
  'carton',
  'pot',
  'punnet',
])

/** Phrases that only describe how an ingredient is served. */
const TRAILING_PHRASES = [
  'to taste',
  'for frying',
  'for garnish',
  'for serving',
  'for greasing',
  'for dusting',
  'for decoration',
  'for the sauce',
]

function singularise(word) {
  if (word.length <= 3) return word
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.endsWith('oes')) return word.slice(0, -2)
  if (/(?:ch|sh|ss|x|z)es$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('us') || word.endsWith('is') || word.endsWith('ss')) return word
  if (word.endsWith('s') && !word.endsWith('ious')) return word.slice(0, -1)
  return word
}

/**
 * Reduce an ingredient name to a comparable key.
 * @param {string} value
 * @returns {string}
 */
export function canonicalIngredientName(value) {
  let text = String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const phrase of TRAILING_PHRASES) {
    if (text.endsWith(phrase)) text = text.slice(0, -phrase.length).trim()
  }

  const words = text.split(' ').filter(Boolean)
  const kept = []
  for (const word of words) {
    if (QUALIFIERS.has(word)) continue
    kept.push(word)
  }

  // A trailing unit/cut word is not part of the ingredient ("garlic cloves").
  while (kept.length > 1 && TRAILING_UNITS.has(singularise(kept[kept.length - 1]))) kept.pop()

  const cleaned = kept.length > 0 ? kept : words
  return cleaned.map(singularise).join(' ').trim()
}

/** "garlic clove" -> "Garlic clove" (display only, never for matching). */
export function titleCaseIngredient(value) {
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Split what the user typed into individual ingredients.
 * Accepts commas, semicolons and newlines; a leading "and" after a separator
 * is dropped too ("eggs, and milk").
 * @param {string} text
 * @returns {string[]}
 */
export function splitIngredientList(text) {
  return String(text || '')
    .split(/[,;\n\r]+/)
    .map((part) => part.replace(/^\s*and\s+/i, '').trim())
    .filter(Boolean)
}

/**
 * Add ingredients to a list, keeping the first spelling of each and dropping
 * duplicates and empties.
 * @param {string[]} existing
 * @param {string[]|string} additions
 * @returns {string[]}
 */
export function mergeIngredients(existing, additions) {
  const out = [...(existing || [])]
  const seen = new Set(out.map((item) => canonicalIngredientName(item)))
  const incoming = Array.isArray(additions) ? additions : splitIngredientList(additions)
  for (const raw of incoming) {
    const name = String(raw || '').trim()
    if (!name) continue
    const key = canonicalIngredientName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}
