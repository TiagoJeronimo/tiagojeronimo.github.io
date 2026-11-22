import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Four pages: the front page with everything on it, the CV at /cv/, and the two games, at /games/island/ and
// /games/castle/. Each page is a folder here with an `index.html` in it, and its address is that folder's; the code of the
// games is in `src/games/`, in folders of the same names.
export default defineConfig({
  plugins: [react()],
  build: { rolldownOptions: { input: { main: 'index.html', cv: 'cv/index.html', island: 'games/island/index.html', castle: 'games/castle/index.html', sheep: 'games/sheep/index.html' } } },
})
