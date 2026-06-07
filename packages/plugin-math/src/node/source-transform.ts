import type { PluginContext } from 'boltdocs'

function escapeJsString(content: string): string {
  return content
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

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
    const escaped = escapeJsString(trimmed)
    return `<BlockMath>{"${escaped}"}</BlockMath>`
  })

  result = result.replace(
    /(?<!\$)\$(?!\$)(.+?)\$(?!\$)/g,
    (_, content: string) => {
      const escaped = escapeJsString(content)
      return `<Math>{"${escaped}"}</Math>`
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
