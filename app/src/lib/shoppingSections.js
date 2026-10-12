// A consistent supermarket-style order, independent of a particular store layout.
const SECTIONS = [
  ['produce', 'Fruit, vegetables & fresh herbs'],
  ['meat', 'Meat & poultry'],
  ['fish', 'Fish & seafood'],
  ['dairy', 'Dairy & eggs'],
  ['chilled', 'Chilled vegetarian'],
  ['bakery', 'Bread & bakery'],
  ['frozen', 'Frozen food'],
  ['grains', 'Rice, pasta & grains'],
  ['tins', 'Tins, beans & pulses'],
  ['spices', 'Herbs & spices'],
  ['condiments', 'Oils, sauces & condiments'],
  ['nuts', 'Nuts, seeds & dried fruit'],
  ['snacks', 'Crisps & snacks'],
  ['other', 'Other ingredients'],
];

export function ingredientSection(entry) {
  const name = entry.name.toLowerCase().split(',')[0];
  const originals = entry.sources.map((source) => source.ingredient.toLowerCase());
  // Sauce names and preserved foods take precedence over their plant/animal names.
  if (/\b(sauce|oil|vinegar|miso|tahini|honey|harissa|adobo|shaoxing)\b/.test(name)) return 'condiments';
  if (originals.some((text) => /\btin\b/.test(text)) || /\b(coconut milk|olives)\b/.test(name)) return 'tins';
  if (/\bfrozen\b/.test(name)) return 'frozen';
  if (/\b(tofu|tempeh)\b/.test(name)) return 'chilled';
  if (/\b(yoghurt|yogurt|feta|halloumi|cheese|eggs?|butter|cream|milk)\b/.test(name)) return 'dairy';
  if (/\b(chicken|beef|lamb|steak|pork|turkey|duck|bacon)\b/.test(name)) return 'meat';
  if (/\b(fish|cod|haddock|salmon|trout|sea bass|sea bream|prawns?|shrimp|tuna|mackerel|sardines)\b/.test(name)) return 'fish';
  if (/\b(chips|crisps)\b/.test(name)) return 'snacks';
  if (/\b(bread|flatbreads?|pittas?|pitas?|tortillas?|tostadas?)\b/.test(name)) return 'bakery';
  if (/\b(peanuts?|walnuts?|pistachios?|almonds?|sesame seeds|barberries|cranberries|raisins|dates|nuts|seeds)\b/.test(name)) return 'nuts';
  if (/\b(rice|noodles|pasta|bulgur|couscous|quinoa|flour|cornflour|oats)\b/.test(name)) return 'grains';
  if (/\b(ground|dried|cumin|paprika|turmeric|cinnamon|allspice|saffron|sumac|salt|black pepper|chipotle)\b/.test(name)) return 'spices';
  if (/\b(potatoes|potato|onions?|shallots?|garlic|ginger|galangal|lemongrass|chill(?:i|ies)|jalapeño|peppers?|tomatoes|tomato|carrots?|cucumber|courgettes?|aubergine|avocado|fennel|broccoli|green beans|mangetout|pak choi|greens|spinach|cabbage|lettuce|gem|rocket|salad|beansprouts|sweetcorn|corn cob|lemons?|limes?|orange|parsley|coriander|dill|mint|basil)\b/.test(name)) return 'produce';
  if (/\b(beans|chickpeas|lentils|pulses)\b/.test(name)) return 'tins';
  return 'other';
}

export function groupShoppingSections(entries) {
  const grouped = new Map(SECTIONS.map(([id, title]) => [id, { id, title, entries: [] }]));
  for (const entry of entries) grouped.get(ingredientSection(entry)).entries.push(entry);
  return [...grouped.values()].filter((section) => section.entries.length);
}
