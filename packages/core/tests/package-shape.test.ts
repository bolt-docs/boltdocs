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
    expect(deps.dependencies.shiki).toBe('3.23.0')
    expect(deps.dependencies['@shikijs/engine-oniguruma']).toBe('3.23.0')
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

  it('keeps isomorphic-dompurify as a runtime dependency', () => {
    // Used by the MDX HTML sanitizer at runtime in client.
    expect(deps.dependencies['isomorphic-dompurify']).toBe('3.7.1')
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
