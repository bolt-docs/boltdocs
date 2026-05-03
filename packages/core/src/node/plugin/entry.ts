import { normalizePath } from '../utils'
import type { BoltdocsConfig } from '../config'
import type { BoltdocsPluginOptions } from './types'
import path from 'path'
import fs from 'fs'

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
  isBuild: boolean = false,
): string {
  const homeImport = options.homePage
    ? `import HomePage from '${normalizePath(options.homePage)}';`
    : ''

  // Auto-import index.css if it exists
  const cssPath = path.resolve(process.cwd(), 'index.css')
  const cssImport = fs.existsSync(cssPath) ? "import './index.css';" : ''

  let homeOption = options.homePage ? 'homePage: HomePage,' : ''
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
  const componentMap = pluginComponents.map(([name]) => name).join(', ')

  const docsDirName = path.basename(options.docsDir || 'docs')
  const docsDir = path.resolve(process.cwd(), options.docsDir || 'docs')

  // Detect external pages module
  const externalModulePath = ['tsx', 'ts', 'jsx', 'js']
    .map((ext) => path.resolve(docsDir, `pages-external/index.${ext}`))
    .find((p) => fs.existsSync(p))

  const externalModuleImport = externalModulePath
    ? `import * as _external_module from '${normalizePath(externalModulePath)}';`
    : ''

  // Prioritize homePage from external module if it exists
  homeOption = externalModulePath
    ? 'homePage: _external_module.homePage || HomePage,'
    : options.homePage
      ? 'homePage: HomePage,'
      : ''

  const externalOption = externalModulePath
    ? 'externalPages: _external_module.pages, externalLayout: _external_module.layout,'
    : ''

  // Use eager loading so all pages are available synchronously for instant navigation.
  const globMode = '{ eager: true }'

  return `
import { ViteReactSSG } from '@bdocs/ssg';
import { createRoutes } from 'boltdocs/client';
import _routes from 'virtual:boltdocs-routes.ts';
import _config from 'virtual:boltdocs-config.ts';
import _user_mdx_components from 'virtual:boltdocs-mdx-components.tsx';
import _Layout from 'virtual:boltdocs-layout.tsx';
${cssImport}
${homeImport}
${componentImports}
${externalModuleImport}

const mdxModules = import.meta.glob('/${docsDirName}/**/*.{md,mdx}', ${globMode});

export const createRoot = ViteReactSSG(
  {
    routes: createRoutes({
      routesData: _routes,
      config: _config,
      mdxModules,
      Layout: _Layout,
      ${homeOption}
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
`
}
