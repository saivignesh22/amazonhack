/**
 * Timer contract — owned by Person 3.
 *
 * The UI never keeps its own countdown: it asks the timer service for the
 * state and re-renders from the subscription. That keeps pause/resume and
 * the "timer finished" alert in one place.
 *
 * @typedef {'idle' | 'running' | 'paused' | 'done'} TimerStatus
 *
 * @typedef {object} TimerState
 * @property {string} id
 * @property {string} label
 * @property {TimerStatus} status
 * @property {number} remainingSeconds
 * @property {number} totalSeconds
 *
 * @typedef {object} Timer
 * @property {string} id
 * @property {string} label
 * @property {() => void} start
 * @property {() => void} pause
 * @property {() => void} resume
 * @property {() => void} stop
 * @property {() => TimerState} getState
 * @property {(listener: (state: TimerState) => void) => () => void} subscribe
 *
 * @typedef {object} TimerService
 * @property {(config: {id: string, label: string, seconds: number}) => Timer} createTimer
 */
export {}
