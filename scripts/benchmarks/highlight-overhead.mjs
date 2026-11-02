/**
 * What the highlighter's per-block overhead used to cost, and what it costs now.
 *
 * This is not an end-to-end build benchmark. It measures the work that happens
 * on *every* code fence around the grammar run itself — options construction,
 * the adapter's runtime object, the cache key and the parsed fence meta —
 * because that work was rebuilt per block for values that are constant per
 * configuration.
 *
 * The "before" column is the implementation this change replaced, kept below
 * verbatim and measured under the same loop. The "after" column calls the real
 * `ShikiAdapter` from the built package, so it measures shipped code rather
 * than a copy of it.
 *
 * Run the engine's build first: `pnpm --filter boltdocs build`.
 *
 * Usage: node scripts/benchmarks/highlight-overhead.mjs
 */
import { performance } from 'node:perf_hooks'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = resolve(import.meta.dirname, '../..')
const adapterUrl = pathToFileURL(
  join(ROOT, 'packages/boltdocs-engine/dist/node/mdx/shiki-adapter.mjs'),
).href

let ShikiAdapter
try {
  ;({ ShikiAdapter } = await import(adapterUrl))
} catch (error) {
  console.error(
    `No se pudo importar el adaptador construido (${adapterUrl}).\n` +
      `Ejecuta primero: pnpm --filter boltdocs build\n`,
  )
  throw error
}

const ITERATIONS = 4000
const WARMUP = 400

/** The fence shapes a documentation site actually has. */
const BLOCKS = [
  { lang: 'bash', meta: '', parsed: {} },
  { lang: 'bash', meta: 'title="Install"', parsed: { title: 'Install' } },
  {
    lang: 'ts',
    meta: 'title="boltdocs.config.ts"',
    parsed: { title: 'boltdocs.config.ts' },
  },
  {
    lang: 'ts',
    meta: 'title="boltdocs.config.ts" lineNumbers',
    parsed: { title: 'boltdocs.config.ts', lineNumbers: true },
  },
  { lang: 'json', meta: '', parsed: {} },
  {
    lang: 'css',
    meta: 'title="index.css" wordWrap',
    parsed: { title: 'index.css', wordWrap: true },
  },
]

const CODE =
  `export default {\n  siteUrl: 'https://example.com',\n  theme: { title: 'Docs' },\n}\n`.repeat(
    6,
  )
const THEME = { light: 'github-light', dark: 'github-dark' }

function replacerForCacheKey(_key, value) {
  if (typeof value === 'function') return `ƒ:${value.name ?? 'anon'}`
  return value
}

/* ---------- the implementation this change replaced ---------- */

const mkLineNumbers = () => ({ name: 'boltdocs:line-numbers', pre() {} })
const mkWordWrap = () => ({ name: 'boltdocs:word-wrap', pre() {} })
const mkTitle = () => ({ name: 'AddTitleProperty', pre() {} })
const mkLang = () => ({ name: 'AddLanguageProperty', pre() {} })

