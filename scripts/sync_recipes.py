"""Keep the standalone recipe bank aligned with data/recipes.json.

Run python3 scripts/sync_recipes.py, or add --check in CI.
"""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
recipes = json.loads((root / 'data/recipes.json').read_text())
assert len(recipes) == len({recipe['id'] for recipe in recipes}), 'Duplicate recipe IDs'
for recipe in recipes:
    assert recipe['cuisine'] in ('Mediterranean', 'Persian', 'Asian', 'Mexican')
    assert recipe['protein'] in ('Chicken', 'Fish', 'Red meat', 'Vegetarian')
    assert recipe['fish'] == (recipe['protein'] == 'Fish')
    assert recipe['servings'] > 0 and recipe['time'] > 0 and recipe['kcal'] > 0
    assert recipe['ingredients'] and recipe['method']
    assert all(isinstance(item, str) and item for item in recipe['ingredients'] + recipe['method'])
    if recipe.get('imageSource') == 'ai':
        assert (root / recipe['image']).is_file(), f"Missing image: {recipe['image']}"

site = root / 'site/index.html'
source = site.read_text()
start = source.index('const RECIPES = ')
end = source.index('\nconst CUISINE_COLOR', start)
synced = source[:start] + 'const RECIPES = ' + json.dumps(recipes, ensure_ascii=False, indent=2) + ';\n' + source[end:]
if '--check' in sys.argv:
    assert source == synced, 'Run python3 scripts/sync_recipes.py to update the standalone page'
    print(f'{len(recipes)} recipes validated; standalone page is in sync')
else:
    site.write_text(synced)
    print(f'Synced {len(recipes)} recipes')
