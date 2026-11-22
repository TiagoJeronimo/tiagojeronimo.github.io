import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../posthog.ts'
import '@fontsource-variable/bricolage-grotesque'
import '../../base.css'
import './sheep.css'
import SheepPage from './SheepPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SheepPage />
  </StrictMode>,
)
