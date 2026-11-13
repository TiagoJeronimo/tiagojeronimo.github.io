import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Three pages: the front page with everything on it, the CV at /cv/, and the little game at /game/.
export default defineConfig({
  plugins: [react()],
  build: { rolldownOptions: { input: { main: 'index.html', cv: 'cv/index.html', game: 'game/index.html' } } },
})
