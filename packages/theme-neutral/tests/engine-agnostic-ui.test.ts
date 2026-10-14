import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const THEME_SRC = resolve(HERE, '../src')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

const files = sourceFiles(THEME_SRC)
const read = (file: string) => readFileSync(file, 'utf8')

/**
 * Source with its comments removed.
 *
 * These guards read files looking for code that must not exist, and the three
 * places it used to exist are exactly where the fixes were documented: a
 * component that no longer reads `className.includes('shiki')` usually carries a
 * comment saying it used to. Scanning the raw file reported those comments as the
 * violation they describe, so all three guards here fail on prose.
 *
 * Stripping comments is not a loosening. It is the difference between "this
 * component branches on the engine name" and "this component explains why it
 * stopped".
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

/**
 * The theme decides how a code block looks by reading what the pipeline
 * published, not by recognising an engine's output.
 *
 * Both of these were real and both were load-bearing rather than cosmetic:
 * `className.includes('shiki')` decided whether a block rendered as highlighted,
 * and a `<span class="line">` count decided whether a long block could be
 * expanded. With any engine other than Shiki — which the SPI in
 * `@bdocs/contracts` explicitly invites — the first rendered unstyled and the
 * second silently disabled the control.
 */
describe('theme: no engine detection in the view layer', () => {
  it('never inspects a class name to decide render state', () => {
    const offenders = files.filter((file) =>
      /className\s*\.\s*(includes|startsWith|match|indexOf)\s*\(/.test(
        withoutComments(read(file)),
      ),
    )

    expect(
      offenders.map((f) => f.replace(THEME_SRC, 'src')),
      // `AGENTS.md`: behavior must not key off `className.includes(...)`.
      'a view must not infer behaviour from a class name',
    ).toEqual([])
  })

  it('does not branch on the default engine name', () => {
    // Naming Shiki in the view makes every other engine a guest in its
    // stylesheet. `reset.css` may alias `.shiki` for back-compat; components
    // may not branch on it.
    const componentDir = join(THEME_SRC, 'components')
    const offenders: string[] = []

    for (const file of sourceFiles(componentDir)) {
      const source = withoutComments(read(file))
      if (/['"`]shiki['"`]|includes\(\s*['"]shiki/.test(source)) {
        offenders.push(file.replace(THEME_SRC, 'src'))
      }
    }

    expect(
      offenders,
      'components must read data-code-state, not the engine name',
    ).toEqual([])
  })

  it('reads the state the pipeline published', () => {
    const block = read(join(THEME_SRC, 'components/mdx/code-block.tsx'))
    expect(block).toContain('data-code-state')
    expect(block).toContain('data-line-count')
    expect(block).toContain('readCodeBlockState')
  })

  it('keeps the empty-line cleanup in one place', () => {
    // It was copy-pasted into two components and the copies had begun to
    // drift, which is how a fix to one never reached the other.
    //
    // The cleanup is a regex that matches a `<span class="line">` followed by
    // an optional nested span and a closing span. Because that marker only ever
    // lives inside a regex literal, searching for the literal marker substring
    // is enough — and it has to run on comment-stripped source, since the
    // module docs mention the marker while explaining why it is there.
    const offenders = files.filter((file) =>
      withoutComments(read(file)).includes('<span class="line">'),
    )

    expect(
      offenders.map((f) => f.replace(THEME_SRC, 'src')),
      'the Shiki empty-line cleanup belongs in code-state.ts',
    ).toEqual(['src/components/mdx/code-state.ts'])
  })
})

describe('primitives: no baked-in colour', () => {
  const PRIM = resolve(HERE, '../../primitives/src')

  it('ships no background or foreground colour', () => {
    const offenders: string[] = []

    for (const file of sourceFiles(PRIM)) {
      const source = read(file)
      // A comment naming the colour it deliberately dropped is fine; a class
      // string applying one is not.
      const withoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      const applied = withoutComments.match(
        /['"`][^'"`]*\b(?:bg-(?:black|white|red|blue|gray|slate|zinc|subtle|primary|muted)|text-(?:black|white|red|blue|gray|slate|zinc|subtle|primary|muted)|border-(?:black|white|subtle|primary|muted))\b[^'"`]*['"`]/g,
      )
      if (applied)
        offenders.push(`${file.replace(PRIM, 'src')} → ${applied[0]}`)
    }

    expect(
      offenders,
      'a primitive that picks its own colour is a second theme nobody chose',
    ).toEqual([])
  })

  it('exposes a slot for the modal overlay colour', () => {
    const modal = readFileSync(join(PRIM, 'modal.tsx'), 'utf8')
    expect(modal).toContain('overlayClassName')
  })
})
