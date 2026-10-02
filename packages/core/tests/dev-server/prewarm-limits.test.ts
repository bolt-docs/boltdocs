import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/node/dev-server',
)
/**
 * The prewarm limit used to be a hard 200. On the 247-page docs site that left
 * 47 pages cold, and navigating to one of them compiled on the critical path —
 * the visible flash on click. The cap is now opt-in via BOLTDOCS_PREWARM_LIMIT.
 *
 * These assertions are on the source rather than on a running server: the limit
 * is read from the environment at module load, so exercising it would require
 * re-importing the module with a mutated `process.env`.
 */
describe('dev server prewarm limits', () => {
  const source = readFileSync(resolve(SRC, 'prewarm.ts'), 'utf-8')
  it('does not cap MDX prewarming by default', () => {
    expect(source).toContain('Number.POSITIVE_INFINITY')
    expect(source).not.toMatch(/\?\s*200\b/)
  })
  it('reports how many files were actually warmed', () => {
    // The log used to print `files.length`, which claims every page was warmed
    // even when the cap had silently dropped some.
    expect(source).toContain('${selectedFiles.length}/${files.length}')
  })
  it('yields the event loop between batches', () => {
    // Without this, removing the cap would let a large site monopolise the
    // transform pipeline.
    expect(source).toContain('_pendingRequests')
    expect(source).toContain('setTimeout(resolve, 0)')
  })
})
describe('client graph warmup', () => {
  const warm = readFileSync(resolve(SRC, 'warm-client-graph.ts'), 'utf-8')
  it('starts from the client entry virtual module', () => {
    expect(warm).toContain('__x00__virtual:boltdocs-entry.tsx')
  })
  it('strips the base prefix before calling transformRequest', () => {
    // Vite's transformed output carries `/docs/...` specifiers, and
    // transformRequest returns null for a base-prefixed URL. Without the strip
    // the crawl stops after the entry: measured at 2 of 530 modules.
    expect(warm).toContain('stripBase')
  })
  it('warms in batches rather than sequentially', () => {
    // A sequential walk made an arriving request wait behind every remaining
    // module rather than only the current one.
    expect(warm).toContain('Promise.allSettled')
    expect(warm).toContain('BATCH_SIZE')
  })
  it('lets a pending request win over the warmup', () => {
    expect(warm).toContain('_pendingRequests')
  })
})

describe('client graph warmup scope', () => {
  const warm = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../src/node/dev-server/warm-client-graph.ts',
    ),
    'utf-8',
  )

  it('does not follow MDX specifiers', () => {
    // Following them duplicated the MDX prewarm and pulled content into the
    // module graph early enough to break the HMR regression asserting that
    // external pages never emit `boltdocs:mdx-update`.
    expect(warm).toContain('/\\.mdx?($|\\?)/')
  })
})

describe('client graph warmup yields to SSR', () => {
  const warm = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../src/node/dev-server/warm-client-graph.ts',
    ),
    'utf-8',
  )
  const middleware = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../src/node/dev-server/middleware.ts',
    ),
    'utf-8',
  )

  it('checks the Boltdocs-served-request gate, not only Vite pending requests', () => {
    // Vite's `_pendingRequests` does not cover requests served by Boltdocs'
    // own middleware, and those are the SSR renders, which the warmup must not
    // compete with.
    expect(warm).toContain('isServingRequest()')
  })

  it('gates the HTML render path in the dev middleware', () => {
    expect(middleware).toContain('beginServedRequest()')
    expect(middleware).toContain('endServedRequest()')
  })

  it('starts the warmup only after the first page is served, and only once', () => {
    // Starting at startup deadlocks on the unbuilt plugin container, so the
    // crawl has to start later. Triggering it from the middleware after the
    // first response keeps it out of the test suite, where no HTML is ever
    // served and where it previously starved the HMR test past its timeout.
    const guard =
      /if \(!graphWarmupStarted\) \{\s*graphWarmupStarted = true\s*startClientGraphWarmup\(server\)/

    expect(middleware).toMatch(guard)
    // Exactly one call site: a second one would restart the crawl per request.
    expect(middleware.match(/startClientGraphWarmup\(server\)/g)).toHaveLength(
      1,
    )
  })
})

describe('client graph warmup scope', () => {
  const warm = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../src/node/dev-server/warm-client-graph.ts',
    ),
    'utf-8',
  )

  it('does not follow MDX specifiers', () => {
    // Following them duplicated the MDX prewarm and pulled content into the
    // module graph early enough to break the HMR regression asserting that
    // external pages never emit `boltdocs:mdx-update`.
    expect(warm).toContain('/\\.mdx?($|\\?)/')
  })
})

describe('client graph warmup yields to SSR', () => {
  const warm = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../src/node/dev-server/warm-client-graph.ts',
    ),
    'utf-8',
  )
  const middleware = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../src/node/dev-server/middleware.ts',
    ),
    'utf-8',
  )

  it('checks the Boltdocs-served-request gate, not only Vite pending requests', () => {
    // Vite's `_pendingRequests` does not cover requests served by Boltdocs'
    // own middleware, and those are the SSR renders, which the warmup must not
    // compete with.
    expect(warm).toContain('isServingRequest()')
  })

  it('gates the HTML render path in the dev middleware', () => {
    expect(middleware).toContain('beginServedRequest()')
    expect(middleware).toContain('endServedRequest()')
  })

  it('releases the gate even when the render throws', () => {
    // Without the finally block a failed render would leave the counter stuck
    // and the warmup would never run again.
    expect(middleware).toMatch(
      /beginServedRequest\(\)[\s\S]*?try \{[\s\S]*?\} finally \{[\s\S]*?endServedRequest\(\)/,
    )
  })
})
