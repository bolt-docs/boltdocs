---
"boltdocs": patch
---

fix: resolve CJS/ESM interop issues for react-fast-compare and react-router-dom
    - Add react-fast-compare to optimizeDeps.include (browser) and ssr.optimizeDeps.include (SSR) to fix missing default export
    - Add react-router-dom to ssr.noExternal to fix 'module is not defined' in Vite 8 SSR module runner
    - Apply same fixes to plugin config hook for consumer-side usage
