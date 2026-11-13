import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import '../index.css'
import './game.css'
import GamePage from './GamePage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GamePage />
  </StrictMode>,
)
