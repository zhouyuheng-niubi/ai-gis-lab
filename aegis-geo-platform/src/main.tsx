import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AegisProvider } from './store/AegisContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AegisProvider>
      <App />
    </AegisProvider>
  </StrictMode>,
)
