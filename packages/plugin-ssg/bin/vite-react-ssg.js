#!/usr/bin/env node
'use strict'

// Suppress DEP0205 deprecation warning for module.register() in Node 26+
const originalEmitWarning = process.emitWarning
process.emitWarning = function (warning, ...args) {
  if (
    typeof warning === 'string' &&
    (warning.includes('DEP0205') || warning.includes('module.register'))
  ) {
    return
  }
  if (warning && typeof warning === 'object') {
    const msg = warning.message || ''
    const code = warning.code || ''
    if (code === 'DEP0205' || msg.includes('module.register')) {
      return
    }
  }
  return originalEmitWarning.call(process, warning, ...args)
}

process.noDeprecation = true

import('../dist/node/cli.mjs')
