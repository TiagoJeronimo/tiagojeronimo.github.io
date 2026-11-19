import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../posthog.ts'
import '@fontsource-variable/bricolage-grotesque'
import '../../base.css'
import './game.css'
import GamePage from './GamePage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GamePage />
  </StrictMode>,
)
