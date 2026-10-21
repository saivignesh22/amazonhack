# Demo script — under three minutes

Two versions: the **device demo** (Fire TV, the real thing) and the
**browser demo** (what to show if the sideload does not work). Say which one
you are running.

---

## Before you start

- Fire TV: the app is installed and the TV is on the home screen.
- Browser: `npm run dev`, a 1920x1080 window, the page focused.
- Sample data is loaded (the header shows the **Sample data** pill — say so out
  loud, it is honest and it explains the next part).

---

## 0:00 — The problem (20 seconds)

> "You want to cook something. You are on the sofa with a phone in one hand and
> a screen in front of you, and the recipe is 14 steps long. CookCue turns that
> into one step at a time, on the big screen, hands free."

---

## 0:20 — Home (30 seconds)

*Focus is on the first tile. Do not move it yet.*

> "Three rows. The first is recommended for tonight. The second is anything
> under thirty minutes. The third is built from what is already in your
> kitchen."

**Action:** D-pad right twice → down → up → left.

> "Everything is driven by the D-pad. There is no pointer, no hover, no tiny
> targets."

---

## 0:50 — Recipe details (25 seconds)

**Action:** Select on the first tile.

> "Everything about the dish: time, difficulty, how many it serves, what you
> need, and the plan — the steps before you start them."

**Action:** D-pad right (now on **Check my kitchen**).

> "Two ways in. Start cooking, or check the kitchen first."

---

## 1:15 — Kitchen check (40 seconds)

**Action:** Select.

> "This is the part that makes it useful. We know what is in your kitchen, so
> the three things you are missing are flagged, and each one has a swap —
> tinned tomatoes for fresh, garlic powder for a clove."

**Action:** D-pad down to a missing item, Select. The badge flips to
**In your kitchen** and the counter goes up.

> "Pressed once, because you did buy the tomatoes on the way home. The counter
> updates as you go."

---

## 1:55 — Cooking mode (50 seconds)

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

## 2:45 — Where it goes (15 seconds)

*Optional: if a timer is set to finish while you are on the cooking screen,
let the alert overlay appear and dismiss it with Select.*

> "When the timer is up, it tells you. Then, when the last step is done —
> this is the completion screen — you get the summary."

---

## 3:00 — Close (20 seconds)

> "CookCue is a React app running in a small native Fire OS shell — one
> Activity, one WebView, the web build packed into the APK. The focus engine
> and the D-pad handling are ours, no TV framework. The recipe data, the
> ingredient matching and the timer service sit behind three contracts, so
> they can be swapped for the real services without touching a screen."

---

## Questions to expect

| Question | Answer |
| --- | --- |
| "Does it work on my Fire TV?" | The APK is built, signed and verified by the build tooling; installing it on a real device is the last step and is tracked in `docs/DEVICE_TEST.md`. |
| "How do you handle focus?" | A hand-rolled spatial navigation engine: nearest item in the pressed direction, unit tested, and driven end to end by an automated remote-control test. |
| "Is the recipe data real?" | No — it is clearly labelled sample data behind a contract, swappable with one line when the real service lands. |
| "What about the timer on a real device?" | The timer is a service with start/pause/resume and a subscription; the alert is both visual and audible. |
