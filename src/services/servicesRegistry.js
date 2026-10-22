import { createHistoryService } from './history/historyService.js'
import { mockSessionService } from './mock/sessionService.js'
import { mockTimerService } from './mock/timerService.js'
import { themealdbRecipeService } from './themealdbRecipeService.js'

/**
 * The one switch that decides where the app gets its data.
 *
 * Screens only ever use the contract shapes in src/contracts/, so swapping an
 * implementation needs no screen changes:
 *
 *   import { setServiceImplementation } from './services/servicesRegistry.js'
 *   import { recipeEngineService } from './recipeEngineAdapter.js'
 *   setServiceImplementation('recipes', recipeEngineService)
 *
 * Available recipe implementations:
 *   - themealdbRecipeService  TheMealDB catalogue (790 meals, default)
 *   - recipeEngineService     the team's own engine (src/data/recipes.json)
 *   - mockRecipeService       the bundled hand-written sample recipes
 *
 * timers + session are still the mock implementations until Person 3 lands.
 */
const implementations = {
  recipes: themealdbRecipeService,
  timers: mockTimerService,
  session: mockSessionService,
  history: createHistoryService(),
}

export function getServices() {
  return implementations
}

/** Label for the active data source, shown in the header. */
export function getDataSourceLabel() {
  return implementations.recipes?.dataSourceLabel || 'Sample data'
}

export function setServiceImplementation(name, implementation) {
  if (!(name in implementations)) {
    throw new Error(`Unknown service: ${name}`)
  }
  implementations[name] = implementation
  return implementations
}
