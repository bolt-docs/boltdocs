import type { MigrationFinding, Transform } from '../types'

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

const REMOVED = 'react-aria-components'
const ADDED = '@bdocs/primitives'

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

  inspect(_file, source) {
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

    return findings
  },

  apply(source) {
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

    if (referencedReactAria) {
      const deps = pkg.dependencies
      if (!deps || typeof deps !== 'object')
        return finalize(source, changed, pkg)
      const entries = deps as Record<string, unknown>
      if (!(ADDED in entries)) {
        entries[ADDED] = '^1.0.0'
        changed = true
      }
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
