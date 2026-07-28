# Nitro Phase 3 — Milestone 3: Vite Concurrente + Optimización Final

**Objetivo**: Lograr builds **4x más rápidos** mediante paralelismo extremo en Vite, eliminación de cuellos de botella en el pipeline MDX, y optimización del parser nativo.

## Arquitectura objetivo

```
Vite Build
├── Client Build ──────────────────────▶ Paralelo (ya existe)
├── Server Build ──────────────────────▶ Serial (cuello de botella)
│
├── MDX Transform Pipeline
│   ├── Worker Pool (ya existe)
│   ├── Warmup: pre-transform en paralelo
│   └── Caché compartida entre workers
│
├── Route Generation
│   ├── N-API Parser (direct FFI, sin fork)
│   └── Result caching con content hash
│
└── SSG Render
    ├── Zig Critters (CSS crítico en batch)
    └── Render paralelo por página
```

## Sub-milestones

### M1: Worker Pool Warmup (2 días)

**Problema**: Los workers MDX se crean bajo demanda. El primer lote de archivos paga el costo de:
- Creación del worker thread (~5ms)
- Carga de plugins MDX (remark, rehype, shiki) (~200ms)
- Resolución de configuración

**Solución**: Pre-crear y pre-calentar el pool de workers durante `buildStart()`.

```typescript
// worker-pool.ts
async warmup(): Promise<void> {
  const promises: Promise<void>[] = []
  for (let i = 0; i < this.maxWorkers; i++) {
    promises.push(this.createAndWarmWorker())
  }
  await Promise.all(promises)
}

private async createAndWarmWorker(): Promise<void> {
  const worker = this.spawn()
  this.workers.push(worker)
  this.idle.push(worker)
  // Envía un mensaje de warmup para que cargue los plugins
  worker.postMessage({ type: 'WARMUP' })
}
```

**Archivos a modificar**:
- `packages/core/src/node/mdx/worker-pool.ts`
- `packages/core/src/node/mdx/worker.ts`
- `packages/core/src/node/mdx/index.ts`

**Ganancia estimada**: Elimina ~200ms de latencia inicial en el primer lote de archivos.

---

### M2: Native Parser + MDX Pipeline Paralelo (3 días)

**Problema actual**: El pipeline MDX transforma archivos .md/.mdx de forma secuencial dentro del worker pool. Aunque hay múltiples workers, el cuello de botella es:
1. Parseo de frontmatter + extracción de headings (hecho por el parser nativo, rápido)
2. Compilación MDX con remark/rehype/shiki (lento, 50-200ms por archivo)

**Solución**: Dividir el trabajo en dos fases paralelas:
1. **Fase 1** (rápida): Parsear frontmatter + headings con N-API (todos los archivos en paralelo)
2. **Fase 2** (lenta): Compilar MDX con worker pool (solo archivos que cambiaron)

```
┌──────────┐    ┌──────────────┐    ┌───────────┐
│ Archivos │───▶│ N-API Parser │───▶│ Cache Hit │
│ .md/.mdx │    │ (todos, lote)│    │  MDX skip │
└──────────┘    └──────────────┘    └───────────┘
                      │                    │
                      ▼                    ▼
               Metadata list        Compilar en pool
               (rápido)              (solo cambios)
```

**Archivos a modificar**:
- `packages/core/src/node/routes/index.ts` — usar N-API para parseo de rutas
- `packages/core/src/node/mdx/index.ts` — pipeline en dos fases
- `packages/core/src/node/mdx/worker.ts` — soporte para metadatos

**Ganancia estimada**: 20-30% en tiempo total de build (reduce el trabajo del pool de workers para archivos cacheados).

---

### M3: Caché Compartida entre Workers (2 días)

**Problema**: Cada worker thread tiene su propio caché de módulos. Cuando el worker 1 compila `file-a.md` y el worker 2 necesita `file-b.md` que importa `file-a.md`, ambos workers compilan `file-a.md` por separado.

**Solución**: Caché compartida via `SharedArrayBuffer` o archivo mmap.

```typescript
// shared-cache.ts
export class SharedMdxCache {
  private cache: Map<string, string>
  
  async get(key: string): Promise<string | undefined> {
    // Primero busca en memoria compartida
    return this.cache.get(key)
  }
  
  async set(key: string, value: string): Promise<void> {
    this.cache.set(key, value)
    // Notifica a otros workers via Atomics
  }
}
```

**Archivos a modificar**:
- `packages/core/src/node/mdx/shared-cache.ts` (NUEVO)
- `packages/core/src/node/mdx/worker-pool.ts`
- `packages/core/src/node/mdx/worker.ts`

**Ganancia estimada**: 10-15% en repos con muchos imports compartidos entre archivos MDX.

---

### M4: SSG Render Paralelo Optimizado (2 días)

**Problema**: El SSG renderiza páginas secuencialmente o con un pool de concurrencia limitada.

**Solución**: Pipeline de render en 3 fases paralelas:
1. **Lectura**: Cargar HTML + loader data desde caché
2. **Render**: Renderizar páginas en paralelo (ya existe con p-queue)
3. **Post-procesado**: Inline CSS crítico con zig-critters en batch

```typescript
// Pipeline de 3 fases
const phase1 = renderQueue.add(() => renderPage(url))  // N páginas en paralelo
const phase2 = renderQueue.add(() => renderPage(url))  // N páginas en paralelo
// Post-process en batch
const allHtml = await Promise.all(phase1, phase2)
const criticalCSS = await zigCritters.processBatch(allHtml)
```

**Archivos a modificar**:
- `packages/core/src/node/pipeline/build-pipeline.ts`
- `packages/plugin-ssg/src/node/build.ts`

**Ganancia estimada**: 15-20% en el tiempo total del SSG build.

---

## Resumen de ganancias

| Milestone | Ganancia | Esfuerzo | Prioridad |
|-----------|----------|----------|-----------|
| M1: Worker Pool Warmup | 5-10% | 2 días | 🥇 Alta |
| M2: Pipeline en 2 fases | 20-30% | 3 días | 🥇 Alta |
| M3: Caché compartida | 10-15% | 2 días | 🥈 Media |
| M4: SSG optimizado | 15-20% | 2 días | 🥈 Media |
| **Total acumulado** | **50-75%** | **9 días** | |

**Nota**: Las ganancias son acumulativas y dependen del proyecto. Para docs pequeños (< 10 páginas), el overhead de workers puede no ser beneficioso. Para docs grandes (> 100 páginas), las ganancias se acercan al extremo superior.

## Archivos a crear

- `packages/core/src/node/mdx/shared-cache.ts`

## Archivos a modificar

- `packages/core/src/node/mdx/worker-pool.ts` — warmup + parallel dispatch
- `packages/core/src/node/mdx/worker.ts` — warmup handler + shared cache
- `packages/core/src/node/mdx/index.ts` — two-phase pipeline
- `packages/core/src/node/routes/index.ts` — N-API route parsing
- `packages/core/src/node/pipeline/build-pipeline.ts` — parallel SSG
- `packages/plugin-ssg/src/node/build.ts` — batch critical CSS

## Prerrequisitos

- ✅ M2 completo (N-API shared library + FFI binding) — **HECHO**
- ✅ Parser nativo con YAML frontmatter — **HECHO**
- ❌ N-API binding funcionando en CI (M2 pendiente de merge)
- ❌ Zig critters estable (actualmente experimental)
