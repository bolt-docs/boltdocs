/**
 * Fast frontmatter parser optimized
 * Uses indexOf instead of regex to extract the frontmatter block
 * Handles: simple key-values, arrays with multiline objects, quoted strings
 */

import { MAX_FRONTMATTER_SIZE } from '../security/constants'

export { MAX_FRONTMATTER_SIZE }

export interface ParsedFrontmatter {
  data: Record<string, unknown>
  content: string
  rawMatter: string
}

export function parseFrontmatterFast(input: string): ParsedFrontmatter {
  const trimmed = input.trim()

  if (!trimmed.startsWith('---')) {
    return { data: {}, content: input, rawMatter: '' }
  }

  const endIdx = trimmed.indexOf('---', 3)

  if (endIdx === -1 || endIdx === 3) {
    return { data: {}, content: input, rawMatter: '' }
  }

  const rawMatter = trimmed.slice(3, endIdx).trim()
  const content = trimmed.slice(endIdx + 3).trim()

  if (hasUnclosedQuotes(rawMatter)) {
    return { data: {}, content, rawMatter }
  }

  const data = parseYaml(rawMatter)

  return {
    data,
    content,
    rawMatter,
  }
}

function hasUnclosedQuotes(str: string): boolean {
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    const prev = i > 0 ? str[i - 1] : ''

    if (char === "'" && !inDouble && prev !== '\\') {
      inSingle = !inSingle
    } else if (char === '"' && !inSingle && prev !== '\\') {
      inDouble = !inDouble
    }
  }

  return inSingle || inDouble
}

function parseYaml(yaml: string): Record<string, unknown> {
  const lines = yaml.split('\n')
  const result: Record<string, unknown> = {}

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      i++
      continue
    }

    // Check for key: value on same line
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx !== -1) {
      const key = trimmed.slice(0, colonIdx).trim()
      const value = trimmed.slice(colonIdx + 1).trim()

      if (value === '') {
        // Empty value - check for array/object in next lines
        const nextLines = lines.slice(i + 1)
        const parsed = parseMultilineValue(nextLines, line.search(/\S|$/))

        if (parsed.value !== undefined) {
          result[key] = parsed.value
          i += parsed.linesConsumed
        } else {
          i++
        }
      } else {
        result[key] = parseValue(value)
        i++
      }
    } else {
      i++
    }
  }

  return result
}

function parseMultilineValue(
  lines: string[],
  baseIndent: number,
): { value: unknown; linesConsumed: number } {
  if (lines.length === 0) {
    return { value: undefined, linesConsumed: 0 }
  }

  const firstTrimmed = lines[0].trim()

  // Array with objects
  if (firstTrimmed.startsWith('-')) {
    const items: Record<string, unknown>[] = []
    let j = 0

    while (j < lines.length) {
      const line = lines[j]
      const indent = line.search(/\S|$/)
      const trimmed = line.trim()

      if (!trimmed || trimmed.startsWith('#')) {
        j++
        continue
      }

      if (trimmed.startsWith('-')) {
        const itemContent = trimmed.slice(1).trim()

        if (itemContent.includes(':')) {
          // Inline object: - key: value, key2: value2
          const itemObj: Record<string, unknown> = {}
          const parts = itemContent.split(/,\s*/)
          for (const part of parts) {
            const colonIdx = part.indexOf(':')
            if (colonIdx !== -1) {
              const k = part.slice(0, colonIdx).trim()
              const v = part.slice(colonIdx + 1).trim()
              itemObj[k] = parseValue(v)
            }
          }
          items.push(itemObj)
        } else {
          // Simple item
          items.push(itemContent)
        }
      } else if (indent > baseIndent && items.length > 0) {
        // Continuation of last item: key: value on new line
        const lastItem = items[items.length - 1]
        if (typeof lastItem === 'object' && lastItem !== null) {
          const obj = lastItem as Record<string, unknown>
          const colonIdx = trimmed.indexOf(':')
          if (colonIdx !== -1) {
            const k = trimmed.slice(0, colonIdx).trim()
            const v = trimmed.slice(colonIdx + 1).trim()
            obj[k] = parseValue(v)
          }
        }
      } else {
        break
      }

      j++
    }

    return { value: items.length > 0 ? items : undefined, linesConsumed: j }
  }

  // Object with nested properties
  const obj: Record<string, unknown> = {}
  let j = 0

  while (j < lines.length) {
    const line = lines[j]
    const indent = line.search(/\S|$/)
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      j++
      continue
    }

    if (indent <= baseIndent) {
      break
    }

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx !== -1) {
      const k = trimmed.slice(0, colonIdx).trim()
      const v = trimmed.slice(colonIdx + 1).trim()
      obj[k] = parseValue(v)
    }

    j++
  }

  return {
    value: Object.keys(obj).length > 0 ? obj : undefined,
    linesConsumed: j,
  }
}

function parseValue(value: string): unknown {
  const v = value.trim()

  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null' || v === '~') return null

  if (/^-?\d+(\.\d+)?$/.test(v)) {
    return Number(v)
  }

  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1)
  }

  if (v.startsWith('{') && v.endsWith('}')) {
    const inner = v.slice(1, -1).trim()
    const obj: Record<string, unknown> = {}
    const pairs = inner.split(/,\s*/)
    for (const pair of pairs) {
      const colonIdx = pair.indexOf(':')
      if (colonIdx !== -1) {
        const k = pair.slice(0, colonIdx).trim()
        const val = pair.slice(colonIdx + 1).trim()
        obj[k] = parseValue(val)
      }
    }
    return obj
  }

  return v
}
