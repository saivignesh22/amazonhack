import recipes from "../data/recipes.json";

function normalizeIngredient(name) {
  const value = name.trim().toLowerCase();

  const aliases = {
    tomatoes: "tomato",
    eggs: "egg",
    potatoes: "potato",
    onions: "onion",
    carrots: "carrot",
    bananas: "banana",
    chillies: "green chilli",
    chilies: "green chilli"
  };

  return aliases[value] || value;
}

export function getMissingIngredients(recipe, availableIngredients) {
  const available = new Set(
    availableIngredients.map(normalizeIngredient)
  );

  return recipe.ingredients
    .filter(item => !available.has(normalizeIngredient(item.name)))
    .map(item => item.name);
}

export function getMatchScore(recipe, availableIngredients) {
  if (recipe.ingredients.length === 0) return 0;

  const available = new Set(
    availableIngredients.map(normalizeIngredient)
  );

  const matchedCount = recipe.ingredients.filter(item =>
    available.has(normalizeIngredient(item.name))
  ).length;

  return Math.round(
    (matchedCount / recipe.ingredients.length) * 100
  );
}

export function getMatchingRecipes(availableIngredients) {
  if (availableIngredients.length === 0) return [];

  return recipes
    .map(recipe => ({
      ...recipe,
      matchScore: getMatchScore(recipe, availableIngredients),
      missingIngredients: getMissingIngredients(
        recipe,
        availableIngredients
      )
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
}
