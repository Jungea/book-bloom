# Library Tycoon assets V4

V4 retains the established beige-wall, slate-status-bar, gray tiled-floor, walnut circulation-desk, cream CRT, and black-metal bookshelf design language from `reference_original.png`. The reference original is preserved unchanged for comparison.

## Scene contract

- Logical scene: **640횞360**; all authored PNG source dimensions and `preview.png` are **2횞** (1280횞720 preview).
- Four equal slots: width **160px**; centers **X=80, 240, 400, 560**.
- Floor baseline: **Y=240** logical pixels.
- Initial slots: circulation desk (slot 1), empty bookshelf (slot 2), empty slot (slot 3), empty return tray (slot 4). The desk monitor is a separate overlay in slot 1.

Objects are separate RGBA PNGs at 2횞 logical size. Render backgrounds, furniture, detachable books/monitor, characters, then UI/effects, using nearest-neighbor scaling with image smoothing disabled. The bookshelf remains empty; book spines are supplied in `books/` for runtime placement.

Created for this project; no third-party asset pack is included.
