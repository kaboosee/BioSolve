# CLAUDE.md

Context for working on this repository.

## What this is

A single-page, **vanilla** browser utility of biology lab calculators (molarity, dilution, growth rate, spectrophotometry, enzyme kinetics, ELISA, etc.). No build step, no framework, no dependencies, no package manager. You open `index.html` directly in a browser and it runs.

## Files

- `index.html` — all markup. A two-column `.layout`: a sticky `.sidebar` (brand, Result Formatting panel, grouped `.side-nav` links) and a `.content` column (hero + `.topic-stack` of topic sections, each holding calculator `.card`s).
- `styles.css` — all styling. Biology-lab theme (agar-green background, chlorophyll greens, specimen-amber accents). Light theme only (`color-scheme: light`).
- `app.js` — all logic. Plain functions, no modules/exports.
- `README.md` — user-facing feature docs.

## How a calculator is wired

Each calculator card in `index.html` follows the same shape:

- Inputs with stable `id`s (e.g. `mol-mass`, `mol-mw`).
- A `<button data-calc="NAME">` trigger.
- A `<p class="result" id="NAME-result">` output line.
- A `<div class="formula" id="NAME-formula">` worked-formula panel.

In `app.js`:

- `attachEvents()` maps each `data-calc` name to its handler via `calcMap` and binds the click. Adding a calculator = add a card in HTML + a `calcX()` function + one entry in `calcMap`.
- Shared helpers: `byId(id)`, `formatValue(n)` (applies the global format settings), `setResult(id, msg, ok)`, `setFormula(id, sections)`, `linearRegression(points)`, `mean(values)`, validators `isPositiveNumber` / `isNonZeroNumber`, list parsers `parseNumberList` / `parseRowList`.
- **All numeric output must go through `formatValue()`** so the sidebar Result Formatting controls (decimal vs. sig-fig, digit count, avoid-scientific-notation) apply uniformly. `refreshDisplayedResults()` re-runs every visible calculation when those controls change.

## Notable behaviours

- **Unit converter** (`UNIT_FACTORS` / `TEMP_UNITS` near the top of `app.js`): factors are "value in base unit" (kg for mass, L for volume). Convert via `base = value * factor[from]; result = base / factor[to]`. Temperature is handled with explicit inline math, not factors.
- **ELISA** (`calcElisa` + `parsePlateCsv`, `gatherWells`, `columnMeans`): parses a pasted plate grid into a `rowLabel → number[]` map, blank-corrects, builds a standard curve (linear or log10 X), fits it with `linearRegression`, back-calculates unknown/control concentrations, and writes graph-ready CSV into the read-only export textareas (Copy buttons wired in `attachCopyButtons`).
- **Sidebar nav** (`attachSectionNav`): an `IntersectionObserver` toggles `.active` on the sidebar link for the calculator currently in view.
- **UX helpers**: `attachEnterToCalculate()` makes Enter inside a card's input trigger its Calculate button (textareas/buttons excluded).

## Conventions

- Keep it dependency-free and framework-free. Don't introduce a build step.
- Match the existing style: small named functions, `const byId`, early-return validation with `setResult(..., false)` for errors.
- Comments only for non-obvious constraints (e.g. why `min-width: 0` on `.content`), not narration.
- The theme is robust to dark-mode extensions / forced-colors mode because cards are separated by **borders**, not just background fills — preserve that when restyling.

## Running / verifying changes

No tests and no runtime. To sanity-check:

- Syntax: `node --check app.js`.
- Visual check via headless Chrome screenshot (Windows):

  ```powershell
  $chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
  $url = "file:///C:/Users/calum/Documents/Coding/Visual Studio Code Projects/bsc-bio-utility/index.html"
  & $chrome --headless=new --disable-gpu --hide-scrollbars --window-size=1280,2000 --screenshot="$env:TEMP\shot.png" $url
  ```

  Check desktop and a narrow width (e.g. `--window-size=420,2400`) to confirm the sidebar collapses without overlap.
- Numeric logic can be spot-checked by porting the formula into a small `node -e` script (the calc functions depend on the DOM, so test the math, not the function directly).
