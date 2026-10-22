# Demo script — three minutes

Two versions: the **device demo** (Fire TV, the real thing) and the
**browser demo** (what to show if the sideload does not work). Say which one
you are running. The clock is a guide: if you run out of time, keep the
ingredient → recommendation → cooking → history path and skip the dish search.

---

## Before you start

- Fire TV: the app is installed and the TV is on the home screen.
- Browser: `npm run dev`, a 1920x1080 window, the page focused.
- The header shows **TheMealDB** — say so out loud: it is the real recipe
  catalogue (a committed snapshot, no key), and photos are real dish photos.
- If typing on stage is risky, use the **Quick add** row: it needs no keyboard.

---

## 0:00 — The problem (20 seconds)

> "You want to cook something. You are on the sofa with a phone in one hand and
> a screen in front of you, and the recipe is 14 steps long. CookCue turns that
> into one step at a time, on the big screen, hands free."

---

## 0:20 — What's in your kitchen (35 seconds)

*Focus is on the ingredient field.*

> "This is the first screen, and it starts with a question: what is in your
> kitchen today?"

**Action:** on the Fire TV, press Select to raise the keyboard and type
`potatoes, onions, eggs`. In the browser demo, or if the keyboard misbehaves,
press Down and use **Quick add** with the D-pad only. Select a chip to show it
can be removed, then add it again.

> "Everything on this screen works with the D-pad. The quick-add row means you
> never have to type a letter on a remote if you don't want to."

**Action:** Down → **Find recipes**, Select.

> "These are the recipes you can actually cook now, best match first. Every card
> has a real photo of the dish, the time, and how much of it is already in your
> kitchen — what you have and what is missing."

**Action:** D-pad right along the row, then Down to the dish search.

> "And if you already know what you want, ask for it by name."

**Action:** type `apple crumble` (or use the on-screen keyboard), Select.

> "It shows the dish, what you have and what you are missing, and a swap when
> the recipe engine knows one. Your ingredient list is still there underneath."

---

## 1:00 — Recipe details (20 seconds)

**Action:** Select on **Open recipe**.

> "Everything about the dish: time, difficulty when the source publishes it,
> how many it serves, what you need, and the plan — the steps before you start."

**Action:** D-pad right (now on **Check my kitchen**).

> "Two ways in. Start cooking, or check the kitchen first."

---

## 1:20 — Kitchen check (35 seconds)

**Action:** Select.

> "This is the part that makes it useful. We know what is in your kitchen, so
> the things you are missing are flagged, and each one can have a swap —
> tinned tomatoes for fresh, garlic powder for a clove."

**Action:** D-pad down to a missing item, Select. The badge flips to
**In your kitchen** and the counter goes up.

> "Pressed once, because you did buy the tomatoes on the way home. The counter
> updates as you go."

---

## 1:55 — Cooking mode (40 seconds)

**Action:** D-pad right until **Start cooking**, Select.

> "One step at a time. Big text, because you are looking at it from the sofa.
> The timer is right here — it counts down on its own."

**Action:** Point out the timer counting down. D-pad right to **Next step**,
Select.

> "Next step. The progress bar tracks where you are in the recipe."

**Action:** D-pad left to **Repeat step** — do not press it, just show it. Then
press **Back**.

> "Back pauses the timer rather than losing it, so you can go and check
> something without losing your place."

---

## 2:35 — Completion and history (20 seconds)

**Action:** Finish the last step. The completion screen appears.

> "When the last step is done you get the summary — and it is written into your
> cooking history."

**Action:** **Back to home**, then D-pad down through the rows to
**Your cooking history**.

> "The dish is at the bottom of the home screen, with its photo and the date.
> Newest first, one entry per recipe, and Select opens it again. It survives a
> restart because it is stored on the device."

---

## 2:55 — Close (20 seconds)

> "CookCue is a React app running in a small native Fire OS shell — one
> Activity, one WebView, the web build packed into the APK. The focus engine
> and the D-pad handling are ours, no TV framework. Recipes, matching, timers
> and history sit behind contracts, so they can be swapped without touching a
> screen."

---

## Questions to expect

| Question | Answer |
| --- | --- |
| "Does it work on my Fire TV?" | The APK is built, signed and verified by the build tooling; installing it on a real device is the last step and is tracked in `docs/DEVICE_TEST.md`. |
| "How do you handle focus?" | A hand-rolled spatial navigation engine: the nearest band in the pressed direction, unit tested, and driven end to end by an automated remote-control test. |
| "Is the recipe data real?" | Yes. It is a committed snapshot of TheMealDB (790 meals, no API key) with a live lookup for dishes outside it. The header shows the source. |
| "Are the photos real?" | Yes — one real photo of each dish, licensed and credited in `public/recipes/ATTRIBUTION.md`. No invented URLs, no placeholder image reused for every card. |
| "Where does the cooking history live?" | On the device, in `localStorage`, behind a storage adapter. It survives a restart and can be swapped for a backend without touching a screen. |
| "What about the timer on a real device?" | The timer is a service with start/pause/resume and a subscription; the alert is both visual and audible. |
