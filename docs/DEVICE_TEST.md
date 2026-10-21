# Device test checklist

Everything in this document is **device pending** until someone runs it on real
hardware. The automated checks in `npm run test:tv` cover the app logic in a
desktop browser; they do not prove anything about Fire OS.

---

## 1. Prepare the device

### Option A — Fire TV Stick / Fire TV (recommended)

1. On the TV: **Settings → My Fire TV → Developer Options**
   - `ADB debugging` → **On**
   - `Apps from Unknown Sources` → **On** (per app, or enable
     "Unknown Sources" in the app settings)
   - Note the IP address shown on the screen.
2. From the development machine:

   ```bash
   adb connect 192.168.x.x:5555
   adb devices          # the device must be listed as "device"
   ```

### Option B — Fire TV Edition (large screen)

Same steps, but the developer options live under
**Settings → My Fire TV → Developer Options**.

### No device to hand?

Amazon's Fire TV emulator only runs on macOS, so it is not an option for a
Windows build machine. The checklist below then stays **device pending** and
the demo runs from `npm run dev` in a 1920x1080 browser window with a
keyboard.

---

## 2. Install

```bash
cd packaging/fireos-android
adb install -r app/build/outputs/apk/release/app-release.apk
```

Expected output:

```
Performing Streamed Install
Success
```

If it fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the device has a
different signature for the same package — uninstall first:

```bash
adb uninstall com.cookcue.firetv
```

---

## 3. Launch

The app should appear on the Fire TV home screen row as **CookCue** with the
orange flame banner (the 320x180 banner we generated).

```bash
adb shell am start -n com.cookcue.firetv/.MainActivity
```

Useful while debugging:

```bash
adb logcat -s CookCue        # console messages from the web app
adb logcat | findstr WebView # webview errors
```

---

## 4. The checklist

Tick each row when it passes on the device.

### Launch and shell

- [ ] The app opens from the Fire TV home screen.
- [ ] The screen is full 1080p with no system bars and no scaling artefacts.
- [ ] The launch background is dark, not white (no white flash before the app paints).
- [ ] The screen never sleeps during a recipe (`FLAG_KEEP_SCREEN_ON`).
- [ ] Nothing is cut off at the edges — check the long recipe title
      *Sheet-Pan Lemon Chicken* and the ingredient list.

### Home

- [ ] Three rows of recipes render: recommended, quick, "uses what you have".
- [ ] The first tile has a visible focus ring.
- [ ] D-pad left/right moves along the row.
- [ ] D-pad up/down moves between rows.
- [ ] The focused tile scrolls into view when it is at the edge of a row.
- [ ] The focus ring is clearly visible against every tile background.

### Recipe details

- [ ] Select opens the recipe details.
- [ ] Focus lands on **Start cooking**.
- [ ] D-pad right moves to **Check my kitchen**, then **Back to home**.
- [ ] The ingredient list and the plan are both readable without scrolling.

### Kitchen check

- [ ] **Check my kitchen** opens the ingredient list.
- [ ] Focus lands on the first ingredient row.
- [ ] Select on a missing item marks it as "In your kitchen" and the counter updates.
- [ ] The suggested swap is readable for a missing item.
- [ ] **Start cooking** is reachable with the D-pad.

### Cooking mode

- [ ] The first step shows a big timer that counts down.
- [ ] The step counter shows "Step 1 of N".
- [ ] **Next step** advances; the counter and the progress bar update.
- [ ] **Previous** goes back a step.
- [ ] **Repeat step** restarts the step and its timer.
- [ ] **Pause** / **Resume** / **Reset** all work on the timer.
- [ ] When a timer finishes, the alert overlay appears, the focus moves to
      **Got it**, and the beep is audible (if the device allows it).
- [ ] Back inside cooking mode dismisses the alert first, then leaves the screen.
- [ ] Leaving cooking mode with Back pauses the timer; returning shows it paused.

### Back behaviour

- [ ] Back from cooking goes to the kitchen check.
- [ ] Back from the kitchen check goes to the recipe details.
- [ ] Back from the details goes home.
- [ ] Back on home closes the app (the platform takes over).
- [ ] Focus returns to the tile that was opened, not to the top of the screen.

### Completion

- [ ] The last step's **Finish** shows the completion screen.
- [ ] The summary shows time, steps, ingredients and difficulty.
- [ ] **Cook it again** restarts the recipe from step 1.
- [ ] **Back to home** returns to the home screen with focus on the first tile.

---

## 5. Known risks on device

| Risk | What to check |
| --- | --- |
| The Fire OS WebView may implement its own spatial navigation, which would fight ours. The engine calls `preventDefault()` in the capture phase to win. | Arrow keys move exactly one item per press, with no double movement. |
| The Android Back button may be delivered to the WebView instead of the Activity. The Activity intercepts it via `OnBackPressedDispatcher` and calls `window.cookcue.handleBack()`. | Back always unwinds one screen, never exits the app from a detail screen. |
| Audio may be blocked until the first user interaction. The beep is a bonus; the visual alert is the real signal. | The alert overlay appears even with no sound. |
| Older Fire OS (5/6) ships an older WebView. | `minSdk 21` is set, but check the layout on an older device if one is available. |

---

## 6. Report

Note the device model, Fire OS version, WebView version
(**Settings → My Fire TV → About** or `adb shell dumpsys package com.google.android.webview`),
and which checklist rows failed. Add it to
[`docs/FRICTION_LOG.md`](FRICTION_LOG.md) if the tooling got in the way.
