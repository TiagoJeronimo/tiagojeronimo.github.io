import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Four pages: the front page with everything on it, the CV at /cv/, the little game at /game/, and the castle at /castle/.
export default defineConfig({
  plugins: [react()],
  build: { rolldownOptions: { input: { main: 'index.html', cv: 'cv/index.html', game: 'game/index.html', castle: 'castle/index.html' } } },
})
