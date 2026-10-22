# AGENTS.md

CookCue — a React + Vite cooking app for Fire TV, shipped as a Fire OS APK.
Five screens (home, details, ingredients, cooking, completion) wrapped in a
single-Activity WebView shell.

## Commands

Run npm as **`npm.cmd`**, not `npm` — PowerShell's execution policy blocks
`npm.ps1` on this machine.

```bash
npm.cmd run dev          # vite dev server (host:true, so a Fire TV on the LAN can reach it)
npm.cmd run lint         # eslint .   (must stay clean)
npm.cmd test             # node:test unit tests, tests/**/*.test.mjs
npm.cmd run test:tv      # builds, then drives the built app in headless Chrome (32 checks)
npm.cmd run build        # vite build -> dist/
npm.cmd run apk:release  # web build + signed release APK
```

- `npm run test:tv` needs Chrome or Edge. It looks in the standard install
  paths; override with `CHROME_PATH=/path/to/chrome`. `TV_TEST_PORT` (4173)
  and `CDP_PORT` (9222) override the ports. It boots `vite preview` itself.
- `npm test` covers only the pure spatial-search function. Anything about
  screens, focus or the router is covered by `npm run test:tv`.
- `npm run apk:release` needs JDK 17, `ANDROID_HOME`, and
  `packaging/fireos-android/local.properties`. Run
  `scripts/setup-toolchain.ps1` (PowerShell, `-ExecutionPolicy Bypass`) to
  install JDK 17 + Android SDK 35 + Gradle 8.11.1 and write `local.properties`.
- **Gradle wrapper is offline-hostile**: the committed `gradlew` only works if
  `gradle-8.11.1-bin.zip` is already in
  `~/.gradle/wrapper/dists/gradle-8.11.1-bin/<hash>/`. Seed it by copying the
  zip there before building.
- `local.properties` must use **forward slashes** (`sdk.dir=C:/Users/...`).
  Backslashes are escape characters in `.properties` and the SDK is not found.
- The release keystore (`packaging/fireos-android/cookcue.keystore`) is not
  committed. Without it the release build still succeeds but is **unsigned** —
  use the debug APK.

## The focus engine (hand-rolled, `src/tv/focus/`)

There is no TV/focus library and no router library. The engine is
`spatial.js` (pure directional search) + `FocusProvider.jsx` (owner of the
focused id) + `FocusScope.jsx` (per-screen placement/restore) +
`useFocusable.js` (registration). Do not add a focus or routing dependency to
replace it.

Rules that are easy to break:

- **Focus ids must be unique across the whole app.** They are also the focus
  restore key. Two home rows both had `home-tile-<recipeId>` at one point —
  the id has to include the row (`home-tile-<rowId>-<recipeId>`).
- **The focus context value must stay referentially stable.** It is memoised;
  if it changes on every registration, each focusable re-registers forever.
- **The visible focus ring is `data-focus-active="true"`**, not
  `:focus-visible` — focus is moved by script, so `:focus-visible` is
  unreliable.
- **Arrow keys are handled in the capture phase** with `preventDefault()`,
  otherwise the Fire OS WebView's own spatial navigation fights ours.
- **Screens render focusables after their data arrives.** `FocusScope`
  subscribes to the registry and re-applies focus; late registrations must
  never steal focus from the element the user is on.
- A screen that can return to an item must pass `initialFocusId` to
  `FocusScope` so Back lands on the same item.

## Routing and Back

`src/app/router.jsx` is a stack router; the stack is
`home -> details -> ingredients -> cooking -> completion`. It stores the
focused id per stack entry, so Back restores focus automatically.

Back has a single entry point, `src/tv/back.js` (a handler **stack** — a
modal pushes its own handler so Back closes the modal first). The native
Android Back button arrives via `window.cookcue.handleBack()`; in a desktop
browser the Escape key stands in. Both funnel through `requestBack()`.

In cooking mode Back goes to the ingredients screen and **pauses the timer**.

## Data seam

Screens only ever use contract shapes from `src/contracts/`
(`recipes.js`, `timers.js`, `session.js` — JSDoc typedefs).

`src/services/servicesRegistry.js` is the **only** place that decides where
data comes from:

```js
import { setServiceImplementation } from './services/servicesRegistry.js'
setServiceImplementation('recipes', realRecipeService)
```

Do not call a service module directly from a screen, and do not duplicate
recipe/ingredient logic inside a screen. The bundled data in `src/data/` is
sample data and the header shows a **Sample data** pill
(`DATA_SOURCE_LABEL`) while it is in use.

The recipe engine (Person 2) lives on `main` as `src/data/recipes.json` +
`src/utils/ingredients.js` + `src/utils/substitutions.js`. It plugs in through
the switch above — it does not belong inside `src/screens/`.

## Fire OS packaging (`packaging/fireos-android/`)

One Activity, one WebView. `WebViewAssetLoader` serves the web build from
`https://appassets.androidplatform.net/assets/www/index.html`.

- **`base: './'` in `vite.config.js` is mandatory** — the bundle is loaded
  from a sub-path. Changing it breaks the APK.
- `build.target: 'es2019'` because Fire TV WebViews are not always current.
- The Gradle `copyWebAssets` task copies `dist/` into
  `app/src/main/assets/www/`. That folder is generated — never commit it
  (it is gitignored, and ESLint is configured to ignore it along with the
  Gradle build dirs).
- No Google Play Services: Fire OS does not ship them. Dependencies are only
  `androidx.appcompat` + `androidx.webkit`.
- Android Back is bridged with `evaluateJavascript("window.cookcue.handleBack()")`.
  The JS side must expose `window.cookcue.handleBack` or Back silently dies.

## Tests

`scripts/tv-smoke-test.mjs` is the safety net for the TV behaviour. It reads
the DOM, so it is coupled to the markup:

- Screen titles are found by class: `.hero__title`, `.details__title`,
  `.ingredients__title`, `.cooking__title`, `.done__title`. **Renaming these
  breaks the test.**
- Other classes it depends on: `.tile`, `.tile__title`, `.ing-row`,
  `.ing-row--missing`, `.badge`, `.timer__digits`, `.timer__label`,
  `.cooking__counter`, `.cooking__bar-fill`.
- Focus is asserted through `[data-focus-active="true"]` and
  `[data-focus-id]`.
- A `console.error` or an uncaught exception fails the last check. `console.log`
  is fine.
- Add checks with `check(name, condition, detail)` inside `runChecks()`.

`tests/spatial.test.mjs` uses `node:test` + `node:assert/strict` and imports
the source directly — keep `spatial.js` free of DOM and React imports.

## Git

- The work lives on the **`frontend`** branch (pushed to
  `github.com/saivignesh22/amazonhack`). `main` is the teammate's — do not
  push to it, and do not rebase `frontend` onto it without being asked.
- Ask before committing or pushing; the team convention so far has been
  commit locally first, then push a branch.
- `frontend` and the upstream open-source PR
  ([bamlab/react-tv-space-navigation#229](https://github.com/bamlab/react-tv-space-navigation/pull/229))
  implement the same focus-restore mechanism. Keep them in sync conceptually;
  the upstream one is opt-in (`restoreFocus` prop, default off).

## Docs to keep current

`docs/DEVICE_TEST.md` (on-device checklist), `docs/DEMO_SCRIPT.md`,
`docs/PRODUCT_FEEDBACK.md`, `docs/FRICTION_LOG.md`. The README carries a
"what is verified vs device pending" table — **only claim what has actually
been run**. On-device behaviour (install, real remote key codes, old Fire OS)
is still unverified.
