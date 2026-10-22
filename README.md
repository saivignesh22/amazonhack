# CookCue

**Cook along on your TV.** CookCue turns a recipe into a guided, hands-free cooking
session: tell it what is already in your kitchen, pick a dish from what you can
cook (or search for one by name), and follow one step at a time while a timer
keeps track of the time. Finished dishes go into a cooking history you can
return to.

Built for the [Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com)
(Fire TV track). The app is a React/Vite web app wrapped in a single-Activity
Fire OS APK, so it installs on a Fire TV and runs at the device's full 1080p.

---

## The five screens

| Screen | What it does |
| --- | --- |
| **Home** | Ingredient discovery: "What's in your kitchen today?", chips, quick add, "Recipes you can make", a dish search, and your cooking history. |
| **Recipe details** | The dish: time, difficulty, servings, the ingredient list, the plan. |
| **Kitchen check** | Marks what you have, flags what is missing and suggests a swap. |
| **Cooking mode** | One step at a time, a big timer, previous / repeat / next. |
| **Completion** | A summary of what you just cooked; it also records the dish in your history. |

### Discovering recipes

The home screen is the first screen — no account, no setup:

- Type ingredients separated by commas (or use the **Quick add** row, which needs
  no keyboard at all: Eggs, Tomatoes, Onions, Garlic, Rice, Chicken, Pasta,
  Potatoes, Cheese, Milk).
- Each ingredient becomes a chip. Select a chip to remove it; **Clear all** sits
  at the end of the row.
- **Find recipes** ranks what the catalogue can make with what you have. Every
  card shows a real photo, the time, the difficulty when the source publishes
  it, what you have and what is missing. Fewer than six results is explained
  rather than hidden.
- **Have a particular recipe in mind?** searches the same catalogue by name,
  shows have / missing for that dish, offers substitutions from the recipe
  engine, and lists similar dishes when there is no exact match.
- **Your cooking history** at the bottom keeps finished dishes, newest first,
  one entry per recipe, and opens any of them again.

The ingredient list is never lost: searching a dish, opening a detail screen or
coming back from cooking all keep the kitchen intact.

### The controls

| Remote button | Action |
| --- | --- |
| D-pad | Move focus (spatial navigation — nearest item in that direction). In a text field, Left/Right move the caret and Up/Down leave the field. |
| Select | Activate the focused item. On an empty ingredient field it raises the Fire TV keyboard; with text typed it adds the ingredients. |
| Back | Unwind one screen. In cooking mode it pauses the timer first. |

Focus is always visible, and coming back to a screen puts focus back on exactly
the tile you left from. Backspace never navigates — it only edits the field.

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
```

The app is designed for a TV, so open it in a 1920x1080 browser window and use
the arrow keys, Enter and Escape. On Windows PowerShell blocks `npm.ps1` — use
`npm.cmd` instead of `npm`.

### Tests

```bash
npm test             # unit tests: spatial search, ingredients, normalisers,
                     # image manifest, cooking history
npm run test:tv      # end-to-end TV test: builds, boots headless Chrome and
                     # drives the app with the D-pad (73 checks)
npm run lint
```

`npm run test:tv` needs Chrome or Chromium on the machine (set `CHROME_PATH` if
it is not in a standard location). It starts its own preview server and browser,
so nothing has to be running beforehand.

---

## Build the Fire TV APK

The packaging project lives in [`packaging/fireos-android`](packaging/fireos-android).
It is a thin native shell: one Activity, one WebView, the production web build
packed into the APK assets.

### 1. Install the toolchain

You need **JDK 17**, the **Android SDK (platform 35 + build-tools 35)** and
**Gradle 8.11+**. On Windows the whole thing is one script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-toolchain.ps1
```

It installs a Temurin JDK 17, the Android command line tools and SDK packages
and Gradle 8.11.1, sets `JAVA_HOME` / `ANDROID_HOME` / `ANDROID_SDK_ROOT` /
`PATH` for your user, and writes `packaging/fireos-android/local.properties`
for you. It is safe to re-run.

If you install the pieces yourself instead, create
`packaging/fireos-android/local.properties` by hand:

