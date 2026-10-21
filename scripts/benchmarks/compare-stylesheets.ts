/**
 * Compares two built stylesheets by their *resolved* declarations.
 *
 * The question is whether a change to a stylesheet moved a pixel, and a
 * textual diff cannot answer it: the same colour can be written as
 * `var(--color-main)` in one file and `var(--bdocs-canvas)` in the other, and
 * the two are the same colour.
 *
 * So this resolves every custom property in both files and compares the
 * declarations that result. Two files that resolve to the same declarations
 * render the same.
 *
 * Usage:
 *   tsx scripts/benchmarks/compare-stylesheets.ts <before.css> <after.css>
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function parseCustomProperties(css: string): Map<string, string> {
  const properties = new Map<string, string>()
  const pattern = /(--[a-z0-9_-]+)\s*:\s*([^;}]+)/gi
  let match: RegExpExecArray | null = pattern.exec(css)
  while (match !== null) {
    if (!properties.has(match[1])) properties.set(match[1], match[2].trim())
    match = pattern.exec(css)
  }
  return properties
}

/**
 * Folds `calc(0.25rem * 4)` into `1rem`.
 *
 * Tailwind writes the spacing scale as a calculation; the same value written
 * out is not the same text. A comparison that cannot see that would report a
 * difference where there is none.
 */
function foldCalc(value: string): string {
  return value.replace(
    /calc\(\s*(-?[\d.]+)(rem|px|em)\s*\*\s*(-?[\d.]+)\s*\)/g,
    (_whole, amount: string, unit: string, factor: string) => {
      const product = Number(amount) * Number(factor)
      return `${Number(product.toFixed(6))}${unit}`
    },
  )
}

function resolveValue(
  value: string,
  properties: Map<string, string>,
  depth = 0,
): string {
  if (depth > 8) return value
  const replaced = value.replace(
    /var\(\s*(--[a-z0-9_-]+)\s*(?:,\s*([^()]*))?\)/gi,
    (_whole, name: string, fallback?: string) => {
      const resolved = properties.get(name)
      if (resolved === undefined) {
        return fallback !== undefined ? fallback.trim() : `var(${name})`
      }
      return resolveValue(resolved, properties, depth + 1)
    },
  )
  return foldCalc(replaced.replace(/\s+/g, ' ').trim())
    .replace(/\b0\.(\d)/g, '.$1')
    .replace(/\b0(rem|px|em)\b/g, '0')
}

/**
 * The effective declarations of every selector.
 *
 * A build may split one rule into two (the same selector, different
 * declarations) or merge two rules into one. The rendering does not care: what
 * applies to a selector is the union of its declarations, with the later
 * winning for a repeated property.
 *
 * `:is(a, b)` is expanded, because a minifier writes a selector list that way
 * and the two spellings are the same rule.
 */
function rules(css: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>()
  const pattern = /([^{}@]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null = pattern.exec(css)
  while (match !== null) {
    const selector = match[1].trim()
    if (!selector || selector.startsWith('@')) continue
    const body = match[2]
    if (!body.trim()) continue
    for (const one of expandIs(selector)) {
      const existing = out.get(one) ?? new Map<string, string>()
      for (const [property, value] of declarations(body)) {
        existing.set(property, value)
      }
      out.set(one, existing)
    }
    match = pattern.exec(css)
  }
  return out
}

/** `:is(a, b)` becomes `a` and `b` — with any suffix kept. */
function expandIs(selector: string): string[] {
  const match = /^:is\((.*?)\)(\S*)$/.exec(selector.trim())
  if (!match) return [normalizeSelector(selector)]
  const suffix = match[2] ?? ''
  return match[1]
    .split(',')
    .map((part) => normalizeSelector(`${part.trim()}${suffix}`))
}

/**
 * A canonical spelling for a selector.
 *
 * A minifier may write a selector list in a different order, and `0.5rem`
 * where another build wrote `.5rem`. Neither is a difference in what applies.
 */
function normalizeSelector(selector: string): string {
  const parts = selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    // `[attr=value]` and `[attr="value"]` are the same selector.
    .map((part) => part.replace(/\[([\w-]+)=(['"]?)([^\]'"]+)\2\]/g, '[$1=$3]'))
    .sort()
  return parts.join(',')
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of body.split(';')) {
    const index = part.indexOf(':')
    if (index === -1) continue
    const property = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (!property || !value) continue
    out.set(property, value)
  }
  return out
}

export interface StyleDifference {
  selector: string
  property: string
  before: string
  after: string
}

export function compareStylesheets(
  before: string,
  after: string,
): StyleDifference[] {
  const beforeProperties = parseCustomProperties(before)
  const afterProperties = parseCustomProperties(after)
  const beforeRules = rules(before)
  const afterRules = rules(after)

  const differences: StyleDifference[] = []
  const selectors = new Set([...beforeRules.keys(), ...afterRules.keys()])

  for (const selector of selectors) {
    const beforeBody = beforeRules.get(selector)
    const afterBody = afterRules.get(selector)
    if (beforeBody === undefined || afterBody === undefined) {
      differences.push({
        selector,
        property: '(rule)',
        before: beforeBody === undefined ? '(absent)' : 'present',
        after: afterBody === undefined ? '(absent)' : 'present',
      })
      continue
    }

    const beforeDecls = beforeBody
    const afterDecls = afterBody

    for (const [property, value] of beforeDecls) {
      // Custom properties are compared through the values that use them, not
      // by name: `--color-main` and `--bdocs-canvas` are the same colour with
      // two names, and a rule that uses either resolves the same.
      if (property.startsWith('--')) continue
      const other = afterDecls.get(property)
      if (other === undefined) {
        differences.push({
          selector,
          property,
          before: resolveValue(value, beforeProperties),
          after: '(absent)',
        })
        continue
      }
      const resolvedBefore = resolveValue(value, beforeProperties)
      const resolvedAfter = resolveValue(other, afterProperties)
      if (resolvedBefore !== resolvedAfter) {
        differences.push({
          selector,
          property,
          before: resolvedBefore,
          after: resolvedAfter,
        })
      }
    }

    for (const [property, value] of afterDecls) {
      if (property.startsWith('--')) continue
      if (!beforeDecls.has(property)) {
        differences.push({
          selector,
          property,
          before: '(absent)',
          after: resolveValue(value, afterProperties),
        })
      }
    }
  }

  return differences
}

function read(file: string): string {
  return fs.readFileSync(path.resolve(file), 'utf-8')
}

function main(): void {
  const [beforeFile, afterFile] = process.argv.slice(2)
  if (!beforeFile || !afterFile) {
    console.error(
      'Usage: tsx scripts/benchmarks/compare-stylesheets.ts <before.css> <after.css>',
    )
    process.exit(2)
  }

  const differences = compareStylesheets(read(beforeFile), read(afterFile))

  if (differences.length === 0) {
    console.log(
      '✓ The two stylesheets resolve to the same declarations — nothing moved.',
    )
    return
  }

  console.log(`✗ ${differences.length} difference(s):\n`)
  for (const difference of differences) {
    console.log(`  ${difference.selector} { ${difference.property} }`)
    console.log(`      before: ${difference.before}`)
    console.log(`      after:  ${difference.after}`)
  }
  process.exit(1)
}

if (process.argv[1]?.endsWith('compare-stylesheets.ts')) {
  main()
}
