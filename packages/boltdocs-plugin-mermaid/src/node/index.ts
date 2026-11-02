import type { Plugin } from 'vite'
import type { Node, Parent } from 'unist'
import type { BoltdocsPlugin } from 'boltdocs'
import { visitNodes, createMdxAttribute, SKIP, MDX_NODES } from 'boltdocs'
import { warn } from '@bdocs/dui'
import type {
  MermaidPluginOptions,
  MermaidThemeVariables,
} from '../shared/types'
import { defaultTheme } from '../shared/theme-default'
import { renderMermaidBothThemes } from './render'

interface CodeNode {
  type: 'code'
  lang?: string
  meta?: string
  value: string
}

interface MdxJsxAttribute {
  type: 'mdxJsxAttribute'
  name: string
  value?: string | { type: 'mdxJsxAttributeValueExpression'; value: string }
}

interface MdxJsxFlowElement {
  type: 'mdxJsxFlowElement'
  name: string
  attributes: MdxJsxAttribute[]
  children: unknown[]
}

interface PendingNode {
  node: CodeNode
  index: number
  parent: Parent
}

/**
 * Create a Vite plugin that aliases the full Mermaid client component
 * to the static version during production build.
 *
 * The static component does NOT import `mermaid` (via useMermaidRender),
 * which eliminates ~800KB of code-split mermaid chunks from the bundle.
 *
 * When the user explicitly sets `preRender: false`, the alias is skipped
 * so the full component with client-side fallback is preserved.
 */
function createBuildAliasPlugin(preRender: boolean | undefined): Plugin {
  const useStatic = preRender !== false

  return {
    name: 'boltdocs-mermaid-build-alias',
    config(_userConfig, env) {
      if (useStatic && env.command === 'build') {
        return {
          resolve: {
            alias: {
              '@bdocs/plugin-mermaid/client':
                '@bdocs/plugin-mermaid/client/static',
            },
          },
        }
      }
      return undefined
    },
  }
}

const MERMAID_LANG = 'mermaid'
const MDX_JSX_FLOW_TYPE = 'mdxJsxFlowElement'
const COMPONENT_NAME = 'Mermaid'
const CHART_ATTR_NAME = 'chart'
const CONFIG_ATTR_NAME = 'config'
const SVG_LIGHT_ATTR = 'svgLight'
const SVG_DARK_ATTR = 'svgDark'

/**
 * The remark plugin that turns Mermaid code blocks into components.
 *
 * Exported so a build worker can rebuild it: a plugin hook is a function, and
 * a function cannot cross a worker boundary. The worker imports this module
 * and calls this export with the same options the main thread would have
 * used, and both produce the same tree.
 */
export function remarkMermaid(config: {
  themes: { light: MermaidThemeVariables; dark: MermaidThemeVariables }
  preRender: boolean
}) {
  return async (tree: unknown) => {
    if (!tree) return
    try {
      const nodes: PendingNode[] = []

      visitNodes<CodeNode>(
        tree as Node,
        MDX_NODES.CODE,
        (node, index, parent) => {
          if (node.lang !== MERMAID_LANG) return
          nodes.push({ node, index, parent })
        },
      )

      for (const { node, index, parent } of nodes) {
        const rawCode = node.value || ''

        let svgLight: string | undefined
        let svgDark: string | undefined

        // CI skips pre-render by default to avoid Playwright/Chrome overhead,
        // unless the user explicitly opts in with preRender: true.
        const skipMermaid =
          process.env.BOLTDOCS_SKIP_MERMAID === 'true' ||
          (process.env.CI === 'true' && config.preRender === undefined)
        const shouldPreRender =
          !skipMermaid &&
          (config.preRender ?? process.env.NODE_ENV !== 'development')
        if (shouldPreRender) {
          const result = await renderMermaidBothThemes(
            rawCode,
            config.themes.light,
            config.themes.dark,
          )
          if (result.error) {
            warn(`Failed to pre-render Mermaid diagram: ${result.error}`)
          } else {
            svgLight = result.svgLight
            svgDark = result.svgDark
          }
        }

        const newNode: MdxJsxFlowElement = {
          type: MDX_JSX_FLOW_TYPE,
          name: COMPONENT_NAME,
          attributes: [
            createMdxAttribute(CHART_ATTR_NAME, rawCode),
            createMdxAttribute(
              CONFIG_ATTR_NAME,
              JSON.stringify({ themes: config.themes }),
            ),
          ],
          children: [],
        }

        // Attach pre-rendered SVGs when available
        if (svgLight && svgDark) {
          newNode.attributes.push(
            createMdxAttribute(SVG_LIGHT_ATTR, svgLight),
            createMdxAttribute(SVG_DARK_ATTR, svgDark),
          )
        }

        parent.children[index] = newNode as unknown as Node
      }
    } catch (e) {
      warn(`Failed to transform Mermaid code blocks: ${e}`)
    }
  }
}

export default function mermaidPlugin(
  options: MermaidPluginOptions = {},
): BoltdocsPlugin {
  const { themes = {} } = options

  const lightTheme = { ...defaultTheme.light, ...themes.light }
  const darkTheme = { ...defaultTheme.dark, ...themes.dark }
  const mergedConfig = { themes: { light: lightTheme, dark: darkTheme } }

  const remarkOptions = {
    themes: mergedConfig.themes,
    preRender: options.preRender,
  }

  return {
    name: 'boltdocs-plugin-mermaid',
    version: '0.1.0',
    remarkPlugins: [[remarkMermaid, remarkOptions]],
    // The same hook, described for a build worker. Without it a site with the
    // Mermaid plugin compiles its MDX on the main thread, one page at a time,
    // while the rest of the machine waits.
    workerHooks: {
      remark: [
        {
          module: '@bdocs/plugin-mermaid',
          export: 'remarkMermaid',
          options: remarkOptions,
          kind: 'code',
          language: 'mermaid',
          component: COMPONENT_NAME,
        },
      ],
    },
    components: {
      [COMPONENT_NAME]: '@bdocs/plugin-mermaid/client',
    },
    vitePlugins: [createBuildAliasPlugin(options.preRender)],
  }
}
