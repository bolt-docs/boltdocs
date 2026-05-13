import { visit } from 'unist-util-visit'
import type { BoltdocsPlugin } from 'boltdocs'

// Consistent type safety definitions for MDAST / MDX nodes
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
const COMPONENT_NAME = 'Mermaid'
const CHART_ATTR_NAME = 'chart'

/**
 * A Remark plugin that detects mermaid code blocks and transforms them
 * into <Mermaid /> JSX components. This runs BEFORE any rehype processing,
 * ensuring high reliability in MDX.
 */
export function remarkMermaid() {
  return (tree: any) => {
    visit(
      tree, 
      CODE_NODE_TYPE, 
      (node: CodeNode, index: number | undefined, parent: ParentNode | undefined) => {
        if (node.lang !== MERMAID_LANG) return

        const rawCode = node.value || ''

        // Replace the code block with a strongly-structured JSX element
        const newNode: MdxJsxFlowElement = {
          type: MDX_JSX_FLOW_TYPE,
          name: COMPONENT_NAME,
          attributes: [
            {
              type: MDX_JSX_ATTR_TYPE,
              name: CHART_ATTR_NAME,
              value: rawCode,
            },
          ],
          children: [],
        }

        if (parent && typeof index === 'number') {
          parent.children[index] = newNode
        }
      }
    )
  }
}

/**
 * The standard Boltdocs Mermaid plugin.
 */
export default function mermaidPlugin(): BoltdocsPlugin {
  return {
    name: 'boltdocs-plugin-mermaid',
    version: '0.0.2',
    permissions: ['mdx:remark', 'components'],
    remarkPlugins: [remarkMermaid],
    components: {
      [COMPONENT_NAME]: '@bdocs/plugin-mermaid/client',
    },
  }
}
