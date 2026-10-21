// Normalised remote key handling.
//
// Key codes come from the Amazon Fire TV remote (and the Fire TV / Vega
// WebView implementations of it):
//   Select / D-pad centre : 13
//   Up / Down / Left / Right : 38 / 40 / 37 / 39
//   Back                  : 4   (Fire OS remote)
//   GoBack / Escape       : 27  (Vega WebView system key event)
//   Play/Pause, Rewind, FastForward : 179 / 227 / 228

export const KEY = {
  BACK: 4,
  ENTER: 13,
  ESCAPE: 27,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  MEDIA_PLAY_PAUSE: 179,
  MEDIA_REWIND: 227,
  MEDIA_FAST_FORWARD: 228,
}

const KEY_BY_NAME = {
  ArrowLeft: 'left',
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  Enter: 'enter',
  Escape: 'back',
  Backspace: 'back',
  ' ': 'enter',
}

const DIRECTION_BY_CODE = {
  [KEY.LEFT]: 'left',
  [KEY.UP]: 'up',
  [KEY.RIGHT]: 'right',
  [KEY.DOWN]: 'down',
}

/**
 * Resolve a keyboard event to one of: 'left' | 'up' | 'right' | 'down' |
 * 'enter' | 'back' | null.
 */
export function resolveAction(event) {
  if (!event) return null
  const byName = KEY_BY_NAME[event.key]
  if (byName) return byName
  const byCode = DIRECTION_BY_CODE[event.keyCode]
  if (byCode) return byCode
  if (event.keyCode === KEY.ENTER) return 'enter'
  if (event.keyCode === KEY.BACK || event.keyCode === KEY.ESCAPE) return 'back'
  return null
}

export function isDirection(action) {
  return action === 'left' || action === 'up' || action === 'right' || action === 'down'
}
