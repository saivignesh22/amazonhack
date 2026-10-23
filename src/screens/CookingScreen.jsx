import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from '../app/routerContext.js'
import { useServices } from '../services/ServicesContext.js'
import { getCookingSession, getStepTimer } from '../app/cookingState.js'
import { FocusScope } from '../tv/focus/FocusScope.jsx'
import { AppHeader } from '../components/AppHeader.jsx'
import { Button } from '../components/Button.jsx'
import { playAlertBeep } from '../tv/beep.js'
import { pushBackHandler } from '../tv/back.js'

function formatTime(seconds) {
  const safe = Math.max(0, Math.round(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function CookingScreen({ params, restoreFocusId }) {
  const { recipes: recipeService, timers: timerService, session: sessionService } = useServices()
  const { navigate } = useRouter()

  const [recipe, setRecipe] = useState(null)
  const [sessionState, setSessionState] = useState(null)
  const [timerState, setTimerState] = useState(null)
  const [alertOpen, setAlertOpen] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    let alive = true
    recipeService.getRecipe(params.id).then((result) => {
      if (alive) setRecipe(result)
    })
    return () => {
      alive = false
    }
  }, [recipeService, params.id])

  // The session survives screen changes, so "step 3 of 5" is still there
  // after the user backs out to the ingredient list.
  useEffect(() => {
    if (!recipe) return undefined
    const session = getCookingSession(sessionService, recipe)
    return session.subscribe(setSessionState)
  }, [recipe, sessionService])

  const stepIndex = sessionState ? sessionState.stepIndex : 0
  const total = recipe ? recipe.steps.length : 0
  const step = recipe ? recipe.steps[stepIndex] : null

  useEffect(() => {
    if (!recipe || !step) return

    const narration = [
      step.title,
      step.text,
      step.tip ? `Chef tip: ${step.tip}` : ''
    ]
      .filter(Boolean)
      .join('. ')

    window.AndroidVoice?.speak(narration)

    return () => {
      window.AndroidVoice?.stop()
    }
  }, [recipe, stepIndex])

  useEffect(() => {
    if (!recipe || !step) return undefined

    const timer = getStepTimer(timerService, recipe.id, step)
    timerRef.current = timer
    if (!timer) return undefined

    
    const unsubscribe = timer.subscribe((state) => {
      setTimerState(state)
      if (state.status === 'done') {
        setAlertOpen(true)
        playAlertBeep()
      }
    })


    return () => {
      unsubscribe()
      // Leaving this step (or the screen) pauses the timer instead of
      // letting it run on unseen.
      if (timer.getState().status === 'running') timer.pause()
    }
  }, [recipe, step, timerService])

  const progress = total ? (stepIndex + 1) / total : 0

  const session = useMemo(() => (recipe ? getCookingSession(sessionService, recipe) : null), [recipe, sessionService])

  const goNext = () => {
    if (!session) return
    if (stepIndex >= total - 1) {
      navigate('completion', { id: recipe.id })
      return
    }
    session.next()
  }

  const repeatStep = () => {
    if (!session) return

    session.repeat()

    const narration = [
      step.title,
      step.text,
      step.tip ? `Chef tip: ${step.tip}` : ''
    ]
      .filter(Boolean)
      .join('. ')

    window.AndroidVoice?.speak(narration)

    const timer = timerRef.current
    if (timer) {
      timer.stop()
    }
  }


  const dismissAlert = () => {
    setAlertOpen(false)
    const timer = timerRef.current
    if (timer && timer.getState().status === 'done') timer.stop()
  }

  // While the alert is up, Back dismisses it instead of leaving the screen.
  useEffect(() => {
    if (!alertOpen) return undefined
    return pushBackHandler(() => {
      dismissAlert()
      return true
    })
  }, [alertOpen])

  if (!recipe || !step) {
    return (
      <div className="screen">
        <AppHeader />
        <div className="screen__body">
          <p className="muted">Getting the recipe ready…</p>
        </div>
      </div>
    )
  }

  const timerStatus = timerState ? timerState.status : null
  // A step without a timer never shows the timer panel, even if the previous
  // step had one.
  const visibleTimerState = step && step.timer ? timerState : null

  return (
    <FocusScope
      initialFocusId={restoreFocusId}
      defaultFocusId={`cook-next-${recipe.id}`}
    >
      <div className="screen screen--cooking">
        <AppHeader right={<span className="pill pill--ember">{recipe.title}</span>} />

        <div className="cooking">
          <div className="cooking__main">
            <div className="cooking__progress">
              <span className="cooking__counter">
                Step {stepIndex + 1} of {total}
              </span>
              <span className="cooking__bar">
                <span className="cooking__bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
              </span>
            </div>

            <h1 className="cooking__title">{step.title}</h1>
            <p className="cooking__text">{step.text}</p>

            {step.tip ? (
              <div className="cooking__tip">
                <span className="cooking__tip-label">Chef tip</span>
                <p className="cooking__tip-text">{step.tip}</p>
              </div>
            ) : null}
          </div>

          <aside className="cooking__side">
            <div className={`panel panel--timer timer--${timerStatus || 'none'}`}>
              <p className="panel__title">Timer</p>
              {visibleTimerState ? (
                <>
                  <p className="timer__digits">{formatTime(visibleTimerState.remainingSeconds)}</p>
                  <p className="timer__label">
                    {visibleTimerState.label} · {timerStatus}
                  </p>
                  <div className="timer__controls">
                    <Button
                      id={`cook-timer-toggle-${recipe.id}`}
                      onSelect={() => {
                        const timer = timerRef.current
                        if (!timer) return
                        if (timer.getState().status === 'running') timer.pause()
                        else if (timer.getState().status === 'paused') timer.resume()
                        else timer.start()
                      }}
                    >
                      {timerStatus === 'running' ? 'Pause' : timerStatus === 'paused' ? 'Resume' : 'Start'}
                    </Button>
                    <Button
                      id={`cook-timer-reset-${recipe.id}`}
                      onSelect={() => {
                        const timer = timerRef.current
                        if (timer) timer.stop()
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </>
              ) : (
                <p className="timer__none">No timer needed for this step.</p>
              )}
            </div>

            <div className="panel panel--hint">
              <p className="panel__title">Up next</p>
              <p className="upnext__text">
                {stepIndex < total - 1 ? recipe.steps[stepIndex + 1].title : 'Serve and enjoy'}
              </p>
              {step.minutes ? <p className="upnext__time">About {step.minutes} min</p> : null}
            </div>
          </aside>
        </div>

        <div className="cooking__actions">
          <Button
            id={`cook-prev-${recipe.id}`}
            disabled={stepIndex === 0}
            onSelect={() => session.previous()}
          >
            Previous
          </Button>
          <Button id={`cook-repeat-${recipe.id}`} onSelect={repeatStep}>
            Repeat step
          </Button>
          <Button id={`cook-next-${recipe.id}`} variant="primary" onSelect={goNext}>
            {stepIndex >= total - 1 ? 'Finish' : 'Next step'}
          </Button>
        </div>

        {alertOpen ? (
          <div className="alert" role="alertdialog" aria-live="assertive">
            <div className="alert__card">
              <p className="alert__eyebrow">Timer finished</p>
              <p className="alert__title">{timerState ? timerState.label : 'Timer'}</p>
              <p className="alert__sub">Time to check the pan.</p>
              <FocusScope defaultFocusId={`cook-alert-dismiss-${recipe.id}`}>
                <Button
                  id={`cook-alert-dismiss-${recipe.id}`}
                  variant="primary"
                  onSelect={dismissAlert}
                >
                  Got it
                </Button>
              </FocusScope>
            </div>
          </div>
        ) : null}
      </div>
    </FocusScope>
  )
}
