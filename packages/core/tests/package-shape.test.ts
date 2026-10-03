import { describe, it, expect } from 'vitest'
import pkg from '../package.json' with { type: 'json' }

type PkgShape = {
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
  optionalDependencies?: Record<string, string>
  devDependencies: Record<string, string>
}

const deps = pkg as unknown as PkgShape

describe('packages/core/package.json shape', () => {
  it('declares React as a peer dependency', () => {
    expect(deps.peerDependencies.react).toBe('19.0.0')
    expect(deps.peerDependencies['react-dom']).toBe('19.0.0')
  })

  it('makes react-aria-components a HARD peer (no optional flag)', () => {
    // 3.2.0 — rac is direct-imported by 8 client primitives. It must be a
    // required peer; making it optional would silently break every site.
    expect(deps.peerDependencies['react-aria-components']).toBe('^1.16.0')
    expect(
      deps.peerDependenciesMeta?.['react-aria-components']?.optional,
    ).toBeUndefined()
  })

  it('does not declare ANY optional peer (peerDependenciesMeta is absent)', () => {
    // The contract for 3.2.0 is "all peers are required". Any future PR that
    // adds `peerDependenciesMeta.<x>.optional: true` slips past the per-peer
    // check above; this fail-fast assertion catches it.
    expect(deps.peerDependenciesMeta).toBeUndefined()
  })

  it('keeps build-time deps in dependencies (CLI unconditionally imports them)', () => {
    // These are imported by src/node/cli-entry.ts when `npx boltdocs build` runs.
    //
    // The highlighter imports `@shikijs/core`, not `shiki`. The full `shiki`
    // package pulls in `@shikijs/langs` (9.9 MB, 347 grammars) and
    // `@shikijs/themes` (1.8 MB) as ordinary dependencies, and this project
    // imports neither: grammars are vendored under
    // `src/node/mdx/grammars` and themes under `src/node/mdx/shiki-themes.ts`.
    // Depending on `shiki` would reinstall 11.7 MB of unreachable payload on
    // every consumer. `tests/node/grammars.test.ts` guards the grammar side.
    expect(deps.dependencies.shiki).toBeUndefined()
    expect(deps.dependencies['@shikijs/langs']).toBeUndefined()
    expect(deps.dependencies['@shikijs/core']).toBe('3.23.0')
    expect(deps.dependencies['@shikijs/types']).toBe('3.23.0')
    expect(deps.dependencies['@shikijs/engine-oniguruma']).toBe('3.23.0')
    expect(deps.dependencies['@shikijs/engine-javascript']).toBe('3.23.0')
    // @mdx-js/rollup was replaced by the Sätteri processor in 3.2.x
    expect(deps.dependencies['@bdocs/processor-satteri']).toBe('workspace:*')
  })

  it('does NOT ship sharp/svgo from core (they belong to plugin-image-optimizer)', () => {
    // These are direct dependencies of @bdocs/plugin-image-optimizer, not core.
    // Core never `import "sharp"` directly — listing them here force-downloads a
    // 35 MB native binary on every consumer install.
    expect(deps.dependencies.sharp).toBeUndefined()
    expect(deps.dependencies.svgo).toBeUndefined()
    // optionalDependencies was removed entirely in 3.2.0 to avoid signalling.
    expect(deps.optionalDependencies).toBeUndefined()
  })

  it('uses the browser dompurify build, never isomorphic-dompurify', () => {
    // `isomorphic-dompurify` exists to shim a DOM for Node, which means it
    // depends on jsdom: 9.2 MB and 63 packages. Boltdocs used it in two places
    // and needed neither.
    //
    // In the client, sanitizing icon markup is a real sink and the browser
    // already has a DOM, so `dompurify` alone is correct and correct-sized.
    //
    // At build time, the values being sanitized were frontmatter title,
    // description, badge and excerpt — plain text that React escapes. Running
    // them through an HTML sanitizer double-escaped them: a title of `A < B`
    // rendered as the literal `A &lt; B`. They are now reduced to plain text
    // by `stripTags`, which needs no DOM at all.
    expect(deps.dependencies['isomorphic-dompurify']).toBeUndefined()
    expect(deps.dependencies.dompurify).toBeDefined()
  })

  it('keeps zod and the workspace packages as runtime deps', () => {
    expect(deps.dependencies.zod).toBeDefined()
    expect(deps.dependencies['@bdocs/ssg']).toBe('workspace:*')
    expect(deps.dependencies['@bdocs/parser']).toBe('workspace:*')
    expect(deps.dependencies['@bdocs/unist-utils']).toBe('workspace:*')
    expect(deps.dependencies['@bdocs/dui']).toBeDefined()
  })

  it('exposes the client subpath exports', () => {
    const exp = (pkg as unknown as { exports: Record<string, unknown> }).exports
    expect(exp['./client']).toBeDefined()
    expect(exp['./primitives']).toBeDefined()
    expect(exp['./mdx']).toBeDefined()
    expect(exp['./server']).toBeDefined()
  })
})
