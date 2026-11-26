# Library Tycoon — V3 flat-reference asset pack

This is the production V3 pack. It deliberately recreates the supplied reference's simple rectangular pixel-diagram language: beige wall, grey tiled floor, dark blue-grey bar, wood furniture, black metal shelving, muted books, and small characters. It is **not** a V2-style dense cafe reinterpretation.

## Coordinate contract

- Logical room: 640×360; source files are 2× (1280×720 preview).
- Slot centres: 80, 240, 400, 560. Common furniture floor baseline: Y=240.
- Desk: 128×80; shelf: 128×176; return tray: 96×64; character: 32×48 (all logical).
- Use integer scaling only and disable smoothing.

## Contents and separation

`bookshelves/bookshelf_empty.png` is genuinely empty; muted individual book spine PNGs live in `books/`. The desk monitor and returned-books stack are separate from their furniture. Objects use RGBA transparency; background tiles and `preview.png` are opaque.

The operations, display, reading, and achievement facilities are **style extensions** because they are not visible in the supplied four-slot reference. Their frames are deliberately blank where text, covers, status screens, progress and trophies need runtime data.

## Rendering order

1. status bar, wall, baseboard and floor; 2. wall attachments; 3. furniture; 4. detachable objects/books; 5. character; 6. selection/effects/UI.

## Verification

The pack is generated as hard-edged PNGs. `preview.png` demonstrates desk / shelf / shelf / return placement, and `manifest.json` keeps logical sizes, anchors and baseline rules.

## Provenance

Created for this project. No third-party game assets are bundled. The source reference guided geometry and visual direction only.