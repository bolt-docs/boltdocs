/**
 * Fine-grained client-build profiler for Boltdocs.
 *
 * Usage:
 *   pnpm exec tsx scripts/benchmarks/profile-client-fine.ts [--cold] [--root docs]
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const WORKSPACE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

function parseArgs() {
  const args = process.argv.slice(2)
  let root = path.join(WORKSPACE, 'docs')
  let cold = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cold') cold = true
    else if (args[i] === '--root' && args[i + 1]) root = path.resolve(args[++i])
  }
  return { root, cold }
}

const marks: Array<{ name: string; t: number; detail?: string }> = []
function mark(name: string, detail?: string) {
  const t = performance.now()
  const prev = marks.length ? marks[marks.length - 1].t : t
  marks.push({ name, t, detail })
  const abs = marks[0] ? t - marks[0].t : 0
  console.log(
    `[prof +${abs.toFixed(0).padStart(5)}ms Δ${(t - prev).toFixed(0).padStart(5)}ms] ${name}${detail ? ' — ' + detail : ''}`,
  )
}

function cleanProject(root: string) {
  for (const d of [
    '.boltdocs/build',
    '.boltdocs/compiled',
    'dist',
    '.boltdocs/cache',
  ]) {
    const p = path.join(root, d)
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true })
  }
}

async function main() {
  const { root, cold } = parseArgs()
  process.chdir(root)
  process.env.NODE_ENV = 'production'
  process.env.MODE = 'production'

  if (cold) {
    console.log(`Cold profile — cleaning ${root}`)
    cleanProject(root)
  }

  mark('start')

  // Import from source via tsx
  const configMod = await import(
    pathToFileURL(path.join(WORKSPACE, 'packages/core/src/node/config.ts')).href
  )
  mark('import-config-module')

  // --- resolveConfig internals ---
  const tRc = performance.now()
  // Manual breakdown mirroring resolveConfig
  const { loadConfigFromFile } = await import(
    pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href
  ).catch(async () => {
    // fall back to workspace vite
    const req = createRequire(path.join(root, 'package.json'))
    const vitePath = req.resolve('vite')
    return import(pathToFileURL(vitePath).href)
  })
  mark('import-vite-for-config')

  const CONFIG_FILES = [
    'boltdocs.config.js',
    'boltdocs.config.mjs',
    'boltdocs.config.ts',
  ]
  let userConfig: any = {}
  let configFileUsed = ''
  for (const filename of CONFIG_FILES) {
    const configPath = path.resolve(root, filename)
    if (!fs.existsSync(configPath)) continue
    const tLoad = performance.now()
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      configPath,
      root,
    )
    mark(
      'loadConfigFromFile',
      `${filename} ${(performance.now() - tLoad).toFixed(0)}ms`,
    )
    if (loaded) {
      userConfig = loaded.config
      configFileUsed = filename
      break
    }
  }

  // Full resolveConfig for real config object
  const tFull = performance.now()
  const config = await configMod.resolveConfig(
    'docs',
    root,
    'build',
    'production',
  )
  mark(
    'resolveConfig-full',
    `${(performance.now() - tFull).toFixed(0)}ms (file=${configFileUsed})`,
  )

  // Plugin inspection cost
  const tInsp = performance.now()
  try {
    const { inspectPluginsSecurity } = await import(
      pathToFileURL(
        path.join(WORKSPACE, 'packages/core/src/node/security/inspect.ts'),
      ).href
    )
    inspectPluginsSecurity(config, root)
  } catch (e) {
    console.warn('inspect skip', e)
  }
  mark('inspectPluginsSecurity', `${(performance.now() - tInsp).toFixed(0)}ms`)

  // createViteConfig breakdown
  const tCvcImport = performance.now()
  const indexMod = await import(
    pathToFileURL(path.join(WORKSPACE, 'packages/core/src/node/index.ts')).href
  )
  mark('import-index', `${(performance.now() - tCvcImport).toFixed(0)}ms`)

  // Time the dynamic imports inside createViteConfig by calling pieces
  const tParallel = performance.now()
  const [reactMod, tailwindcssMod, pluginMod, routesMod, typesMod] =
    await Promise.all([
      import('@vitejs/plugin-react'),
      import('@tailwindcss/vite'),
      import(
        pathToFileURL(
          path.join(WORKSPACE, 'packages/core/src/node/plugin/index.ts'),
        ).href
      ),
      import(
        pathToFileURL(
          path.join(WORKSPACE, 'packages/core/src/node/routes/index.ts'),
        ).href
      ),
      import(
        pathToFileURL(
          path.join(WORKSPACE, 'packages/core/src/node/types-generator.ts'),
        ).href
      ),
    ])
  mark('cvc-dynamic-imports', `${(performance.now() - tParallel).toFixed(0)}ms`)

  const tRoutes = performance.now()
  const routes = await routesMod.generateRoutes(
    'docs',
    config,
    undefined,
    false,
  )
  mark(
    'generateRoutes-in-cvc',
    `${(performance.now() - tRoutes).toFixed(0)}ms, ${routes.length} routes`,
  )

  const tTypes = performance.now()
  const routePaths = routes.map((r: any) => r.path)
  typesMod.generateProjectTypes(config, 'docs', root, routePaths)
  typesMod.writeLinkTree(routePaths)
  mark('generateTypes+linkTree', `${(performance.now() - tTypes).toFixed(0)}ms`)

  const tPlugin = performance.now()
  const plugins = pluginMod.boltdocsPlugin({ docsDir: 'docs', root }, config)
  mark(
    'boltdocsPlugin()',
    `${(performance.now() - tPlugin).toFixed(0)}ms, ${plugins.length} plugins`,
  )

  // Full createViteConfig
  const tCvc = performance.now()
  const viteConfig = await indexMod.createViteConfig(root, 'production', config)
  mark('createViteConfig-full', `${(performance.now() - tCvc).toFixed(0)}ms`)

  // ---- Client vite build with transform timers ----
  const transformWall = {
    total: 0,
    count: 0,
    mdx: 0,
    mdxCount: 0,
    compiled: 0,
    compiledCount: 0,
    tsx: 0,
    tsxCount: 0,
    css: 0,
    cssCount: 0,
    other: 0,
    slow: [] as Array<{ id: string; ms: number }>,
  }
  let moduleCount = 0
  let renderChunkCount = 0
  let chunkCount = 0
  const phaseTimes: Record<string, number> = {}

  ;(globalThis as any).__tfStarts = new Map<string, number>()

  const timerPre = {
    name: 'profile-timers-pre',
    enforce: 'pre' as const,
    buildStart() {
      phaseTimes.buildStartBegin = performance.now()
      mark('client-buildStart')
    },
    transform(_code: string, id: string) {
      ;(globalThis as any).__tfStarts.set(id, performance.now())
      return null
    },
  }

  const timerPost = {
    name: 'profile-timers-post',
    enforce: 'post' as const,
    buildStart() {
      phaseTimes.buildStartMs =
        performance.now() - (phaseTimes.buildStartBegin || performance.now())
      mark(
        'client-buildStart-done',
        `${phaseTimes.buildStartMs.toFixed(0)}ms (satteri precompile lives here)`,
      )
    },
    transform(_code: string, id: string) {
      const starts: Map<string, number> = (globalThis as any).__tfStarts
      if (!starts?.has(id)) return null
      const dt = performance.now() - starts.get(id)!
      starts.delete(id)
      transformWall.total += dt
      transformWall.count++
      const clean = id.split('?')[0]
      const rel = clean.replace(root, '').replace(WORKSPACE, '')
      if (
        clean.includes('.boltdocs/compiled') ||
        clean.includes('compiled/pages')
      ) {
        transformWall.compiled += dt
        transformWall.compiledCount++
      } else if (clean.endsWith('.md') || clean.endsWith('.mdx')) {
        transformWall.mdx += dt
        transformWall.mdxCount++
      } else if (clean.endsWith('.css') || id.includes('tailwind')) {
        transformWall.css += dt
        transformWall.cssCount++
      } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(clean)) {
        transformWall.tsx += dt
        transformWall.tsxCount++
      } else {
        transformWall.other += dt
      }
      if (dt > 40) transformWall.slow.push({ id: rel, ms: Math.round(dt) })
      return null
    },
    moduleParsed() {
      moduleCount++
    },
    renderStart() {
      phaseTimes.renderStart = performance.now()
      mark('renderStart', `${moduleCount} modules parsed so far`)
    },
    renderChunk() {
      renderChunkCount++
      return null
    },
    generateBundle(
      _o: unknown,
      bundle: Record<
        string,
        {
          type: string
          code?: string
          source?: string | Uint8Array
          fileName: string
        }
      >,
    ) {
      phaseTimes.generateBundle = performance.now()
      chunkCount = Object.keys(bundle).length
      mark('generateBundle', `${chunkCount} outputs`)
    },
    writeBundle(_o: unknown, bundle: Record<string, any>) {
      mark('writeBundle', `${Object.keys(bundle).length} files`)
      const sizes = Object.entries(bundle).map(([k, v]: any) => {
        const sz =
          v.type === 'chunk'
            ? v.code?.length || 0
            : typeof v.source === 'string'
              ? v.source.length
              : v.source?.byteLength || 0
        return [k, sz] as const
      })
      sizes.sort((a, b) => b[1] - a[1])
      console.log('  Top assets by raw size:')
      for (const [k, sz] of sizes.slice(0, 10)) {
        console.log(`    ${(sz / 1024).toFixed(1).padStart(8)} kB  ${k}`)
      }
    },
    closeBundle() {
      mark('closeBundle')
    },
  }

  // Capture satteri logs
  const origLog = console.log
  console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(' ')
    if (msg.includes('[satteri-mdx]')) mark('satteri', msg)
    origLog(...args)
  }

  viteConfig.plugins = [
    ...((viteConfig.plugins as any[]) || []),
    timerPre,
    timerPost,
  ]
  viteConfig.logLevel = 'warn'
  viteConfig.clearScreen = false

  const vite = await import('vite')
  mark('import-vite-build')

  const tBuild = performance.now()
  await vite.build(
    vite.mergeConfig(viteConfig, {
      build: {
        target: 'esnext',
        sourcemap: false,
        manifest: true,
        ssrManifest: true,
        chunkSizeWarningLimit: 2000,
        reportCompressedSize: false,
        rolldownOptions: {
          input: {
            app: path.join(root, 'index.html'),
          },
        },
      },
      mode: 'production',
      customLogger: vite.createLogger('warn'),
    }),
  )
  const clientBuildMs = performance.now() - tBuild
  mark('client-viteBuild-done', `${clientBuildMs.toFixed(0)}ms`)

  console.log = origLog

  console.log('\n========== CLIENT BUILD PROFILE ==========')
  console.log(`Root: ${root}`)
  console.log(`Cold: ${cold}`)
  console.log(`Routes: ${routes.length}`)
  console.log(`\n--- Pipeline prelude ---`)
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i]
    const abs = Math.round(m.t - marks[0].t)
    const delta = i === 0 ? 0 : Math.round(m.t - marks[i - 1].t)
    console.log(
      `  ${String(abs).padStart(6)}ms  Δ${String(delta).padStart(5)}ms  ${m.name}${m.detail ? ' — ' + m.detail : ''}`,
    )
  }

  console.log(`\n--- Transform chain (pre→post wall) ---`)
  console.log(`  count:     ${transformWall.count}`)
  console.log(`  total:     ${transformWall.total.toFixed(0)}ms`)
  console.log(
    `  raw .mdx:  ${transformWall.mdxCount} / ${transformWall.mdx.toFixed(0)}ms`,
  )
  console.log(
    `  compiled:  ${transformWall.compiledCount} / ${transformWall.compiled.toFixed(0)}ms`,
  )
  console.log(
    `  ts/js:     ${transformWall.tsxCount} / ${transformWall.tsx.toFixed(0)}ms`,
  )
  console.log(
    `  css:       ${transformWall.cssCount} / ${transformWall.css.toFixed(0)}ms`,
  )
  console.log(`  other:     ${transformWall.other.toFixed(0)}ms`)
  console.log(`  modules:   ${moduleCount}`)
  console.log(
    `  chunks:    ${renderChunkCount} renderChunk, ${chunkCount} bundle entries`,
  )
  console.log(`\n  Slow transforms (>40ms):`)
  transformWall.slow
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 20)
    .forEach((s) => console.log(`    ${String(s.ms).padStart(5)}ms  ${s.id}`))

  const report = {
    timestamp: new Date().toISOString(),
    root,
    cold,
    routeCount: routes.length,
    clientBuildMs: Math.round(clientBuildMs),
    marks: marks.map((m, i) => ({
      name: m.name,
      absMs: Math.round(m.t - marks[0].t),
      deltaMs: i === 0 ? 0 : Math.round(m.t - marks[i - 1].t),
      detail: m.detail,
    })),
    transform: {
      ...transformWall,
      slow: transformWall.slow.sort((a, b) => b.ms - a.ms).slice(0, 30),
    },
    moduleCount,
    renderChunkCount,
    chunkCount,
    phaseTimes: {
      buildStartMs: phaseTimes.buildStartMs,
    },
  }

  const outDir = path.join(WORKSPACE, '.boltdocs/benchmarks')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(
    outDir,
    `client-profile-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`,
  )
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
  console.log(`\nWrote ${outFile}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
