import { visit, SKIP } from 'unist-util-visit'
import type { BoltdocsPlugin } from 'boltdocs'
import { warn } from '@bdocs/dui'

export interface MermaidThemeVariables {
  primaryColor?: string
  primaryTextColor?: string
  primaryBorderColor?: string
  lineColor?: string
  secondaryColor?: string
  tertiaryColor?: string
  nodeBorder?: string
  mainBkg?: string
  nodeTextColor?: string
  edgeLabelBackground?: string
  clusterBkg?: string
  clusterBorder?: string
  [key: string]: string | undefined
}

export interface MermaidPluginOptions {
  themes?: {
    light?: MermaidThemeVariables
    dark?: MermaidThemeVariables
  }
}

const defaultLightTheme: MermaidThemeVariables = {
  primaryColor: '#f8fafc',
  primaryTextColor: '#0f172a',
  primaryBorderColor: '#e2e8f0',
  lineColor: '#64748b',
  secondaryColor: '#f1f5f9',
  tertiaryColor: '#ffffff',
  nodeBorder: '#e2e8f0',
  mainBkg: '#ffffff',
  nodeTextColor: '#0f172a',
  edgeLabelBackground: '#f8fafc',
  clusterBkg: '#f8fafc',
  clusterBorder: '#e2e8f0',
}

const defaultDarkTheme: MermaidThemeVariables = {
  primaryColor: '#1e293b',
  primaryTextColor: '#f8fafc',
  primaryBorderColor: '#334155',
  lineColor: '#94a3b8',
  secondaryColor: '#0f172a',
  tertiaryColor: '#1e293b',
  nodeBorder: '#334155',
  mainBkg: '#0f172a',
  nodeTextColor: '#f8fafc',
  edgeLabelBackground: '#1e293b',
  clusterBkg: '#1e293b',
  clusterBorder: '#334155',
}

interface CodeNode {
  type: 'code'
  lang?: string
  value: string
}

interface MdxJsxAttribute {
  type: 'mdxJsxAttribute'
  name: string
  value: string
}

interface MdxJsxFlowElement {
  type: 'mdxJsxFlowElement'
  name: string
  attributes: MdxJsxAttribute[]
  children: any[]
}

interface ParentNode {
  children: any[]
}

const MERMAID_LANG = 'mermaid'
const CODE_NODE_TYPE = 'code'
const MDX_JSX_FLOW_TYPE = 'mdxJsxFlowElement'
const MDX_JSX_ATTR_TYPE = 'mdxJsxAttribute'
const MDX_JSX_ATTR_EXPR_TYPE = 'mdxJsxAttributeValueExpression'
const COMPONENT_NAME = 'Mermaid'
const CHART_ATTR_NAME = 'chart'
const CONFIG_ATTR_NAME = 'config'

function toJSExpr(value: unknown): string {
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `'${escaped}'`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    return `[${value.map(toJSExpr).join(',')}]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}:${toJSExpr(v)}`)
    return `{${entries.join(',')}}`
  }
  return String(value)
}

function remarkMermaid(config: { themes: { light: MermaidThemeVariables; dark: MermaidThemeVariables } }) {
  return (tree: any) => {
    if (!tree) return
    try {
      visit(
        tree,
        CODE_NODE_TYPE,
        (node: CodeNode, index: number | undefined, parent: any) => {
          if (!node || node.lang !== MERMAID_LANG) return
          if (!parent || !parent.children || typeof index !== 'number') return

          const rawCode = node.value || ''

          const newNode: MdxJsxFlowElement = {
            type: MDX_JSX_FLOW_TYPE,
            name: COMPONENT_NAME,
            attributes: [
              {
                type: MDX_JSX_ATTR_TYPE,
                name: CHART_ATTR_NAME,
                value: rawCode,
              },
              {
                type: MDX_JSX_ATTR_TYPE,
                name: CONFIG_ATTR_NAME,
                value: {
                  type: MDX_JSX_ATTR_EXPR_TYPE,
                  value: toJSExpr(config),
                },
              },
            ],
            children: [],
          }

          parent.children[index] = newNode
          return SKIP
        },
      )
    } catch (e) {
      warn('Failed to transform Mermaid code blocks:', e)
    }
  }
}

export default function mermaidPlugin(
  options: MermaidPluginOptions = {},
): BoltdocsPlugin {
  const { themes = {} } = options

  const lightTheme = { ...defaultLightTheme, ...themes.light }
  const darkTheme = { ...defaultDarkTheme, ...themes.dark }
  const mergedConfig = { themes: { light: lightTheme, dark: darkTheme } }

  return {
    name: 'boltdocs-plugin-mermaid',
    version: '0.0.2',
    permissions: ['mdx:remark', 'components'],
    remarkPlugins: [remarkMermaid(mergedConfig)],
    components: {
      [COMPONENT_NAME]: '@bdocs/plugin-mermaid/client',
    },
  }
}
