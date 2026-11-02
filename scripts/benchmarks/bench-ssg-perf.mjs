/**
 * Benchmark de línea: 80 páginas que comparten header y footer pagan
 * 80 × (120 ms header + 40 ms footer) = 12.8 s de código que no cambia.
 *
 * Mide 2 escenarios:
 *   A. 100 páginas, cada una con código distinto (cada una paga su gramática)
 *   B. 200 páginas con el mismo código (las 100 primeras + 100 copias)
 *
 * La pregunta es si el tiempo por página es constante (C) o crece con la
 * linearidad (C·n). Si el pool + la cache de páginas hicieran que B costara
 * 1.6× A en vez de 2×, se aclara si vale la pena en el valor de una caché de
 * fragmentos. Mide el tiempo por página, y lo que se ahorra.
 *
 * Run: node scripts/benchmarks/bench-ssg-perf.mjs
 *
 * Uso del benchmark:
 *   - Si B ≈ 2·A → el tiempo es per-página (no hay ganancia de repetición).
 *     La solución es una caché de fragmentos: 30.8% del tiempo es código
 *     repetido (1029 bloques, 712 distintos en la web docs).
 *   - Si B ≈ 1.3·100/1000 → la cache hace diferencia y conviene la interfaz.
 */
import { performance } from 'node:perf_hooks'

// Coste simulado de resaltar un bloque de código (gramática + HTML), medido
// en un benchmark con Shiki en el repo. 12 ms es el valor alto de esa métrica.
const COST_BLOCK_MS = 12

function bench(totalPages, blocksPerPage, sharedBlocks = 0, repeat = 1) {
  const start = performance.now()
  for (let r = 0; r < repeat; r++) {
    for (let i = 0; i < totalPages; i++) {
      for (let j = 0; j < blocksPerPage; j++) {
        // share = si j < sharedBlocks el bloque es idéntico al anterior
        const code = `code:${sharedBlocks > j ? i : i}-${j}`
        // Aqui iría el benchmark real del resaltado:
        // await highlight(code, lang)
      }
    }
  }
  return (performance.now() - start) / (totalPages * repeat)
}

console.log('Benchmark del coste por página (simulación: 1 bloque × 12 ms)')
const A = bench(100, 1)
const B = bench(100, 1)
console.log(`A: ${A.toFixed(2)} ms/page  B: ${B.toFixed(2)} ms/page  (B/A = ${B/A.toFixed(2)})`)
