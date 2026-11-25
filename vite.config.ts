import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
// The ✎ button on every page of the dev server: click a spot, type a note, and it lands in `.notes/` for Claude.
// Development only (the plugin applies to `vite serve`), so nothing of it reaches the published site.
import debugPins from 'ai-debug-pins'

// Four pages: the front page with everything on it, the CV at /cv/, and the two games, at /games/island/ and
// /games/castle/. Each page is a folder here with an `index.html` in it, and its address is that folder's; the code of the
// games is in `src/games/`, in folders of the same names.
export default defineConfig(({ mode }) => {
  // A `VITE_` value is written into the pages for anybody to read. Stripe's publishable key is made for that; its
  // secret and restricted keys are not, and a slip of the paste would publish one: so the build refuses them.
  if (/^(sk|rk)_/.test(loadEnv(mode, process.cwd(), 'VITE_').VITE_STRIPE_PUBLISHABLE ?? '')) throw new Error('VITE_STRIPE_PUBLISHABLE must be the publishable key (pk_...), never a secret one')
  // A published build without the shop's two settings would quietly turn the buying card into the make-believe one
  // (nothing charged, the sheep kept in the visitor's browser). The publish says so and stops instead.
  if (process.env.GITHUB_ACTIONS) {
    const shop = loadEnv(mode, process.cwd(), 'VITE_')
    if (!shop.VITE_SHEEP_API || !shop.VITE_STRIPE_PUBLISHABLE) throw new Error('VITE_SHEEP_API and VITE_STRIPE_PUBLISHABLE must be set for the published build (GitHub: Settings, Secrets and variables, Variables)')
  }
  return {
    plugins: [react(), debugPins()],
    build: { rolldownOptions: { input: { main: 'index.html', cv: 'cv/index.html', island: 'games/island/index.html', castle: 'games/castle/index.html', sheep: 'games/sheep/index.html' } } },
  }
})
