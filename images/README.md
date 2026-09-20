# Recipe images

Drop a photo here named after each recipe's `id` (see `data/recipes.json`), e.g.:

```
med-chicken-traybake.jpg
per-joojeh.jpg
asi-miso-salmon.jpg
```

JPG, PNG or WebP all work — the app just requests `images/<id>.<ext>` via each recipe's `image` field, so update that field's extension if it doesn't match.

Recipes without a matching image fall back to a styled placeholder automatically, so this folder can be filled in gradually.
