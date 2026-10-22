
const substitutions = {
  "olive oil": [
    { name: "vegetable oil", note: "Use the same quantity for sautéing." }
  ],
  "butter": [
    { name: "margarine", note: "Use the same quantity where suitable." }
  ],
  "milk": [
    { name: "unsweetened soy milk", note: "Use the same quantity in many pancake recipes." }
  ],
  "green chilli": [
    { name: "black pepper", note: "Add a little at a time; the flavour will differ." }
  ],
  "pasta": [
    { name: "spaghetti", note: "Use the same quantity; adjust cooking time to the package." }
  ],
  "tomato": [
    { name: "canned tomatoes", note: "Use a suitable amount and adjust for extra liquid." }
  ],
  "flour": [
    { name: "oat flour", note: "May change pancake texture; adjust the batter if needed." }
  ]
};

function normalizeIngredient(name) {
  return name.trim().toLowerCase();
}

export function getSubstitutions(ingredientName) {
  const ingredient = normalizeIngredient(ingredientName);
  return substitutions[ingredient] ?? [];
}

export function getMissingIngredientsWithSubstitutions(
  missingIngredients
) {
  return missingIngredients.map(name => ({
    ingredient: name,
    alternatives: getSubstitutions(name)
  }));
}
