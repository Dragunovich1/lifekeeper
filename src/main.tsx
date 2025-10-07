import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AppDataProvider } from './context/AppDataContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
    <SpeedInsights />
  </StrictMode>,
)
