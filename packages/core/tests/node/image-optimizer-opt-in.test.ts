import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BoltdocsConfigSchema,
  ExperimentalConfigSchema,
} from '../../src/node/schema/config'

/**
 * Image optimization is opt-in.
 *
 * The optimizer resolves `sharp` and `svgo`, native binaries of several
 * megabytes. It used to be injected unconditionally from a top-level import, so
 * every installation paid for it whether or not a single image was processed.
 * These tests pin the opt-in behaviour and, more importantly, that the
 * unguarded import does not come back.
 */

const PLUGIN_SOURCE = readFileSync(
  join(import.meta.dirname, '../../src/node/plugin/index.ts'),
  'utf8',
)

describe('experimental.imageOptimizer', () => {
  it('is off when not configured', () => {
    // Absent means off. A project that never heard of the option must not load
    // the optimizer.
    const parsed = BoltdocsConfigSchema.parse({})
    expect(parsed.experimental?.imageOptimizer).toBeUndefined()
  })

  it('accepts a bare boolean', () => {
    expect(
      ExperimentalConfigSchema.parse({ imageOptimizer: true }).imageOptimizer,
    ).toBe(true)
    expect(
      ExperimentalConfigSchema.parse({ imageOptimizer: false }).imageOptimizer,
    ).toBe(false)
  })

  it('accepts the object form for per-project tuning', () => {
    const parsed = ExperimentalConfigSchema.parse({
      imageOptimizer: { enabled: true, includePublic: false },
    })
    expect(parsed.imageOptimizer).toEqual({
      enabled: true,
      includePublic: false,
    })
  })

  it('treats a misspelled key as not set rather than as an error', () => {
    // Zod strips unknown keys instead of failing, and the rest of this schema
    // relies on that. It matters here in one direction: a typo such as
    // `includePubic` leaves the default in place rather than silently
    // reconfiguring the optimizer. Asserting a rejection would be a guarantee
    // the schema does not make.
    const parsed = ExperimentalConfigSchema.parse({
      imageOptimizer: { enabled: true, includePubic: true },
    })
    expect(parsed.imageOptimizer).toEqual({ enabled: true })
  })

  it('survives the full config schema', () => {
    const parsed = BoltdocsConfigSchema.parse({
      experimental: { imageOptimizer: { enabled: true } },
    })
    expect(parsed.experimental?.imageOptimizer).toEqual({ enabled: true })
  })
})

describe('image optimizer resolution', () => {
  it('has no static import of the optimizer in the core module graph', () => {
    // This is the property that removes the installation cost. A top-level
    // `import { ViteImageOptimizer }` would put the optimizer — and through it
    // `sharp` — back into every load, regardless of configuration. Asserting on
    // the source is deliberate: a bundler would tree-shake the unused branch and
    // hide the regression from every other kind of test.
    expect(PLUGIN_SOURCE).not.toMatch(
      /^\s*import\s+\{[^}]*ViteImageOptimizer[^}]*\}\s+from\s+['"]@bdocs\/plugin-image-optimizer['"]/m,
    )
    expect(PLUGIN_SOURCE).not.toMatch(
      /^\s*import\s+['"]@bdocs\/plugin-image-optimizer['"]/m,
    )
  })

  it('resolves the optimizer inside a guarded branch', () => {
    // The lazy form is required because Vite needs a synchronous plugin array,
    // so `createRequire` is used instead of `import()`.
    const requires = PLUGIN_SOURCE.match(
      /require\(['"]@bdocs\/plugin-image-optimizer['"]\)/g,
    )
    expect(requires).toHaveLength(1)

    // And it must sit behind the opt-in check rather than beside it.
    const resolver = PLUGIN_SOURCE.indexOf(
      'function resolveImageOptimizerPlugins',
    )
    const guard = PLUGIN_SOURCE.indexOf('config?.experimental?.imageOptimizer')
    const load = PLUGIN_SOURCE.indexOf(
      "require('@bdocs/plugin-image-optimizer')",
    )
    expect(resolver).toBeGreaterThan(-1)
    expect(guard).toBeGreaterThan(resolver)
    expect(load).toBeGreaterThan(guard)
  })

  it('warns and continues when the optimizer is enabled but not installed', () => {
    // Failing the build would be worse than the missing feature: the project
    // asked for an optimization and gets a build without it, not a build that
    // cannot produce.
    expect(PLUGIN_SOURCE).toContain(
      'experimental.imageOptimizer is enabled but @bdocs/plugin-image-optimizer could not be loaded',
    )
  })
})
