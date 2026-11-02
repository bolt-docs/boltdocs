import type { MigrationFinding, Transform } from '../types'
import {
  findImports,
  findJsxAttributes,
  replaceSpecifier,
  type ImportHit,
} from '../source'

const SOURCE_PKG = 'react-aria-components'
const TARGET_PKG = '@bdocs/primitives'

/**
 * Attributes whose meaning did not survive the move.
 *
 * `@bdocs/primitives` is a rewrite, not a re-export: behaviour lives here now,
 * with tests that exercise it. Most of the surface carries over. These do not,
 * and a blind rename would compile into something that renders wrong — a menu
 * that never closes because `onPress` is now an unknown prop. So they are
 * reported, not rewritten.
 */
const MANUAL_ATTRS: Array<{ name: string; note: string }> = [
  {
    name: 'onPress',
    note: '`onAction` on MenuItem / MenuTrigger',
  },
  {
    name: 'isSelected',
    note: '`selectedKeys` on Menu, with `selectionMode`',
  },
  { name: 'SSRProvider', note: 'removed — `useId` agrees across hydration' },
]

/**
 * react-aria-components → @bdocs/primitives.
 *
 * The import rewrite is mechanical and safe. The attribute changes are not, so
 * each one is a finding that names the replacement rather than an edit — a
 * codemod that silently renames `onPress` to `onAction` across a file would
 * produce code that type-checks and does the wrong thing at runtime.
 */
export const reactAriaTransform: Transform = {
  id: 'react-aria',

  appliesTo: (file) =>
    /\.(tsx?|jsx?|mts|cts|mjs|cjs)$/.test(file) &&
    !file.includes('/node_modules/') &&
    !file.endsWith('.d.ts'),

  inspect(file, source) {
    const all = findImports(source)
    const imports = all.filter((hit) => hit.specifier === SOURCE_PKG)
    // The attribute checks below run on files that already import
    // `@bdocs/primitives` too, not only the ones still on react-aria.
    // Otherwise the warnings vanish the moment `--apply` rewrites the import,
    // and a user who applied once and skimmed the manual findings never sees
    // them again — the finding disappears because the fix landed, not because
    // the problem was resolved.
    if (
      imports.length === 0 &&
      !all.some((hit) => hit.specifier === TARGET_PKG)
    ) {
      return []
    }

    // Annotated rather than inferred: the array starts as import findings
    // (blocking, fixable) and then collects attribute findings (warning,
    // manual). Without the annotation the first literal fixes the element type
    // and every later push is a type error.
    const findings: MigrationFinding[] = imports.map((hit) => ({
      id: 'react-aria/import',
      severity: 'blocking',
      action: 'fixable',
      title: `Import from \`${SOURCE_PKG}\` moved to \`${TARGET_PKG}\``,
      detail:
        'The client primitives are implemented in this repository instead of ' +
        'delegated to `react-aria-components`. That tree was a required peer ' +
        'dependency of every Boltdocs site, whether or not it used a single ' +
        'interactive component.',
      file,
      line: hit.line,
      snippet: hit.specifier,
      remediation: `Rewrite the specifier to \`${TARGET_PKG}\`.`,
    }))

    for (const attr of MANUAL_ATTRS) {
      if (attr.name === 'SSRProvider') {
        for (const hit of findComponentTags(source, 'SSRProvider')) {
          findings.push({
            id: 'react-aria/ssr-provider',
            severity: 'blocking',
            action: 'manual',
            title: '`<SSRProvider>` has no replacement',
            detail:
              'It existed because react-aria derived element ids from a ' +
              'module-level counter that starts at a different value on the ' +
              "server and in the browser. `@bdocs/primitives` uses React's " +
              '`useId`, which agrees across the boundary by construction, so ' +
              'there is nothing to reconcile. Delete the wrapper and its import.',
            file,
            line: hit.line,
            snippet: hit.text,
          })
        }
        continue
      }

      for (const hit of findJsxAttributes(source, attr.name)) {
        if (attr.name === 'onPress') {
          // The replacement depends on the element this sits on — `onAction`
          // for menu items, a DOM handler for everything else. A codemod that
          // guessed would be wrong often enough to be worse than asking.
          findings.push({
            id: 'react-aria/on-press',
            severity: 'warning',
            action: 'manual',
            title: `\`onPress\` — ${attr.note}`,
            detail:
              '`@bdocs/primitives` reports press handling through DOM events ' +
              '(`onClick`, `onPointerDown`) or `onAction` on menu items, and ' +
              'the two are not interchangeable: `onAction` also receives the ' +
              'intent (`press` or `close`), so renaming the prop changes what ' +
              'the handler is called with.',
            file,
            line: hit.line,
            snippet: hit.text,
            remediation: `Use \`onAction\` on MenuItem / MenuTrigger, or a DOM handler off a menu.`,
          })
          continue
        }
        findings.push({
          id: 'react-aria/is-selected',
          severity: 'warning',
          action: 'manual',
          title: `\`${attr.name}\` — ${attr.note}`,
          detail:
            'Selection is a property of the collection, not of the item. The ' +
            'menu takes `selectedKeys` and reports changes through ' +
            '`onSelectionChange`; an item no longer carries its own `isSelected`.',
          file,
          line: hit.line,
          snippet: hit.text,
          remediation: `Use \`selectedKeys\` on Menu, with \`selectionMode\`.`,
        })
      }
    }

    return findings
  },

  apply(source) {
    let out = source
    // Rewrite back-to-front so earlier hits keep their offsets.
    const hits = findImports(source)
      .filter((hit) => hit.specifier === SOURCE_PKG)
      .sort((a, b) => b.start - a.start)
    for (const hit of hits) {
      out = replaceSpecifier(out, hit as ImportHit, TARGET_PKG)
    }
    return out
  },
}

function findComponentTags(
  source: string,
  tag: string,
): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = []
  const re = new RegExp(`<${tag}(\\s|>|/)`, 'g')
  for (let match = re.exec(source); match !== null; match = re.exec(source)) {
    out.push({
      line: source.slice(0, match.index).split('\n').length,
      text: `<${tag}`,
    })
  }
  return out
}
