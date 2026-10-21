import fs from 'node:fs'
import path from 'node:path'
import type { MigrationFinding, Transform } from '../types'
import { findImports } from '../source'
import { clientImportOwners } from './client-imports'

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

const REMOVED = 'react-aria-components'
const ADDED = '@bdocs/primitives'

/**
 * The theme package every 4.0 site needs.
 *
 * The engine used to carry the UI layer, so a site got it by installing the
 * engine. It does not any more: the build imports the theme by name, and the
 * site declares it. Without the entry the build cannot resolve the theme, and
 * the error would be a module-not-found from inside a generated file.
 */
const THEME = '@bdocs/theme-neutral'

/**
 * The runtime, for a site that imports one of its names directly.
 *
 * Only added when the project actually reaches for it: the theme re-exports
 * the runtime's API, so most sites never need the second package.
 */
const RUNTIME = '@bdocs/runtime'

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.boltdocs',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.vercel',
  '.output',
])

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.cts',
  '.mjs',
  '.cjs',
])

/** Whether a dependency block already declares a package. */
function hasDependency(
  pkg: Record<string, unknown>,
  field: string,
  name: string,
): boolean {
  const block = pkg[field]
  return (
    !!block &&
    typeof block === 'object' &&
    name in (block as Record<string, unknown>)
  )
}

/**
 * Whether the project imports a name the runtime owns.
 *
 * Two ways to get there: an import that already names the runtime, or an
 * import from `boltdocs/client` that names something only the runtime
 * exports. The second is the interesting one — it is the import the codemod
 * is about to rewrite, and the manifest has to be ready for the result.
 */
function projectNeedsRuntime(root: string): boolean {
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop() as string
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        stack.push(path.join(dir, entry.name))
        continue
      }
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue
      let source: string
      try {
        source = fs.readFileSync(path.join(dir, entry.name), 'utf-8')
      } catch {
        continue
      }
      for (const hit of findImports(source)) {
        if (hit.specifier === RUNTIME) return true
      }
      if (clientImportOwners(source).includes(RUNTIME)) return true
    }
  }
  return false
}

/**
 * Dependency entries that 4.0 moved.
 *
 * `react-aria-components` was a required peer of `boltdocs` and is now gone
 * from the tree entirely — not replaced, replaced by a package in this
 * repository. It is removed from the manifest rather than left for the user to
 * prune, because a stale entry survives an upgrade and keeps 23 MB installed
 * with nothing importing it.
 */
export const packageJsonTransform: Transform = {
  id: 'package-json',

  appliesTo: (file) => file === 'package.json',

  inspect(_file, source, ctx) {
    const findings: MigrationFinding[] = []
    let pkg: Record<string, unknown>
    try {
      pkg = JSON.parse(source) as Record<string, unknown>
    } catch {
      return findings
    }

    const present: Array<{ field: string; spec: string }> = []
    for (const field of DEP_FIELDS) {
      const block = pkg[field]
      if (!block || typeof block !== 'object') continue
      for (const spec of Object.keys(block as Record<string, unknown>)) {
        if (spec === REMOVED) present.push({ field, spec })
      }
    }

    for (const { field } of present) {
      findings.push({
        id: 'deps/react-aria',
        severity: 'warning' as const,
        action: 'fixable' as const,
        title: `\`${REMOVED}\` is no longer a dependency of Boltdocs`,
        detail:
          'It was a required peer, so every site installed its 23 MB closure ' +
          'whether or not it used a single interactive component. Nothing in ' +
          '4.0 imports it. Leaving the entry behind keeps the install ' +
          'weight up with no consumer.',
        file: 'package.json',
        remediation: `Remove \`${REMOVED}\` from ${field}.`,
      })
    }

    const needsPrimitives =
      present.length > 0 &&
      !DEP_FIELDS.some(
        (field) =>
          pkg[field] &&
          typeof pkg[field] === 'object' &&
          ADDED in (pkg[field] as Record<string, unknown>),
      )

    if (needsPrimitives) {
      findings.push({
        id: 'deps/primitives',
        severity: 'info' as const,
        action: 'fixable' as const,
        title: `Declare \`${ADDED}\` if you import it directly`,
        detail:
          'Sites that imported the primitives straight from ' +
          '`react-aria-components` must depend on the package that replaced ' +
          'them. The codemod cannot tell whether you do, so it adds the ' +
          'entry; a dependency you never import is inert.',
        file: 'package.json',
        remediation: `Add \`${ADDED}\` to dependencies.`,
      })
    }

    if (!DEP_FIELDS.some((field) => hasDependency(pkg, field, THEME))) {
      findings.push({
        id: 'deps/theme',
        severity: 'blocking',
        action: 'fixable',
        title: `Declare \`${THEME}\``,
        detail:
          'The engine used to ship the UI layer, so installing the engine was ' +
          'enough. It does not any more: the build imports the theme by name, ' +
          'and a site that does not declare it cannot resolve it.',
        file: 'package.json',
        remediation: `Add \`${THEME}\` to dependencies.`,
      })
    }

    if (
      !DEP_FIELDS.some((field) => hasDependency(pkg, field, RUNTIME)) &&
      projectNeedsRuntime(ctx.root)
    ) {
      findings.push({
        id: 'deps/runtime',
        severity: 'info',
        action: 'fixable',
        title: `Declare \`${RUNTIME}\``,
        detail:
          'Some of the names `boltdocs/client` exported belong to the ' +
          'runtime, and they are rewritten to import it directly. The theme ' +
          're-exports most of that API, so this is only added when the ' +
          'project reaches for a name the theme does not carry.',
        file: 'package.json',
        remediation: `Add \`${RUNTIME}\` to dependencies.`,
      })
    }

    return findings
  },

  apply(source, ctx) {
    let pkg: Record<string, unknown>
    try {
      pkg = JSON.parse(source) as Record<string, unknown>
    } catch {
      return source
    }

    // Read before removing: whether the project referenced react-aria is the
    // only evidence available for whether it will import the replacement.
    const referencedReactAria = DEP_FIELDS.some((field) => {
      const block = pkg[field]
      return (
        block &&
        typeof block === 'object' &&
        REMOVED in (block as Record<string, unknown>)
      )
    })

    let changed = false
    for (const field of DEP_FIELDS) {
      const block = pkg[field]
      if (!block || typeof block !== 'object') continue
      const entries = block as Record<string, unknown>
      if (REMOVED in entries) {
        delete entries[REMOVED]
        changed = true
      }
    }

    const deps = pkg.dependencies
    const entries =
      deps && typeof deps === 'object'
        ? (deps as Record<string, unknown>)
        : undefined

    if (referencedReactAria && entries && !(ADDED in entries)) {
      entries[ADDED] = '^1.0.0'
      changed = true
    }

    // The theme, always: the build imports it by name.
    if (entries && !(THEME in entries)) {
      entries[THEME] = '^1.0.0'
      changed = true
    }

    // The runtime, only when the project reaches for one of its names.
    if (entries && !(RUNTIME in entries) && projectNeedsRuntime(ctx.root)) {
      entries[RUNTIME] = '^1.0.0'
      changed = true
    }

    return finalize(source, changed, pkg)
  },
}

/**
 * Serialize only when something changed.
 *
 * Reformatting an untouched `package.json` would bury the real edit in a
 * whitespace diff, and a migration that dirties files it had nothing to say
 * about is a migration nobody trusts.
 */
function finalize(
  source: string,
  changed: boolean,
  pkg: Record<string, unknown>,
): string {
  if (!changed) return source
  return `${JSON.stringify(pkg, null, 2)}\n`
}
