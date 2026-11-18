import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

export interface ReactBindingViteOptions {
  isProd: boolean
  fastRefresh: boolean
}

/**
 * All React-specific Vite settings in one place. The engine keeps only the
 * framework-neutral config and includes this plugin by name, so it never has
 * to import React or know that the binding uses it.
 */
export function reactBindingVitePlugin(
  options: ReactBindingViteOptions,
): Plugin[] {
  const plugins: Plugin[] = []
  if (options.fastRefresh) plugins.push(react())

  plugins.push({
    name: 'boltdocs-react-binding',
    config(userConfig) {
      return {
        oxc: {
          ...userConfig.oxc,
          jsx: {
            development: !options.isProd,
            runtime: 'automatic',
            importSource: 'react',
          },
        },
        optimizeDeps: {
          ...userConfig.optimizeDeps,
          include: [
            ...(userConfig.optimizeDeps?.include ?? []),
            'react',
            'react-dom',
            'react-dom/client',
            'react-helmet-async',
            'react-router-dom',
            'use-sync-external-store/shim',
          ],
        },
        ssr: {
          ...userConfig.ssr,
          external: [
            ...(userConfig.ssr?.external ?? []),
            'react',
            'react-dom',
            'react-helmet-async',
            'react-router-dom',
          ],
          optimizeDeps: { include: ['react', 'react-dom'] },
          noExternal: [],
        },
        resolve: {
          ...userConfig.resolve,
          dedupe: [
            'react',
            'react-dom',
            'react-router-dom',
            ...(userConfig.resolve?.dedupe ?? []),
          ],
        },
      }
    },
  })
  return plugins
}

/** Modules the dev server should prewarm for a React site. */
export const PREWARM_ENTRIES = [
  'react',
  'react-dom',
  'react-dom/client',
  'react-router-dom',
  'react-helmet-async',
]
