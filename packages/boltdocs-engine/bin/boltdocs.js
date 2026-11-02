#!/usr/bin/env node

// Suppress DEP0205 deprecation warning for module.register() in Node 26+
const { emitWarning: _emitWarn } = process
process.emitWarning = (warning, ...args) => {
  if (warning && typeof warning === 'object' && warning.code === 'DEP0205')
    return
  if (typeof warning === 'string' && args.includes('DEP0205')) return
  return Reflect.apply(_emitWarn, process, [warning, ...args])
}

// Point Node's module compile cache at a persistent directory so compiled
// module bytecode survives process restarts (and, on Node 22.x, survives
// across reboots instead of being evicted with the tmp dir). This must be
// set before the first module is imported — any later and the loader has
// already initialized the cache.
const _boltdocsHome = process.env.HOME || process.env.USERPROFILE
if (_boltdocsHome && process.env.MODULE_COMPILE_CACHE_DIR === undefined) {
  process.env.MODULE_COMPILE_CACHE_DIR = `${_boltdocsHome}/.boltdocs/compile-cache`
}

// Warm heavy modules before the CLI entry point runs.
// Resolve preloader relative to THIS file (bin/), not the CWD.
const urlMod = await import('node:url')
const pathMod = await import('node:path')
const __dirname = pathMod.dirname(urlMod.fileURLToPath(import.meta.url))
await import(
  urlMod.pathToFileURL(pathMod.join(__dirname, 'preloader.mjs')).href
).catch(() => {})

// We use dynamic import because the core package is now ESM.
import('../dist/node/cli-entry.mjs')
