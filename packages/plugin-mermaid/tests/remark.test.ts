import { describe, it, expect } from 'vitest'
import mermaidPlugin, { type MermaidThemeVariables } from '../src/node/index'

function configAttr() {
  const defaultLight: MermaidThemeVariables = {
    primaryColor: '#f8fafc', primaryTextColor: '#0f172a', primaryBorderColor: '#e2e8f0',
    lineColor: '#64748b', secondaryColor: '#f1f5f9', tertiaryColor: '#ffffff',
    nodeBorder: '#e2e8f0', mainBkg: '#ffffff', nodeTextColor: '#0f172a',
    edgeLabelBackground: '#f8fafc', clusterBkg: '#f8fafc', clusterBorder: '#e2e8f0',
  }
  const defaultDark: MermaidThemeVariables = {
    primaryColor: '#1e293b', primaryTextColor: '#f8fafc', primaryBorderColor: '#334155',
    lineColor: '#94a3b8', secondaryColor: '#0f172a', tertiaryColor: '#1e293b',
    nodeBorder: '#334155', mainBkg: '#0f172a', nodeTextColor: '#f8fafc',
    edgeLabelBackground: '#1e293b', clusterBkg: '#1e293b', clusterBorder: '#334155',
  }
  return {
    type: 'mdxJsxAttributeValueExpression',
    value: `{themes:{light:{primaryColor:'${defaultLight.primaryColor}',primaryTextColor:'${defaultLight.primaryTextColor}',primaryBorderColor:'${defaultLight.primaryBorderColor}',lineColor:'${defaultLight.lineColor}',secondaryColor:'${defaultLight.secondaryColor}',tertiaryColor:'${defaultLight.tertiaryColor}',nodeBorder:'${defaultLight.nodeBorder}',mainBkg:'${defaultLight.mainBkg}',nodeTextColor:'${defaultLight.nodeTextColor}',edgeLabelBackground:'${defaultLight.edgeLabelBackground}',clusterBkg:'${defaultLight.clusterBkg}',clusterBorder:'${defaultLight.clusterBorder}'},dark:{primaryColor:'${defaultDark.primaryColor}',primaryTextColor:'${defaultDark.primaryTextColor}',primaryBorderColor:'${defaultDark.primaryBorderColor}',lineColor:'${defaultDark.lineColor}',secondaryColor:'${defaultDark.secondaryColor}',tertiaryColor:'${defaultDark.tertiaryColor}',nodeBorder:'${defaultDark.nodeBorder}',mainBkg:'${defaultDark.mainBkg}',nodeTextColor:'${defaultDark.nodeTextColor}',edgeLabelBackground:'${defaultDark.edgeLabelBackground}',clusterBkg:'${defaultDark.clusterBkg}',clusterBorder:'${defaultDark.clusterBorder}'}}}`,
  }
}

describe('mermaidPlugin remark compiler', () => {
  it('should transform mermaid code blocks to Mermaid MDX components', () => {
    const plugin = mermaidPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: 'Some text before',
            },
          ],
        },
        {
          type: 'code',
          lang: 'mermaid',
          value: 'graph TD\n  A --> B',
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: 'Some text after',
            },
          ],
        },
      ],
    }

    // Run the transform
    transform(tree)

    // Check that the code block has been transformed
    expect(tree.children[1]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [
        {
          type: 'mdxJsxAttribute',
          name: 'chart',
          value: 'graph TD\n  A --> B',
        },
        {
          type: 'mdxJsxAttribute',
          name: 'config',
          value: configAttr(),
        },
      ],
      children: [],
    })
  })

  it('should handle multiple mermaid blocks in the same tree', () => {
    const plugin = mermaidPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'mermaid',
          value: 'chart 1',
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'intermediate text' }],
        },
        {
          type: 'code',
          lang: 'mermaid',
          value: 'chart 2',
        },
      ],
    }

    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [
        { type: 'mdxJsxAttribute', name: 'chart', value: 'chart 1' },
        { type: 'mdxJsxAttribute', name: 'config', value: configAttr() },
      ],
      children: [],
    })
    expect(tree.children[2]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [
        { type: 'mdxJsxAttribute', name: 'chart', value: 'chart 2' },
        { type: 'mdxJsxAttribute', name: 'config', value: configAttr() },
      ],
      children: [],
    })
  })

  it('should handle nested mermaid blocks in blockquotes or lists', () => {
    const plugin = mermaidPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'blockquote',
          children: [
            {
              type: 'code',
              lang: 'mermaid',
              value: 'nested chart',
            },
          ],
        },
      ],
    }

    transform(tree)

    expect(tree.children[0].children[0]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [
        { type: 'mdxJsxAttribute', name: 'chart', value: 'nested chart' },
        { type: 'mdxJsxAttribute', name: 'config', value: configAttr() },
      ],
      children: [],
    })
  })

  it('should gracefully handle undefined or null tree', () => {
    const plugin = mermaidPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    expect(() => transform(undefined)).not.toThrow()
    expect(() => transform(null)).not.toThrow()
  })
})
