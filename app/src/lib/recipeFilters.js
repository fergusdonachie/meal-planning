export function matchesCookingMethod(recipe, method) {
  if (!method) return true;
  if (method === 'single') return ['One pot', 'One tray'].includes(recipe.cookingMethod);
  return recipe.cookingMethod === method;
}
