/**
 * MOCK SERVICE — sample data only.
 *
 * Implements the RecipeService contract (src/contracts/recipes.js) against
 * the bundled sample recipes. Replace with the real implementation via
 * `setServiceImplementation('recipes', realService)`.
 */
import { SAMPLE_RECIPES, SAMPLE_PANTRY } from '../../data/recipes.js'

const SUBSTITUTIONS = {
  pasta: { name: 'Penne or spaghetti', note: 'Same cooking time, different bite' },
  tomato: { name: 'Tinned chopped tomatoes', note: 'Add in place of fresh, 1 tin for 300 g' },
  garlic: { name: 'Garlic powder', note: 'Use a quarter teaspoon per clove' },
  'olive oil': { name: 'Neutral oil', note: 'Works the same for cooking' },
  paprika: { name: 'Sweet paprika plus a drop of liquid smoke', note: 'Keeps the smoky note' },
  basil: { name: 'Dried oregano or parsley', note: 'Use half the quantity' },
  chicken: { name: 'Chicken breast', note: 'Cook for four minutes less' },
  potato: { name: 'Sweet potato', note: 'Roast for the same time, cut smaller' },
  lemon: { name: 'Lime', note: 'Use half the juice and a little zest' },
  rosemary: { name: 'Thyme', note: 'Use four sprigs' },
  rice: { name: 'Basmati rice', note: 'Add five minutes to the cooking time' },
  mushroom: { name: 'Chestnut or oyster mushrooms', note: 'Cook in two batches' },
  shallot: { name: 'Red onion', note: 'Use a little less, it is stronger' },
  parmesan: { name: 'Grated hard cheese', note: 'Any mature cheese works' },
  butter: { name: 'Olive oil', note: 'For a dairy-free version, use a little more oil' },
  chickpea: { name: 'Butter beans', note: 'Same texture, milder flavour' },
  'coconut milk': { name: 'Cream plus a splash of water', note: 'For dairy-free, use oat cream' },
  onion: { name: 'Spring onion', note: 'Add two minutes later, it is milder' },
  'curry powder': { name: 'Cumin, coriander and turmeric', note: 'Two thirds of a teaspoon each' },
  spinach: { name: 'Kale or chard', note: 'Strip the stems and add later' },
  salmon: { name: 'Firm white fish', note: 'Cod works, cook for two minutes less' },
  broccoli: { name: 'Green beans or tenderstem', note: 'Same timing' },
  'black bean': { name: 'Kidney beans', note: 'Drain and rinse well' },
  tortilla: { name: 'Wheat wraps', note: 'Toast them first for a crisp finish' },
  cumin: { name: 'Ground coriander and a pinch of chilli', note: 'Use a little less' },
  lime: { name: 'Lemon', note: 'Use half the juice' },
  avocado: { name: 'Pea and mint mash', note: 'Green alternative for dairy-free' },
  dough: { name: 'Pizza base', note: 'Skip the proving time' },
  mozzarella: { name: 'Grated cheddar and torn halloumi', note: 'Salt the halloumi first' },
  teriyaki: { name: 'Soy sauce, honey and rice vinegar', note: 'Two tablespoons each' },
  sesame: { name: 'Crushed peanuts', note: 'Adds crunch instead' },
  'spring onion': { name: 'Chives', note: 'Use them raw at the end' },
  egg: { name: 'Chickpea flour batter', note: 'For a vegan version' },
}

function normalise(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

export const mockRecipeService = {
  async listRecipes() {
    return SAMPLE_RECIPES
  },

  async getRecipe(id) {
    return SAMPLE_RECIPES.find((r) => r.id === id) || null
  },

  async getRecommendations() {
    // Sample stand-in for the real recommendation service: everything that is
    // under 30 minutes, which is a sensible "tonight" selection.
    return SAMPLE_RECIPES.filter((r) => r.totalMinutes <= 30)
  },

  async matchIngredients(recipeId) {
    const recipe = SAMPLE_RECIPES.find((r) => r.id === recipeId)
    if (!recipe) {
      return { recipeId, items: [], haveCount: 0, missingCount: 0, totalCount: 0 }
    }

    const pantry = new Set(SAMPLE_PANTRY.map(normalise))

    const items = recipe.ingredients.map((ingredient) => {
      const key = normalise(ingredient.pantryKey)
      const have = pantry.has(key)
      const substitution = have
        ? null
        : SUBSTITUTIONS[key] || {
            name: 'Ask your local shop',
            note: 'No substitution known for this one yet',
          }
      return {
        id: ingredient.id,
        name: ingredient.name,
        amount: ingredient.amount,
        status: have ? 'have' : 'missing',
        substitution,
      }
    })

    const haveCount = items.filter((i) => i.status === 'have').length

    return {
      recipeId,
      items,
      haveCount,
      missingCount: items.length - haveCount,
      totalCount: items.length,
    }
  },
}
