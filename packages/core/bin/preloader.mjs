/**
 * Preloader for heavy Node.js modules.
 *
 * Loaded via `node --import ./preloader.mjs` in the CLI shebang.
 * Runs *before* the CLI entry point so that dynamic imports of
 * Vite, React, and plugins resolve instantly from the warmed module
 * cache.
 *
 * NOTE: @vitejs/plugin-react v6+ uses Oxc (not Babel), so it is
 * significantly lighter than v5.  We still warm it because it is
 * imported by createViteConfig.
 *
 * All imports are fire-and-forget — errors are silently swallowed
 * because a preloader failure must never block the CLI.
 */

// React plugin — v6 uses Oxc, much lighter than v5's Babel.
import('@vitejs/plugin-react').catch(() => {})

// Vite itself.
import('vite').catch(() => {})

// React / ReactDOM are imported by boltdocsPlugin and the dev server.
import('react').catch(() => {})
import('react-dom/client').catch(() => {})

// Tailwind CSS Vite plugin — loaded by createViteConfig.
import('@tailwindcss/vite').catch(() => {})
