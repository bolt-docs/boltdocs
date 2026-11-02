/**
 * How much of a critical-CSS extraction is the stylesheet?
 *
 * The extractor parses the CSS on every call ✗. The stylesheet is the same
 * for every page, so the parse is repeated work — and this measures how much
 * of the per-page cost it is, which is the size of the prize.
 */
import { readFileSync } from 'node:fs'
import { createZigCrittersInstance } from '../wasm/core.mjs'

const html = readFileSync(process.argv[2], 'utf-8')
const css = readFileSync(process.argv[3], 'utf-8')
const small = '.a{color:red}.b{color:blue}'

const instance = await createZigCrittersInstance()

function time(label, styleSheet, runs = 5) {
  const start = performance.now()
  for (let i = 0; i < runs; i++) {
    instance.extractCriticalCssSync(html, styleSheet, { compress: true })
  }
  const total = performance.now() - start
  console.log(`${label}: ${(total / runs).toFixed(1)} ms por extracción`)
  return total / runs
}

const withReal = time('CSS real  ', css)
const withSmall = time('CSS mínimo', small)

console.log(
  `La diferencia (${(withReal - withSmall).toFixed(1)} ms) es lo que cuesta ` +
    'el CSS: parsear y comparar sus reglas.',
)
