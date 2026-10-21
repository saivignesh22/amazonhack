import { mockRecipeService } from './mock/recipeService.js'
import { mockTimerService } from './mock/timerService.js'
import { mockSessionService } from './mock/sessionService.js'

/**
 * The one switch that decides where the app gets its data.
 *
 * To move from the bundled sample data to the real services (Person 2 / 3),
 * replace the implementation below — no screen code changes, because screens
 * only ever use the contract shapes.
 *
 *   import { setServiceImplementation } from './services/servicesRegistry.js'
 *   setServiceImplementation('recipes', realRecipeService)
 */
const implementations = {
  recipes: mockRecipeService,
  timers: mockTimerService,
  session: mockSessionService,
}

/** Label shown in the UI so it is obvious the app runs on sample data. */
export const DATA_SOURCE_LABEL = 'Sample data'

export function getServices() {
  return implementations
}

export function setServiceImplementation(name, implementation) {
  if (!(name in implementations)) {
    throw new Error(`Unknown service: ${name}`)
  }
  implementations[name] = implementation
  return implementations
}