```properties
sdk.dir=C:/Users/you/AppData/Local/Android/Sdk
```

> Use forward slashes. Backslashes are escape characters in `.properties` files
> and the Android SDK will not be found.

### 2. Build

```bash
npm run apk:release   # web build + signed APK, in one step
```

or, step by step:

```bash
npm run build                                  # web build -> dist/
cd packaging/fireos-android
powershell -File create-keystore.ps1           # one-off, creates cookcue.keystore
gradlew assembleRelease
```

The APK lands in:

```
packaging/fireos-android/app/build/outputs/apk/release/app-release.apk
```

### 3. Install on a Fire TV

```bash
adb connect <fire-tv-ip>:5555
adb install -r app-release.apk
```

Then open **CookCue** from the Fire TV home screen. Full checklist:
[`docs/DEVICE_TEST.md`](docs/DEVICE_TEST.md).

---

## How it is put together

```
src/
  app/            stack router, app shell, kitchen state, session/timer caches
  components/     Button, RecipeTile, RecipeCard, IngredientInput, DishSearch,
                  CookingHistoryPanel, IngredientRow, AppHeader
  contracts/      the shapes Person 2 and Person 3 implement (JSDoc typedefs)
  screens/        the five screens
  services/       the one switch that chooses the data source
    mock/         sample implementations of the contracts
    history/      cooking history: storage adapter, service, React hook
  data/           committed snapshots and sample data
    themealdb/    catalogue of 790 TheMealDB meals (offline, no API key)
  styles/         design tokens, base, and all screen styles
  tv/             the TV layer: keys, focus engine, back handling, audio
public/recipes/   committed dish photos (+ ATTRIBUTION.md)
packaging/fireos-android/   Fire OS APK project
scripts/
  setup-toolchain.ps1       installs JDK 17 + Android SDK + Gradle
  fetch-catalogue.mjs       refreshes src/data/themealdb/catalogue.json
  fetch-recipe-images.mjs   downloads + crops the dish photos
  resize-image.py           Pillow helper (build time only)
  tv-smoke-test.mjs         drives the app with a remote control in headless Chrome
tests/            unit tests
docs/             device test, demo script, product feedback, friction log
```

### The focus engine

There is no focus library. `src/tv/focus/` is a small hand-rolled engine:

- `spatial.js` — pure directional search (`findNextCandidate`), unit tested.
- `FocusProvider.jsx` — owns the focused id, listens for keys in the capture
  phase so the WebView's own spatial navigation does not fight it.
- `FocusScope.jsx` — per-screen scope: decides where focus lands on mount and
  restores it when you come back.
- `useFocusable.js` — registers an element as a focusable target.

The visible focus ring is driven by `data-focus-active`, not `:focus-visible`,
because focus is moved by script and `:focus-visible` is unreliable there.

### Where the data comes from

Everything the UI touches goes through a contract in `src/contracts/`:

| Contract | Owner | Shape |
| --- | --- | --- |
| `recipes.js` | Person 2 | `Recipe`, `Ingredient`, `IngredientReport`, search + recommend |
| `timers.js` | Person 3 | `Timer` (`start` / `pause` / `resume` / `stop` / `subscribe`) |
| `session.js` | Person 3 | `Session` (`next` / `previous` / `repeat` / `goTo`) |
| `history.js` | this branch | `HistoryEntry` (`id`, `title`, `image`, `cookedAt`) |

`src/services/servicesRegistry.js` is the single switch:

```js
import { setServiceImplementation } from './services/servicesRegistry.js'
setServiceImplementation('recipes', realRecipeService)
```

The default recipe service is **TheMealDB**. A snapshot of 790 meals is committed
in `src/data/themealdb/catalogue.json`, so the app works offline and the
recommendation lists are instant; a dish outside the snapshot is looked up
against the live API (the search endpoint needs no key). The header shows the
active source through `getDataSourceLabel()`, so a source is never implied.

Ingredient matching is not duplicated here: `src/services/recipeMatching.js`
calls the recipe engine's `src/utils/ingredients.js` and
`src/utils/substitutions.js` through `src/services/recipeEngineAdapter.js`. If the
engine is replaced, only that adapter changes.

