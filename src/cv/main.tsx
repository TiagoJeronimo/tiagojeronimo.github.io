import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import '../base.css'
import './cv.css'
import Cv from './Cv.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Cv />
  </StrictMode>,
)
