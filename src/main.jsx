import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode is intentionally left off: its double-invoked effects make the
// focus engine restore focus twice on mount, which is confusing on a TV.
createRoot(document.getElementById('root')).render(<App />)
