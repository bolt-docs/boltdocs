import type { Plugin } from 'vite'

/**
 * Polyfills `__dirname` to `import.meta.dirname` during SSR builds.
 *
 * Some CJS-only dependencies (or their transitive dependencies) end up being
 * bundled into the SSR output. When they reference `__dirname`, the ESM bundle
 * throws `ReferenceError: __dirname is not defined in ES module scope` at
 * runtime. Node 20.11+ exposes `import.meta.dirname`, which is the correct
 * equivalent in ESM.
 *
 * This plugin only applies the replacement when Vite is producing the SSR
 * bundle (`isSsrBuild`), so the client build is left untouched.
 */
export function ssrDirnamePolyfillPlugin(): Plugin {
  return {
    name: 'boltdocs-ssr-dirname-polyfill',
    config: (_config, { isSsrBuild }) => {
      if (!isSsrBuild) return {}
      return {
        define: {
          __dirname: 'import.meta.dirname',
        },
      }
    },
  }
}
