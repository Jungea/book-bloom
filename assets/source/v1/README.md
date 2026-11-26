# Library Tycoon — MVP Asset Pack

Production-ready, hand-authored pixel PNGs for the first playable library room. The visual direction follows the Notion plan: a cozy, front-facing 2D library in which books are individual placeable objects.

## Contents

* `backgrounds/wall_tile.png` — 16×16, repeat on both axes.
* `backgrounds/floor_tile.png` — 16×16, repeat on both axes.
* `backgrounds/baseboard_tile.png` — 16×8, repeat horizontally between wall and floor.
* `bookshelves/empty_bookshelf.png` — 96×128, transparent exterior, bottom-center anchor. Rows are at y=47, 78, and 109.
* `books/*.png` — eight independent book spines, with transparent exterior. Bottom-align each spine to a shelf row.

## Web implementation

Render at the native pixel sizes, or an integer multiple only (2×, 3×, etc.). Disable interpolation:

```css
canvas, .pixel-art { image-rendering: pixelated; image-rendering: crisp-edges; }
```

```js
ctx.imageSmoothingEnabled = false;
```

For a 640×360 room, tile wall/floor with 16px cells. Draw the baseboard at the wall-floor seam, then draw bookshelves and finally book spines. This maintains the intended front-facing layering.

## Book placement

Use the book asset filename as a visual variant only. Keep book title, author, page count, review, and database ID in game data; do not bake text into the PNG. This makes every reading record a clickable, independently placed game object.

## Scope

Included: first-MVP environment, empty shelf, and book spines. Deliberately not included: characters, furniture, UI, coins, effects, shop, and upgraded shelves. Those appear in `nextStage` inside `manifest.json` and should be produced after the room gameplay is validated.

## License / provenance

Created for this project. No third-party game assets are bundled. The pack’s art direction was established from an AI-generated internal style reference; the delivered sprite PNGs are bespoke geometric pixel assets and contain no generated source art.