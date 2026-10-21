import { ServicesContext } from './ServicesContext.js'
import { getServices } from './servicesRegistry.js'

export function ServicesProvider({ children }) {
  return <ServicesContext.Provider value={getServices()}>{children}</ServicesContext.Provider>
}
