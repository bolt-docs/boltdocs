#!/usr/bin/env node

// Suppress DEP0205 deprecation warning for module.register() in Node 26+
const { emitWarning: _emitWarn } = process
process.emitWarning = function (warning, ...args) {
  if (warning && typeof warning === 'object' && warning.code === 'DEP0205')
    return
  if (typeof warning === 'string' && args.includes('DEP0205')) return
  return Reflect.apply(_emitWarn, process, [warning, ...args])
}

// We use dynamic import because the core package is now ESM.
import('../dist/node/cli-entry.mjs')
