import { defineHastPlugin } from 'satteri'

interface ParsedMeta {
  title?: string
  lineNumbers?: boolean
  wordWrap?: boolean
  [key: string]: any
}

function parseMetaString(metaStr: string): ParsedMeta {
  const result: ParsedMeta = {}
  if (!metaStr) return result
  if (/lineNumbers|showLineNumbers/.test(metaStr)) result.lineNumbers = true
  if (/wordWrap|word-wrap/.test(metaStr)) result.wordWrap = true
  const titleMatch = metaStr.match(/title=(["'])(.*?)\1/)
  if (titleMatch) result.title = titleMatch[2]
  return result
}

/**
 * Merge class arrays from two property sets.
 * Original node may use `className` (React convention) while Shiki output
 * may use `class` (HAST convention). We normalize and merge.
 */
function mergeClassArrays(
  originalProps: Record<string, any>,
  shikiProps: Record<string, any>,
): string[] {
  const origClass = originalProps?.className || originalProps?.class || []
  const shikiClass = shikiProps?.className || shikiProps?.class || []
  return [
    ...(Array.isArray(shikiClass) ? shikiClass : [shikiClass]),
    ...(Array.isArray(origClass) ? origClass : [origClass]),
  ].filter(Boolean)
}

/**
 * Syntax highlighting via Shiki.
 * Port of rehypeShiki to Sätteri HAST.
 *
 * IMPORTANT: Sätteri's HAST lives in a Rust arena. Direct mutations on
 * `node.children` / `node.properties` are lost — the proxy only affects the
 * JS-side object and is never committed to the arena. Instead, visitors must
 * either:
 *   - Return a new HastNode to replace the current one (triggers replace command)
 *   - Use ctx.replaceNode() / ctx.setProperty() etc.
 *
 * This plugin returns a replacement node containing the Shiki-highlighted HAST.
 */
export function satteriRehypeShikiPlugin() {
  let adapter: any = null
  let highlighterPromise: Promise<any> | null = null

  return defineHastPlugin({
    name: 'boltdocs-rehype-shiki',
    element: {
      filter: ['pre'],
      async visit(node, ctx) {
        // Lazy load adapter and highlighter
        if (!adapter) {
          const mod = await import('boltdocs/node/mdx/shiki-adapter')
          adapter = mod.getShikiAdapter()
        }
        if (!highlighterPromise) {
          highlighterPromise = adapter.getHighlighter()
        }
        const highlighter = await highlighterPromise

        // Access children — HastChildStub materializes on read
        const codeNode = node.children?.[0]
        if (
          !codeNode ||
          codeNode.type !== 'element' ||
          codeNode.tagName !== 'code'
        ) {
          return
        }

        const className: string[] =
          codeNode.properties?.className || codeNode.properties?.class || []
        const langMatch = className.find((c: string) =>
          c.startsWith('language-'),
        )
        const lang = langMatch ? langMatch.slice(9) : 'text'

        if (lang === 'mermaid') return

        const metaStr: string =
          codeNode.properties?.metastring || (codeNode as any).data?.meta || ''

        const parsedMeta = parseMetaString(metaStr)
        const options = adapter.getOptions(lang, parsedMeta)

        const codeText =
          (codeNode.children?.[0] as { value?: string })?.value || ''

        try {
          const hast = highlighter.codeToHast(codeText, options)
          const preElement = hast.type === 'root' ? hast.children[0] : hast

          // Merge class arrays from original and Shiki output.
          const mergedClassName = mergeClassArrays(
            node.properties,
            preElement.properties,
          )

          // Build properties by iterating ALL original property keys and
          // explicitly copying each one, SKIPPING class/className entirely.
          // Then add Shiki overrides and our merged className.
          // This avoids the "two class attributes" issue where both `class`
          // (HAST) and `className` (React) end up in the output.
          const properties: Record<string, any> = {}
          const originalProps = node.properties || {}
          for (const key of Object.keys(originalProps)) {
            if (key === 'class' || key === 'className') continue
            properties[key] = originalProps[key]
          }

          // Add Shiki-specific properties (style, etc.) but skip class/className
          for (const [key, value] of Object.entries(
            preElement.properties || {},
          )) {
            if (key === 'class' || key === 'className') continue
            properties[key] = value
          }

          // Set single unified className
          properties.className = mergedClassName
          properties['data-highlighted'] = 'true'
          properties['data-lang'] = lang

          if (parsedMeta.title) {
            properties['data-title'] = parsedMeta.title
          }

          // Return a plain HAST element node — Sätteri will encode it via
          // compileHastToOpstream which handles standard HAST shapes.
          return {
            type: 'element',
            tagName: 'pre',
            properties,
            children: preElement.children,
          }
        } catch {
          // Fallback: add shiki-fallback class and return replacement node
          const properties: Record<string, any> = {}
          const originalProps = node.properties || {}
          for (const key of Object.keys(originalProps)) {
            if (key === 'class' || key === 'className') continue
            properties[key] = originalProps[key]
          }

          properties.className = [
            ...(originalProps?.className || originalProps?.class || []),
            'shiki-fallback',
          ]
          properties['data-highlighted'] = 'false'
          properties['data-lang'] = lang

          if (parsedMeta.title) {
            properties['data-title'] = parsedMeta.title
          }

          return {
            type: 'element',
            tagName: 'pre',
            properties,
            children: node.children,
          }
        }
      },
    },
  })
}
