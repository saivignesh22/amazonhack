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

## The three decisions we would defend

### 1. One step at a time, not a scrolling recipe

A scrolling recipe on a TV means finding your place after every glance. The
cooking screen shows **one** step, as large as it fits, with the step counter
and a progress bar as the only navigation chrome. Previous / Repeat / Next are
three buttons, always in the same place.

The cost: you cannot see the whole recipe while cooking. We think that is
correct — the details screen is one Back away and remembers your place.

### 2. The kitchen check comes before the cooking

Most recipe apps assume you have everything and fail you at the second step.
The kitchen check is a separate, explicit screen: it knows your pantry, it
flags what is missing, and it suggests a swap so you can decide *before* you
start whether to shop or to improvise.

It is also the screen that justifies the app existing at all — a recipe app
that cannot tell you that you are missing the only ingredient that matters is
just a text file on a big screen.

### 3. Back never loses state

Back from cooking mode pauses the timer and keeps the step. Back to the kitchen
check and then forward again puts you on the same step with the timer paused
where you left it. Back to home restores focus to the tile you opened.

We think "undo" is the most under-rated interaction in TV UIs. People press
Back reflexively; the app should treat it as "I did not mean to leave", not as
"throw the state away".

---

## What we would build next

In rough priority order.

### 1. Real device validation (the biggest gap)

Everything has been verified in a desktop browser and in the build tooling.
Nobody has held a Fire TV remote yet. Before anything else, the
`docs/DEVICE_TEST.md` checklist has to be run and the answers recorded.

### 2. A pantry that the user controls

Right now the pantry is sample data. The obvious next step is a screen where
you tick off what you have, and the ingredient matching uses *that* instead of
a fixed list. The matching contract already supports it — the report is
computed from a service, not from the UI.

### 3. Voice control

A Fire TV without voice control is a strange product. "Next step", "repeat",
and "set a timer for ten minutes" are the three things a cook should be able
to say with wet hands. The Android side would need the Fire TV voice
capability; the web side would need a command surface that is not the
keyboard. The focus engine already centralises input, so this is a matter of
adding another input source to the same place.

### 4. Shopping list

The kitchen check knows what is missing. Turning that into a "shop for these
four things" list is nearly free and closes the loop with the pantry.

### 5. Step photos

Not generated art — one real photo per step. It changes the character of the
app more than any other feature, but it is content work, not engineering, and
we did not have the time.

---

## What we deliberately did not build

| Not built | Why |
| --- | --- |
| A carousel with infinite scroll | On a TV, a row that never ends is a row you cannot finish. Three rows, each with a clear reason. |
| Voice, Alexa integration, account system | No time; voice is the right next step, not the first one. |
| Nutrition scoring, shopping, social features | Not what makes cooking-on-a-TV better. |
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
- **The "sample data" label was worth it.** The header shows a **Sample data**
  pill. When the real services land, that pill is the only thing that needs to
  change, and nobody is ever misled about what the app is showing.
