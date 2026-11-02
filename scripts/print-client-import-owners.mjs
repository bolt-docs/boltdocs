import fs from 'node:fs'

/**
 * Prints the owner table the `boltdocs migrate` codemod rewrites imports with.
 *
 * The table is a snapshot of the three public entry points the codemod points
 * at: the theme's styled surface, the theme's style-neutral composition
 * layer, and the runtime. Regenerating it after a package changes its public
 * surface is a matter of running this and pasting the lists back into
 * `packages/boltdocs-engine/src/node/migrate/transforms/client-import-owners.ts`.
 */

function exportedNames(file) {
  const source = fs.readFileSync(file, 'utf8')
  const names = new Set()
  const pattern = /export\s*\{([^}]*)\}/g
  let match = pattern.exec(source)
  while (match !== null) {
    for (const raw of match[1].split(',')) {
      const binding = raw.trim()
      if (!binding) continue
      const [imported, exported] = binding.split(/\s+as\s+/)
      const name = (exported ?? imported).replace(/^type\s+/, '').trim()
      if (name) names.add(name)
    }
    match = pattern.exec(source)
  }
  return names
}

const theme = exportedNames('packages/boltdocs-theme-neutral/dist/index.d.mts')
const composition = exportedNames(
  'packages/boltdocs-theme-neutral/dist/composition.d.mts',
)
const runtime = exportedNames('packages/boltdocs-runtime/dist/index.d.mts')

const styled = [...theme].sort()
const slots = [...composition].filter((name) => !theme.has(name)).sort()
const browser = [...runtime]
  .filter((name) => !theme.has(name) && !composition.has(name))
  .sort()

// The repository's formatter wants single quotes, and a generated file that
// fails the formatter is a generated file nobody regenerates.
const list = (names) =>
  `[\n${names.map((name) => `  '${name}',`).join('\n')}\n]`

const output = `/**
 * Which package owns each name \`boltdocs/client\` used to export.
 *
 * A snapshot, taken from the three public entry points the codemod points at:
 * the theme's styled surface, the theme's style-neutral composition layer, and
 * the runtime. It is not a guess — the same barrels the codemod rewrites to
 * are the ones a reader lands on after the rewrite, so an import that resolves
 * after the migration resolved before it.
 *
 * The order is the order of preference. The styled surface comes first, then
 * the composition layer, then the runtime. A name in more than one barrel
 * belongs to the earlier one: the styled component is the one a site wants,
 * and the style-neutral one is the slot layer it is built from.
 *
 * To regenerate after a package changes its public surface:
 *
 *   node scripts/print-client-import-owners.mjs
 *
 * and paste the three lists back in.
 */

/** Names the theme's styled entry point exports. */
export const THEME_NAMES = ${list(styled)}

/** Names only the theme's composition entry point exports. */
export const COMPOSITION_NAMES = ${list(slots)}

/** Names only the runtime's entry point exports. */
export const RUNTIME_NAMES = ${list(browser)}
`

fs.writeFileSync(
  'packages/boltdocs-engine/src/node/migrate/transforms/client-import-owners.ts',
  output,
)
console.log('written', styled.length, slots.length, browser.length)
