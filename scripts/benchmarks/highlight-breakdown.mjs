/**
 * Where a code block's highlighting time actually goes, and what changes it.
 *
 * The highlighter's per-block *overhead* — options, meta objects, cache keys — is
 * down to ~1.5 µs (see `highlight-overhead.mjs`), which is nothing next to the
 * milliseconds a grammar run costs. So the question that decides whether more
 * optimisation is possible at all is: of those milliseconds, how much is our own
 * work around the engine, and how much is the engine itself?
 *
 * Two sections:
 *
 * 1. **Stages** — the same render split into tokenise, build the tree, and
 *    serialize it. Says whether our own HAST/HTML work is worth attacking.
 * 2. **Variants** — Oniguruma vs the JavaScript engine, and a light/dark theme
 *    pair vs a single theme over the same block. The pair is the framework
 *    default, so this is the cost a default site pays.
 *
 * Run the engine's build first: `pnpm --filter boltdocs build`.
 *
 * Usage: node scripts/benchmarks/highlight-breakdown.mjs
 */
import { performance } from 'node:perf_hooks'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')

// `hast-util-to-html` is the satteri processor's dependency, not a root one —
// the same copy the rehype plugin serializes with.
const { toHtml } = createRequire(
  join(ROOT, 'packages/boltdocs-processor-satteri/package.json'),
)('hast-util-to-html')

const { ShikiAdapter } = await import(
  pathToFileURL(
    join(ROOT, 'packages/boltdocs-engine/dist/node/mdx/shiki-adapter.mjs'),
  ).href
).catch((error) => {
  console.error(
    'No se pudo importar el adaptador construido. Ejecuta primero: pnpm --filter boltdocs build',
  )
  throw error
})

/** A block shaped like the ones a docs site actually has: imports, types, JSX. */
const CODE = `import { useState, useEffect, type ReactNode } from 'react'
import { createRoutes } from './ssg/create-routes'
import type { RouteMeta } from '../node/routes/types'

interface ShellProps {
  routes: RouteMeta[]
  children: ReactNode
  fallback?: ReactNode
  locale?: string
}

export function BoltdocsShell({
  routes,
  children,
  fallback = null,
  locale = 'en',
}: ShellProps) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    createRoutes(routes, locale)
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error)
      })
    return () => {
      cancelled = true
    }
  }, [routes, locale])

  if (error) return <div role="alert">{error.message}</div>
  if (!ready) return fallback
  return <div className="boltdocs-shell">{children}</div>
}
`

const N = 40

function perRun(fn) {
  const start = performance.now()
  for (let i = 0; i < N; i++) fn()
  return (performance.now() - start) / N
}

// ---------------------------------------------------------------------------
// 1. Stages — default configuration (light/dark pair, Oniguruma)
// ---------------------------------------------------------------------------

const adapter = new ShikiAdapter({
  theme: { codeHighlighting: { engine: 'shiki' } },
})
const runtime = await adapter.initialize()
await adapter.ensureLanguage('ts')
const options = adapter.getOptions('ts', undefined)
const highlighter = await adapter.getHighlighter()

// Warm-up: grammar compile, lazily-created theme objects and JIT.
for (let i = 0; i < 3; i++) runtime.codeToHast(CODE, options)

const hast = runtime.codeToHast(CODE, options)
const pre = hast.type === 'root' ? hast.children[0] : hast

const tokenise = perRun(() =>
  highlighter.codeToTokens(CODE, {
    lang: 'ts',
    themes: { light: 'github-light', dark: 'github-dark' },
  }),
)
const withHast = perRun(() => runtime.codeToHast(CODE, options))
const withHtml = perRun(() => {
  const tree = runtime.codeToHast(CODE, options)
  toHtml(tree.type === 'root' ? tree.children[0] : tree)
})

console.log(
  `\n${N} pasadas · bloque de ${CODE.split('\n').length} líneas · lang=ts · par claro/oscuro\n`,
)
console.log(`tokenizar               ${tokenise.toFixed(2)} ms`)
console.log(`+ árbol HAST            ${(withHast - tokenise).toFixed(2)} ms`)
console.log(`+ serializar HTML       ${(withHtml - withHast).toFixed(2)} ms`)
console.log(`total                   ${withHtml.toFixed(2)} ms`)
console.log(`\nHTML del bloque: ${toHtml(pre).length} bytes`)

// ---------------------------------------------------------------------------
// 2. Variants
// ---------------------------------------------------------------------------

const variants = [
  {
    label: 'Oniguruma · par claro/oscuro',
    config: { engine: 'shiki' },
  },
  {
    label: 'Oniguruma · tema único',
    config: { engine: 'shiki', theme: 'github-light' },
  },
  {
    label: 'JavaScript · par claro/oscuro',
    config: { engine: 'shiki', options: { regexEngine: 'javascript' } },
  },
  {
    label: 'JavaScript · tema único',
    config: {
      engine: 'shiki',
      theme: 'github-light',
      options: { regexEngine: 'javascript' },
    },
  },
]

const results = []
for (const variant of variants) {
  const a = new ShikiAdapter({ theme: { codeHighlighting: variant.config } })
  const rt = await a.initialize()
  await a.ensureLanguage('ts')
  const opts = a.getOptions('ts', undefined)
  for (let i = 0; i < 3; i++) rt.codeToHast(CODE, opts)
  results.push({
    label: variant.label,
    ms: perRun(() => rt.codeToHast(CODE, opts)),
  })
}

console.log('')
const slowest = Math.max(...results.map((r) => r.ms))
for (const r of results) {
  const bar = '█'.repeat(Math.round((r.ms / slowest) * 28))
  console.log(`${r.label.padEnd(32)} ${r.ms.toFixed(2).padStart(6)} ms  ${bar}`)
}
console.log(
  '\nEl par claro/oscuro corre la gramática una vez por tema: Shiki lo hace en\n' +
    '`codeToTokensWithThemes`, llamando a `codeToTokensBase` con cada tema.',
)
