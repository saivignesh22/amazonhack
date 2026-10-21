// Single entry point for "the user pressed Back".
//
// The Fire OS WebView wrapper intercepts the Android hardware Back button
// before the page sees it, so it calls window.cookcue.handleBack() from the
// native side. Inside the browser (development) the Escape key reaches us
// directly. Both funnel through requestBack() so the behaviour is identical.
//
// Handlers are a stack: a modal (the timer alert) pushes its own handler so
// Back dismisses the modal instead of leaving the screen behind it.

const handlers = []

export function pushBackHandler(fn) {
  handlers.push(fn)
  return () => {
    const index = handlers.indexOf(fn)
    if (index >= 0) handlers.splice(index, 1)
  }
}

export function setBackHandler(fn) {
  return pushBackHandler(fn)
}

/**
 * Ask the app to handle a Back press.
 * @returns {boolean} true when the app consumed the event, false when the
 * platform should close the app.
 */
export function requestBack() {
  const handler = handlers[handlers.length - 1]
  if (!handler) return false
  try {
    return Boolean(handler())
  } catch {
    return false
  }
}
