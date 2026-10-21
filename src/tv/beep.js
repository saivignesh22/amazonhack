/**
 * A short two-tone beep for the timer alert.
 *
 * Uses the Web Audio API so the app ships without any audio assets.
 * Fire devices may block audio until the user interacts — the beep is only
 * a bonus on top of the visual alert, never the only signal.
 */
let context = null

function getContext() {
  if (context) return context
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  context = new Ctor()
  return context
}

export function playAlertBeep() {
  try {
    const ctx = getContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()

    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1)
    gain.connect(ctx.destination)

    const first = ctx.createOscillator()
    first.type = 'sine'
    first.frequency.setValueAtTime(880, now)
    first.connect(gain)
    first.start(now)
    first.stop(now + 0.28)

    const second = ctx.createOscillator()
    second.type = 'sine'
    second.frequency.setValueAtTime(1174, now + 0.32)
    second.connect(gain)
    second.start(now + 0.32)
    second.stop(now + 0.62)
  } catch {
    // Audio is optional; never let it break the cooking flow.
  }
}
