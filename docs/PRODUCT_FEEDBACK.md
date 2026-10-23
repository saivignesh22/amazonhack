# Product feedback

What we would change if we had another week, and what we deliberately did not
build. Written for the "product feedback" part of the hackathon submission.

---

## What we think the problem actually is

Cookbooks on a TV are a solved problem — the TV shows a video. What is missing
is the **middle** of cooking: the ten minutes where you are holding a pan, the
screen is at the wrong height, and you need to know what is happening *now*.

So the product bet is not "a recipe app for TV". It is:

> A cooking session that you can leave running on the big screen while your
> hands are busy, and that never makes you look at a phone.

Everything else follows from that.

---

## The decisions we would defend

### 1. Start from what you have, not from a catalogue

The first screen is not a list of recipes. It is one question — *what is in your
kitchen today?* — a text field, a quick-add row for the remote, and then the
recipes you can actually cook.

This is the inversion that makes the app useful on a TV. A catalogue asks you to
browse; the kitchen asks you to cook. It also gives the rest of the app
something to be consistent with: the dish search, the per-recipe kitchen check
and the shopping gap all use the same ingredient list.

The cost: the home screen is a form, not a wall of food photography. We think
the trade is right — the photos are on the results, where they answer "what am
I cooking?", not on the way in.

### 2. One step at a time, not a scrolling recipe

A scrolling recipe on a TV means finding your place after every glance. The
cooking screen shows **one** step, as large as it fits, with the step counter
and a progress bar as the only navigation chrome. Previous / Repeat / Next are
three buttons, always in the same place.

The cost: you cannot see the whole recipe while cooking. We think that is
correct — the details screen is one Back away and remembers your place.

### 3. The kitchen check comes before the cooking

Most recipe apps assume you have everything and fail you at the second step.
The kitchen check is an explicit step: it knows your pantry, it flags what is
missing, and it suggests a swap so you can decide *before* you start whether to
shop or to improvise.

The home screen starts that earlier — you tell it what you have before you pick
a dish — and the per-recipe check is the confirmation. Both read the same
ingredient list, so marking "I have it" at home and on the recipe screen can
never disagree.

### 4. Back never loses state

Back from cooking mode pauses the timer and keeps the step. Back to the kitchen
check and then forward again puts you on the same step with the timer paused
where you left it. Back to home restores focus to the tile you opened, and the
ingredient chips are still there — searching a dish, opening a recipe or
cooking never clears the kitchen.

We think "undo" is the most under-rated interaction in TV UIs. People press
Back reflexively; the app should treat it as "I did not mean to leave", not as
"throw the state away".

### 5. Real photos of the actual dish, stored on the device

Every card shows a photo of the dish it is selling, not a stock "cooking"
photo. The photos are committed into the app (400×225, 16:9, cropped once at
build time), so a Fire TV never waits for a CDN and the APK works offline. Each
one carries its source and licence in `public/recipes/ATTRIBUTION.md`.

The cost is APK size — about 15 MB of assets for 800 dishes — and a build step
that has to be re-run when the catalogue changes. Compared with a broken image
on the one screen the user is looking at, that is cheap.

---

## What we would build next

In rough priority order.

### 1. Real device validation (the biggest gap)

Everything has been verified in a desktop browser and in the build tooling.
Nobody has held a Fire TV remote yet. Before anything else, the
`docs/DEVICE_TEST.md` checklist has to be run and the answers recorded.

### 2. Persist the pantry, not just the history

The kitchen chips live only for the session: they survive navigation and
cooking, but not a restart. Cooking history is already persisted. The next step
is a pantry the user owns — staples, quantities, maybe expiry — stored through
the same adapter seam as the history, so the ingredient field becomes a
confirmation instead of a daily retype.

### 3. A second source for the facts TheMealDB does not publish

TheMealDB has no difficulty, servings, nutrition or total time, and the UI says
**Not listed** rather than inventing them. A time is only shown when the step
timers add up to a plausible total, and it is marked **~** so it is never
mistaken for a published fact. That honesty is right, but a second source for
those four fields would make the ranking and the details screen stronger.

### 4. Voice control

A Fire TV without voice control is a strange product. "Next step", "repeat",
and "set a timer for ten minutes" are the three things a cook should be able
to say with wet hands. The Android side would need the Fire TV voice
capability; the web side would need a command surface that is not the
keyboard. The focus engine already centralises input, so this is a matter of
adding another input source to the same place.

### 5. Shopping list

The kitchen check knows what is missing. Turning that into a "shop for these
four things" list is nearly free and closes the loop with the pantry.

### 6. Step photos

Not generated art — one real photo per step. It changes the character of the
app more than any other feature, but it is content work, not engineering, and
we did not have the time.

---

## What we deliberately did not build

| Not built | Why |
| --- | --- |
| An endless carousel | On a TV, a row that never ends is a row you cannot finish. The results row is capped at ten, and fewer results come with an explanation. |
| Voice, Alexa integration, account system | No time; voice is the right next step, not the first one. |
| Nutrition scoring, shopping, social features | Not what makes cooking-on-a-TV better. |
| A backend for the cooking history | `localStorage` behind an adapter is enough for one device, and the seam to replace it is already there. |
| A second theme or a light mode | A TV in a dark kitchen at night does not want a light mode. One warm, dark, high-contrast theme was the right call. |
| Animated backgrounds | Motion in the periphery is distracting while you are reading a step. The only motion is short state transitions (progress bar, meter, focus). |
| A mobile layout | This is a TV app. The phone version would be a different product. |

---

## What we learned building it

- **Focus is a feature, not a detail.** We spent more time on the focus engine
  than on any screen. The bugs that mattered were not visual: focus applied
  before the data rendered, a context value that changed on every registration
  and re-registered everything in a loop, duplicate ids across rows. None of
  those show up in a screenshot; all of them show up the moment someone
  presses a key.
- **Testing a TV app in a browser is possible, and worth it.** Driving the
  real app in headless Chrome over the DevTools Protocol — real key events,
  real focus, real timers — caught every focus bug. It is not the same as a
  device, but it is much closer than clicking around in a normal browser.
- **The "sample data" label was worth it — and so is a real one.** The header
  named the data source from the first day, and it was the single best decision
  for demo honesty. Now that the source is TheMealDB, the same seam
  (`getDataSourceLabel()`) reports that instead: one label, no ambiguity about
  what the screen is showing.
- **Text input is the tax on TV, so design around it.** Typing with a D-pad is
  slow and the soft keyboard is an unknown on device. The quick-add row means
  the entire flow can be demonstrated with zero typing, and Select on the empty
  field is the explicit way to raise the Android keyboard. The comma-separated
  field is still there for anyone who wants it.
- **Eight hundred real photos are a pipeline, not a folder.** Crop to 16:9,
  compress, write a manifest with provider/source/licence, commit the files,
  lazy-load them, and add a test that every referenced file exists. Without the
  manifest test the first missing image is found by a user on a TV.
