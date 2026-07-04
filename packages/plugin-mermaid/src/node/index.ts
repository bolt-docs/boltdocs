import type { BoltdocsPlugin } from 'boltdocs'
import { visitNodes, createMdxAttribute, SKIP, MDX_NODES } from 'boltdocs'
import { warn } from '@bdocs/dui'
import type {
  MermaidPluginOptions,
  MermaidThemeVariables,
} from '../shared/types'
import { defaultTheme } from '../shared/theme-default'

interface MdxJsxFlowElement {
  type: 'mdxJsxFlowElement'
  name: string
  attributes: any[]
  children: unknown[]
}

const MERMAID_LANG = 'mermaid'
const MDX_JSX_FLOW_TYPE = 'mdxJsxFlowElement'
const COMPONENT_NAME = 'Mermaid'
const CHART_ATTR_NAME = 'chart'
const CONFIG_ATTR_NAME = 'config'

function remarkMermaid(config: {
  themes: { light: MermaidThemeVariables; dark: MermaidThemeVariables }
}) {
  return (tree: unknown) => {
    if (!tree) return
    try {
      visitNodes<any>(tree, MDX_NODES.CODE, (node, index, parent) => {
        if (node.lang !== MERMAID_LANG) return
        if (!parent) return

        const rawCode = node.value || ''

        const newNode: MdxJsxFlowElement = {
          type: MDX_JSX_FLOW_TYPE,
          name: COMPONENT_NAME,
          attributes: [
            createMdxAttribute(CHART_ATTR_NAME, rawCode),
            createMdxAttribute(CONFIG_ATTR_NAME, JSON.stringify(config)),
          ],
          children: [],
        }

        parent.children[index] = newNode
        return SKIP
      })
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

  return {
    name: 'boltdocs-plugin-mermaid',
    version: '0.0.2',
    remarkPlugins: [[remarkMermaid, mergedConfig]],
    components: {
      [COMPONENT_NAME]: '@bdocs/plugin-mermaid/client',
    },
  }
}
