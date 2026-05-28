import { normalizePath } from '../utils'
import type { BoltdocsConfig } from '../config'
import type { BoltdocsPluginOptions } from './types'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Generates the raw source code for the virtual entry file (`\0virtual:boltdocs-entry`).
 * This code initializes the client-side React application.
 *
 * @param options - Plugin options containing potential custom overrides (like `homePage` or `customCss`)
 * @param config - The resolved Boltdocs configuration containing custom plugins and components
 * @returns A string of JavaScript code to be evaluated by the browser
 */
export function generateEntryCode(
  options: BoltdocsPluginOptions,
  config?: BoltdocsConfig,
): string {
  // Auto-import index.css if it exists
  const cssPath = path.resolve(process.cwd(), 'index.css')
  const cssImport = fs.existsSync(cssPath) ? "import './index.css';" : ''

  const pluginComponents =
    config?.plugins?.flatMap((p) => Object.entries(p.components || {})) || []

  const componentImports = pluginComponents
    .map(
      ([
        name,
        path,
      ]) => `import * as _comp_${name} from '${normalizePath(path)}';
const ${name} = _comp_${name}.default || _comp_${name}['${name}'] || _comp_${name};`,
    )
    .join('\n')
  const pluginComponentMap = pluginComponents.map(([name]) => name).join(', ')
  const componentMap = pluginComponentMap

  const docsDirName = path.basename(options.docsDir || 'docs')
  const docsDir = path.resolve(process.cwd(), options.docsDir || 'docs')

  // Detect external pages module
  const externalModulePath = ['tsx', 'ts', 'jsx', 'js']
    .map((ext) => path.resolve(docsDir, `pages-external/index.${ext}`))
    .find((p) => fs.existsSync(p))

  const externalModuleImport = externalModulePath
    ? `import * as _external_module from '${normalizePath(externalModulePath)}';`
    : ''

  const externalOption = externalModulePath
    ? 'externalPages: _external_module.pages, externalLayout: _external_module.layout,'
    : ''

  // SSR builds need eager glob (synchronous access during renderToString).
  // Client builds (dev + prod) use lazy glob + background prefetch for fast first paint.
  const isSSR = process.env.VITE_SSG === 'true'
  const globMode = isSSR ? '{ eager: true }' : '{}'

  // Background prefetch: after first paint, load all MDX modules in batches
  // so navigation is instant (modules already in Vite/browser cache).
  const prefetchCode = isSSR ? '' : `
if (typeof window !== 'undefined') {
  const prefetchAll = () => {
    const getters = Object.values(mdxModules)
    if (getters.length === 0) return
    let i = 0
    const nextBatch = () => {
      if (i >= getters.length) return
      const batch = getters.slice(i, i + 6)
      i += batch.length
      Promise.allSettled(batch.map(fn => fn())).then(() => {
        setTimeout(nextBatch, 0)
      })
    }
    ;(typeof requestIdleCallback === 'function' ? requestIdleCallback : function(cb) { setTimeout(cb, 500) })(nextBatch)
  }
  prefetchAll()
}
`

  const layoutGlob = `/${docsDirName}/**/layout.tsx`
  const listGlob = `/${docsDirName}/**/list.tsx`
  const postGlob = `/${docsDirName}/**/post.tsx`

  return `
import { ViteReactSSG, createRoutes } from 'boltdocs/client';
import _routes from 'virtual:boltdocs-routes.ts';
import _collections from 'virtual:boltdocs-collections.ts';
import _config from 'virtual:boltdocs-config.ts';
import _user_mdx_components from 'virtual:boltdocs-mdx-components.tsx';
${cssImport}
${componentImports}
${externalModuleImport}

const mdxModules = import.meta.glob('/${docsDirName}/**/*.{md,mdx}', ${globMode});

const _collLayoutMods = import.meta.glob('${layoutGlob}', { eager: true });
const _collListMods = import.meta.glob('${listGlob}', { eager: true });
const _collPostMods = import.meta.glob('${postGlob}', { eager: true });

const _collectionLayouts = {};
for (const [p, mod] of Object.entries(_collLayoutMods)) {
  const dir = p.split('/').slice(-2, -1)[0];
  if (dir.startsWith('[') && dir.endsWith(']')) {
    _collectionLayouts[dir.slice(1, -1)] = mod.default || mod;
  }
}

const _collectionLists = {};
for (const [p, mod] of Object.entries(_collListMods)) {
  const dir = p.split('/').slice(-2, -1)[0];
  if (dir.startsWith('[') && dir.endsWith(']')) {
    _collectionLists[dir.slice(1, -1)] = mod.default || mod;
  }
}

const _collectionPosts = {};
for (const [p, mod] of Object.entries(_collPostMods)) {
  const dir = p.split('/').slice(-2, -1)[0];
  if (dir.startsWith('[') && dir.endsWith(']')) {
    _collectionPosts[dir.slice(1, -1)] = mod.default || mod;
  }
}

export const createRoot = ViteReactSSG(
  {
    routes: createRoutes({
      routesData: _routes,
      collectionsData: _collections,
      collectionLayouts: _collectionLayouts,
      collectionLists: _collectionLists,
      collectionPosts: _collectionPosts,
      config: _config,
      mdxModules,
      ${externalOption}
      components: { ${componentMap}${componentMap ? ', ' : ''} ...(_user_mdx_components || {}) },
    }),
  },
  ({ isClient }) => {
    // Boltdocs initialization hook
    if (isClient) {
      // Client-side initialization
    }
  },
);
${prefetchCode}
`
}