Dish photos are real, licensed photos of the actual dish, committed under
`public/recipes/` as 400×225 16:9 JPEGs (one per meal plus 14 for the bundled
recipes). `src/data/recipeImages.json` is the manifest; every entry carries the
provider, source URL and licence note, and `public/recipes/ATTRIBUTION.md` lists
them. `scripts/fetch-recipe-images.mjs` regenerates both, so no hard-coded image
URLs and no API keys live in the app.

Cooking history uses a small storage adapter over `localStorage`
(`cookcue.history.v1`). Recording happens only on the completion screen — opening
or starting a recipe never records it. The storage adapter is replaceable with a
backend without touching the screens.

Until a source is plugged in, the app can also run on the bundled sample data in
`src/data/` and the header labels it. No screen contains hard-coded recipe
content.

---

## What is verified, and what is not

| Area | Status |
| --- | --- |
| Web app end to end: ingredient entry, chips, dedupe, Clear all, quick add, recommendations, dish search (found + not found), real photos, cooking, completion, history persistence and reopen | **Verified** — 73 automated checks in `npm run test:tv` |
| Unit tests: spatial search, ingredient names, recipe normalisers, image manifest, cooking history | **Verified** — 45 tests in `npm test` |
| Every referenced dish photo exists, is 16:9 and carries provenance | **Verified** — manifest test in `npm test` |
| Lint / production build | **Verified** — `npm run lint`, `npm run build` |
| APK builds, is signed (v1 + v2), carries the web assets, declares the leanback launcher and banner | **Verified** — 16.6 MB release APK with 805 recipe assets inside; `apksigner verify` (v1 + v2) |
| Install and behaviour on a physical Fire TV | **Device pending** — needs a Fire TV (or Fire TV Stick) and a sideload |
| Remote key codes on real hardware | **Device pending** — the APK forwards the Android Back button; the D-pad is handled by the WebView's key events |
| Fire OS 5/6/7 (older API levels) | **Device pending** — built with `minSdk 21`, not yet run on an old device |
| Open source contribution | **Submitted** — [bamlab/react-tv-space-navigation#229](https://github.com/bamlab/react-tv-space-navigation/pull/229), awaiting review |

Nothing in this table is claimed beyond what has actually been run.

---

## Open source contribution

The focus engine in `src/tv/focus/` was built for this project, but the problem it
solves — restoring the focus when the user comes back to a screen — is not
specific to it. It is a known pain point of spatial navigation on TV, tracked
upstream in
[bamlab/react-tv-space-navigation#174](https://github.com/bamlab/react-tv-space-navigation/issues/174)
("it is not possible to select the focusable element for the 2nd time when we
return to the previous screen") and
[#195](https://github.com/bamlab/react-tv-space-navigation/issues/195) ("focus jumps
after screen navigation").

So the mechanism was contributed back to that library:

**[PR #229 — `feat: restore the focus when a root becomes active again`](https://github.com/bamlab/react-tv-space-navigation/pull/229)**

- Adds an opt-in `restoreFocus` prop to `SpatialNavigationRoot`: the root remembers
  where the focus was when it was deactivated (by `isActive`, or by a modal
  locking the navigation) and gives it back when it becomes active again.
- The position of the node in the tree is used to find the element back, because
  the node ids are generated at mount time and change on every re-render.
- 4 new tests, two of which fail without the change.
- `yarn test` (lint, types, core tests and example tests) passes.

---

## Docs

- [`docs/DEVICE_TEST.md`](docs/DEVICE_TEST.md) — sideloading and the on-device checklist.
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — a three-minute demo.
- [`docs/PRODUCT_FEEDBACK.md`](docs/PRODUCT_FEEDBACK.md) — what we would change.
- [`docs/FRICTION_LOG.md`](docs/FRICTION_LOG.md) — the tools that got in the way.
- [`public/recipes/ATTRIBUTION.md`](public/recipes/ATTRIBUTION.md) — the source and licence of every dish photo.

## Licence

MIT — see [LICENSE](LICENSE).
