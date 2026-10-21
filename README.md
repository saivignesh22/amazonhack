# CookCue

**Cook along on your TV.** CookCue turns a recipe into a guided, hands-free cooking
session: pick a dish, confirm what is already in your kitchen, and follow one
step at a time while a timer keeps track of the time.

Built for the [Amazon Developer Hackathon 2026](https://amazonappdev2026.devpost.com)
(Fire TV track). The app is a React/Vite web app wrapped in a single-Activity
Fire OS APK, so it installs on a Fire TV and runs at the device's full 1080p.

---

## The five screens

| Screen | What it does |
| --- | --- |
| **Home** | Rows of recipes — recommended, quick, and "uses what you have". |
| **Recipe details** | The dish: time, difficulty, servings, the ingredient list, the plan. |
| **Kitchen check** | Marks what you have, flags what is missing and suggests a swap. |
| **Cooking mode** | One step at a time, a big timer, previous / repeat / next. |
| **Completion** | A summary of what you just cooked. |

### The controls

| Remote button | Action |
| --- | --- |
| D-pad | Move focus (spatial navigation — nearest item in that direction). |
| Select | Activate the focused item. |
| Back | Unwind one screen. In cooking mode it pauses the timer first. |

Focus is always visible, and coming back to a screen puts focus back on exactly
the tile you left from.

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
npm test             # unit tests for the spatial focus algorithm
npm run test:tv      # end-to-end TV test: builds, boots headless Chrome and
                     # drives the app with the D-pad (32 checks)
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
  app/            stack router, app shell, session/timer caches
  components/     Button, RecipeTile, IngredientRow, AppHeader
  contracts/      the shapes Person 2 and Person 3 implement (JSDoc typedefs)
  screens/        the five screens
  services/       the one switch that chooses mock or real data
    mock/         sample implementations of the contracts
  data/           SAMPLE DATA — the bundled recipes and pantry
  styles/         design tokens, base, and all screen styles
  tv/             the TV layer: keys, focus engine, back handling, audio
packaging/fireos-android/   Fire OS APK project
scripts/
  setup-toolchain.ps1    installs JDK 17 + Android SDK + Gradle
  tv-smoke-test.mjs      drives the app with a remote control in headless Chrome
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
| `recipes.js` | Person 2 | `Recipe`, `Ingredient`, `IngredientReport` |
| `timers.js` | Person 3 | `Timer` (`start` / `pause` / `resume` / `stop` / `subscribe`) |
| `session.js` | Person 3 | `Session` (`next` / `previous` / `repeat` / `goTo`) |

`src/services/servicesRegistry.js` is the single switch:

```js
import { setServiceImplementation } from './services/servicesRegistry.js'
setServiceImplementation('recipes', realRecipeService)
```

Until then the app runs on the bundled sample data in `src/data/recipes.js`,
and the header shows a **Sample data** pill so it is never mistaken for live
content. No screen contains hard-coded recipe content.

---

## What is verified, and what is not

| Area | Status |
| --- | --- |
| Web app: screens, focus engine, D-pad, Select, Back, timers, ingredient toggling | **Verified** — 32 automated checks in `npm run test:tv` |
| Focus algorithm unit tests | **Verified** — `npm test` |
| Lint / production build | **Verified** — `npm run lint`, `npm run build` |
| APK builds, is signed (v1 + v2), carries the web assets, declares the leanback launcher and banner | **Verified** — `aapt2 dump badging`, `apksigner verify` |
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

## Licence

MIT — see [LICENSE](LICENSE).
