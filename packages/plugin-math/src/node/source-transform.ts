import type { PluginContext } from 'boltdocs'
import katex from 'katex'

function escapeJsString(content: string): string {
  return content
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

function renderMathHtml(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode })
  } catch {
    // Keep the raw TeX visible instead of dropping content on parse errors.
    return tex
  }
}

/**
 * Bake KaTeX output at build time. The emitted `<BlockMath>`/`<MathComponent>`
 * tags carry the pre-rendered HTML in a `html` prop, so the client components
 * never need to bundle KaTeX (~250 KB minified) just to display equations.
 */
function preprocessMath(source: string): string {
  const placeholders: string[] = []

  let result = source.replace(/(`{3,})[\s\S]*?\1/g, (match) => {
    placeholders.push(match)
    return `\0MATH_PH_${placeholders.length - 1}\0`
  })

  result = result.replace(/(`[^`\n]+`)/g, (match) => {
    placeholders.push(match)
    return `\0MATH_PH_${placeholders.length - 1}\0`
  })

  result = result.replace(/^---[\s\S]*?---\n*/m, (match) => {
    placeholders.push(match)
    return `\0MATH_PH_${placeholders.length - 1}\0`
  })

  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, content: string) => {
    const trimmed = content.trim()
    const html = renderMathHtml(trimmed, true)
    return `<BlockMath html={"${escapeJsString(html)}"}>{"${escapeJsString(trimmed)}"}</BlockMath>`
  })

  result = result.replace(
    /(?<!\$)\$(?!\$)(.+?)\$(?!\$)/g,
    (_, content: string) => {
      const html = renderMathHtml(content, false)
      return `<MathComponent html={"${escapeJsString(html)}"}>{"${escapeJsString(content)}"}</MathComponent>`
    },
  )

  while (result.includes('\0MATH_PH_')) {
    result = result.replace(/\0MATH_PH_(\d+)\0/g, (_, idx: string) => {
      return placeholders[parseInt(idx)]
    })
  }

  return result
}

export function transformSource(
  _ctx: PluginContext,
  params: { code: string; filePath: string },
): { code: string } {
  return { code: preprocessMath(params.code) }
}
