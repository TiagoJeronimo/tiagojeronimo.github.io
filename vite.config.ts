import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Two pages: the site itself, and the little game at /game/.
export default defineConfig({
  plugins: [react()],
  build: { rolldownOptions: { input: { main: 'index.html', game: 'game/index.html' } } },
})
