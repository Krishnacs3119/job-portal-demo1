import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Ensure light mode is strictly enforced and any legacy stored theme is cleared
if (typeof document !== 'undefined') {
  document.documentElement.classList.remove('dark')
  try {
    localStorage.removeItem('theme')
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
