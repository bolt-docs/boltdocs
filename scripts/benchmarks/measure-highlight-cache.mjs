/**
 * Medición directa del impacto del highlight cache.
 *
 * Extrae bloques de código de los archivos MDX del sitio de docs,
 * filtra solo lenguajes que Shiki soporta, y mide el tiempo de resaltado
 * con y sin caché.
 *
 * Run: node scripts/benchmarks/measure-highlight-cache.mjs
 */
import { performance } from 'node:perf_hooks'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = path.resolve(import.meta.dirname, '../..')
const DOCS_DIR = path.join(ROOT, 'docs/docs')

const COMMON_LANGS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'javascript', 'typescript',
  'bash', 'shell', 'sh', 'zsh',
  'json', 'jsonc',
  'css', 'scss', 'less',
  'html', 'xml', 'svg',
  'md', 'markdown',
  'yaml', 'yml',
  'diff', 'git',
  'python', 'py',
  'java', 'c', 'cpp', 'cs', 'go', 'rs', 'rb', 'php',
  'sql', 'graphql',
  'dockerfile', 'docker',
  'toml', 'ini', 'cfg',
  'text', 'plaintext',
])

function extractCodeBlocks(content) {
  const blocks = []
  const fenceRegex = /```(\w*)\n([\s\S]*?)\n```/g
  let match
  while ((match = fenceRegex.exec(content)) !== null) {
    const lang = (match[1] || 'text').toLowerCase()
    const code = match[2]
    blocks.push({ lang, code })
  }
  return blocks
}

function collectFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(fullPath, results)
    } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }
  return results
}

console.log('Recopilando archivos MDX...')
const files = collectFiles(DOCS_DIR)
console.log(`Archivos encontrados: ${files.length}`)

const allBlocks = []
for (const file of files) {
  try {
    const content = fs.readFileSync(file, 'utf-8')
    const blocks = extractCodeBlocks(content)
    allBlocks.push(...blocks.map(b => ({ ...b, file })))
  } catch {}
}

console.log(`Total bloques: ${allBlocks.length}`)

const supportedBlocks = allBlocks.filter(b => COMMON_LANGS.has(b.lang))
console.log(`Bloques con lenguaje soportado: ${supportedBlocks.length}`)

const blockSignature = (b) => `${b.lang}\0${b.code}`
const uniqueBlocks = new Map()
const repeatedBlocks = []

for (const block of supportedBlocks) {
  const sig = blockSignature(block)
  if (uniqueBlocks.has(sig)) {
    repeatedBlocks.push(block)
  } else {
    uniqueBlocks.set(sig, block)
  }
}

console.log(`Bloques únicos: ${uniqueBlocks.size}`)
console.log(`Bloques repetidos (2+): ${repeatedBlocks.length}`)
console.log(`% repetido: ${((repeatedBlocks.length / supportedBlocks.length) * 100).toFixed(1)}%`)

const counts = new Map()
for (const block of supportedBlocks) {
  const sig = blockSignature(block)
  counts.set(sig, (counts.get(sig) || 0) + 1)
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
console.log('\nTop 10 bloques más repetidos:')
for (const [sig, count] of sorted) {
  const [lang, code] = sig.split('\0')
  const preview = code.trim().slice(0, 50).replace(/\n/g, '\\n')
  console.log(`  ${lang} x${count}: ${preview}...`)
}

const engineDist = path.join(ROOT, 'packages/boltdocs-engine/dist')
const { ShikiAdapter, ensureLanguage } = await import(
  pathToFileURL(path.join(engineDist, 'node/mdx/shiki-adapter.mjs')).href
)

const adapter = new ShikiAdapter({
  theme: { codeHighlighting: { engine: 'shiki', theme: 'github-dark' } },
})
await adapter.initialize()

for (const lang of COMMON_LANGS) {
  await ensureLanguage(lang).catch(() => {})
}
console.log('\nLenguajes comunes precargados.')

async function measure(label, fn) {
  const start = performance.now()
  await fn()
  return performance.now() - start
}

// Test 1: Sin caché
console.log('\n--- Test: SIN caché (cada bloque resaltado individualmente) ---')
const noCacheTime = await measure('no-cache', async () => {
  for (const block of supportedBlocks) {
    await adapter.render(block.code, block.lang, undefined)
  }
})
console.log(`Tiempo sin caché: ${noCacheTime.toFixed(1)} ms (${supportedBlocks.length} bloques)`)
console.log(`Promedio por bloque: ${(noCacheTime / supportedBlocks.length).toFixed(2)} ms`)

// Test 2: Con caché
console.log('\n--- Test: CON caché (bloques únicos resaltados una vez) ---')
const cacheResults = new Map()
const withCacheTime = await measure('with-cache', async () => {
  for (const block of supportedBlocks) {
    const sig = blockSignature(block)
    if (!cacheResults.has(sig)) {
      const html = await adapter.render(block.code, block.lang, undefined)
      cacheResults.set(sig, html)
    }
  }
})
console.log(`Tiempo con caché: ${withCacheTime.toFixed(1)} ms (${supportedBlocks.length} bloques, ${uniqueBlocks.size} únicos)`)
console.log(`Promedio por bloque único: ${(withCacheTime / uniqueBlocks.size).toFixed(2)} ms`)

const ahorro = noCacheTime - withCacheTime
const pctAhorro = ((ahorro / noCacheTime) * 100).toFixed(1)
console.log('\n=== RESULTADO ===')
console.log(`Tiempo sin caché:  ${noCacheTime.toFixed(1)} ms`)
console.log(`Tiempo con caché:  ${withCacheTime.toFixed(1)} ms`)
console.log(`Ahorro:            ${ahorro.toFixed(1)} ms (${pctAhorro}%)`)
console.log(`Bloques ahorrados: ${repeatedBlocks.length} de ${supportedBlocks.length}`)

// Test 3: Simulación 4 workers (caché por worker, como Piscina pool)
console.log('\n--- Test: Simulación 4 workers (caché por worker) ---')
const WORKERS = 4
const uniqueArray = [...uniqueBlocks.values()]
const blocksPerWorker = Math.ceil(uniqueArray.length / WORKERS)
let workerSimTime = 0
for (let w = 0; w < WORKERS; w++) {
  const workerStart = performance.now()
  const workerCache = new Map()
  const start = w * blocksPerWorker
  const end = Math.min(start + blocksPerWorker, uniqueArray.length)
  for (let i = start; i < end; i++) {
    const block = uniqueArray[i]
    const sig = blockSignature(block)
    if (!workerCache.has(sig)) {
      const html = await adapter.render(block.code, block.lang, undefined)
      workerCache.set(sig, html)
    }
  }
  workerSimTime += performance.now() - workerStart
}
console.log(`Tiempo simulado 4 workers: ${workerSimTime.toFixed(1)} ms`)
const ahorroWorker = noCacheTime - workerSimTime
console.log(`Ahorro vs sin caché: ${ahorroWorker.toFixed(1)} ms (${((ahorroWorker / noCacheTime) * 100).toFixed(1)}%)`)