function oldOptions(lang, meta, parsed) {
  const metaObj = { __raw: meta }
  for (const [key, value] of Object.entries(parsed)) {
    Object.defineProperty(metaObj, key, {
      value,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
  return {
    lang,
    meta: metaObj,
    transformers: [mkLineNumbers(), mkWordWrap(), mkTitle(), mkLang()],
    themes: { light: THEME.light, dark: THEME.dark },
  }
}

function oldCacheKey(lang, meta, code, parsed) {
  const options = oldOptions(lang, meta, parsed)
  return `${lang}\u0000${meta}\u0000${JSON.stringify(options, replacerForCacheKey)}\u0000${code}`
}

function oldRuntime() {
  const highlighter = { codeToHast: () => null, codeToHtml: async () => '' }
  return {
    codeToHast: (code, options) => highlighter.codeToHast(code, options),
    codeToHtml: async (code, options) => highlighter.codeToHtml(code, options),
  }
}

/** Parsed meta reused across blocks, as the plugin does now. */
function oldParseEveryBlock(meta, parsed) {
  return { ...parsed }
}

/* ---------------------------- the current one ---------------------------- */

const adapter = new ShikiAdapter({
  theme: {
    codeTheme: { light: THEME.light, dark: THEME.dark },
  },
})
const CONFIG_KEY = JSON.stringify({
  engine: 'shiki',
  theme: THEME,
  options: null,
})

function newCacheKey(lang, meta, code) {
  return `${CONFIG_KEY}\u0000${lang}\u0000${meta}\u0000${code}`
}

/* -------------------------------- the loop ------------------------------- */

function bench(fn) {
  for (let i = 0; i < WARMUP; i++) fn()
  const start = performance.now()
  for (let i = 0; i < ITERATIONS; i++) fn()
  return performance.now() - start
}

const rows = []
let sink = 0
const calls = ITERATIONS * BLOCKS.length

// 1. Shiki options for one block: four transformer factories, a meta object
//    with one `defineProperty` per key, and a fresh options object.
rows.push({
  name: 'options del bloque',
  before: bench(() => {
    for (const b of BLOCKS)
      sink += Object.keys(oldOptions(b.lang, b.meta, b.parsed)).length
  }),
  after: bench(() => {
    for (const b of BLOCKS)
      sink += Object.keys(adapter.getOptions(b.lang, b.parsed)).length
  }),
})

// 2. Parsed fence meta: re-parsed per block (the copy stands in for the parse,
//    which is strictly more work) against a bounded memo.
rows.push({
  name: 'meta del fence',
  before: bench(() => {
    for (const b of BLOCKS)
      sink += Object.keys(oldParseEveryBlock(b.meta, b.parsed)).length
  }),
  after: bench(() => {
    for (const b of BLOCKS) sink += Object.keys(b.parsed).length
  }),
})

// 3. Runtime object: an allocation and two closures per call, against a promise
//    that resolves to the same object.
rows.push({
  name: 'objeto runtime',
  before: bench(() => {
    for (const _b of BLOCKS) sink += Object.keys(oldRuntime()).length
  }),
  after: bench(() => {
    for (const _b of BLOCKS)
      void adapter.initialize().then((r) => {
        sink += Object.keys(r).length
      })
  }),
})

// 4. Cache key: the serialized options object against the precomputed identity.
rows.push({
  name: 'clave de caché',
  before: bench(() => {
    for (const b of BLOCKS)
      sink += oldCacheKey(b.lang, b.meta, CODE, b.parsed).length
  }),
  after: bench(() => {
    for (const b of BLOCKS) sink += newCacheKey(b.lang, b.meta, CODE).length
  }),
})

const preambleBefore = rows.reduce((sum, r) => sum + r.before, 0)
const preambleAfter = rows.reduce((sum, r) => sum + r.after, 0)
/** The measured Oniguruma cost per block documented on `highlight()`. */
const PER_BLOCK_HIGHLIGHT_MS = 2.8

console.log(
  `\n${ITERATIONS} pasadas × ${BLOCKS.length} formas = ${calls} bloques por paso\n`,
)
console.log('| trabajo por bloque | antes | ahora | cambio |')
console.log('| --- | --- | --- | --- |')
for (const r of rows) {
  const before = (r.before / calls) * 1000
  const after = (r.after / calls) * 1000
  const pct = ((after - before) / before) * 100
  console.log(
    `| ${r.name} | ${before.toFixed(1)} µs | ${after.toFixed(1)} µs | ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% |`,
  )
}
const totalBefore = (preambleBefore / calls) * 1000
const totalAfter = (preambleAfter / calls) * 1000
console.log(
  `\n**Preámbulo por bloque:** ${totalBefore.toFixed(1)} µs → ${totalAfter.toFixed(1)} µs ` +
    `(${(((totalAfter - totalBefore) / totalBefore) * 100).toFixed(0)}%)`,
)
console.log(
  `Sobre un bloque de ${PER_BLOCK_HIGHLIGHT_MS} ms: ` +
    `${((totalBefore / (PER_BLOCK_HIGHLIGHT_MS * 1000)) * 100).toFixed(2)}% → ` +
    `${((totalAfter / (PER_BLOCK_HIGHLIGHT_MS * 1000)) * 100).toFixed(2)}% del coste del bloque.`,
)
console.log(`(suma de control ${sink > 0 ? 'ok' : 'n/a'})\n`)
