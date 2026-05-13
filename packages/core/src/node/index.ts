import type { Plugin, InlineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { boltdocsPlugin } from './plugin/index'
import { boltdocsMdxPlugin } from './mdx/index'
import { SECURITY_HEADERS } from './security/headers'
import { getCSPHeader } from './security/csp'
import { resolveConfigAndGenerateTypes, type BoltdocsConfig } from './config'
import path from 'node:path'
import { normalizePath } from 'vite'
export { generateEntryCode } from './plugin/entry'
import type { BoltdocsPluginOptions } from './plugin/index'

export default async function boltdocs(
  options?: BoltdocsPluginOptions,
): Promise<Plugin[]> {
  const docsDir = options?.docsDir || 'docs'
  const config = await resolveConfigAndGenerateTypes(docsDir)

  // Merge options with config
  const mergedOptions: BoltdocsPluginOptions = {
    ...options,
  }

  return [...boltdocsPlugin(mergedOptions, config), boltdocsMdxPlugin(config)]
}

/**
 * Generates the complete Vite configuration for a Boltdocs project.
 * This is used by the Boltdocs CLI to run Vite without a user-defined vite.config.ts.
 */
export async function createViteConfig(
  root: string,
  mode: 'development' | 'production' = 'development',
): Promise<InlineConfig> {
  const config = await resolveConfigAndGenerateTypes('docs', root)
  const isProd = mode === 'production'

  // Prepare security headers
  const securityHeaders: Record<string, string> = isProd
    ? { ...SECURITY_HEADERS }
    : {}
  if (config.security?.enableCSP) {
    securityHeaders['Content-Security-Policy'] = getCSPHeader(config)
  }

  const viteConfig: InlineConfig = {
    root,
    mode,
    oxc: {
      jsx: {
        development: !isProd,
        runtime: 'automatic',
        importSource: 'react',
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-helmet-async',
        'react-router-dom',
        'use-sync-external-store/shim',
      ],
      rolldownOptions: {},
    },
    build: {
      rolldownOptions: {},
    },
    plugins: [
      react(),
      tailwindcss(),
      // Pass the already-resolved config directly to avoid a second call to
      // resolveConfigAndGenerateTypes that the boltdocs() default export would trigger.
      ...boltdocsPlugin(
        { docsDir: 'docs', root } as BoltdocsPluginOptions,
        config,
      ),
      boltdocsMdxPlugin(config),
    ],
    resolve: {
      alias: [
        {
          find: 'boltdocs/entry',
          replacement: normalizePath(path.resolve(root, 'boltdocs-entry.tsx')),
        },
        {
          find: 'boltdocs/client',
          replacement: normalizePath(path.resolve(root, 'boltdocs-client.mjs')),
        },
        {
          find: 'use-sync-external-store/shim/index.js',
          replacement: 'react',
        },
        {
          find: 'use-sync-external-store/shim',
          replacement: 'react',
        },
        {
          find: 'use-sync-external-store',
          replacement: 'react',
        },
      ],
      dedupe: [
        'react',
        'react-dom',
        'react-router-dom',
        'react-helmet-async',
        '@bdocs/ssg',
      ],
    },
    ssr: {
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          ...(config.vite?.ssr?.optimizeDeps?.include || []),
        ],
      },
      noExternal: [
        'boltdocs',
        /@bdocs\/(?!ssg).*/,
        'react-helmet-async',
        'react-aria-components',
        '@react-aria/collections',
        '@react-aria/utils',
      ],
    },
    server: {
      headers: {
        ...securityHeaders,
        ...config.vite?.server?.headers,
      },
      ...config.vite?.server,
    },
    preview: {
      headers: {
        ...securityHeaders,
        ...config.vite?.preview?.headers,
      },
      ...config.vite?.preview,
    },
    ...config.vite,
  }

  return viteConfig
}

export type { RouteMeta } from './routes'
export type {
  BoltdocsConfig,
  BoltdocsThemeConfig,
  BoltdocsPlugin,
} from './config'
export { resolveConfig } from './config'
export { defineConfig } from '../shared/config-utils'
export { normalizePath, sanitizeFilename } from './utils'
export type { BoltdocsPluginOptions }
export * from './plugins'
