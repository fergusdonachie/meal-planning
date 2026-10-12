# Recipe images

All 36 current recipes have an individual AI-generated illustrative photograph,
created with the built-in image generation tool. They are not photographs of
kitchen-tested results. The app labels them “AI-generated image”.

The complete final prompt set is saved in `images/prompts.json`. Images are
compressed WebP files, up to 1200px wide, named `<recipe-id>.webp`; `imageSource:
"ai"` in the recipe data enables the label. Preserve that attribution when
adding generated photos; remove it when replacing an image with a real photo.

Drop a photo here named after each recipe's `id` (see `data/recipes.json`), e.g.:

```
med-chicken-traybake.jpg
per-joojeh.jpg
asi-miso-salmon.jpg
```

JPG, PNG or WebP all work — the app just requests `images/<id>.<ext>` via each recipe's `image` field, so update that field's extension if it doesn't match.

Recipes without a matching image fall back to a styled placeholder automatically, so this folder can be filled in gradually.
