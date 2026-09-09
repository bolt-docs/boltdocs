import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveEsm, getBaseRequire } from '../../src/node/plugin/resolver'
import type { NodeRequire } from '../../src/node/plugin/resolver'

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-resolver-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

type ReqLike = {
  resolve: (id: string) => string
}

const makeReq = (resolveImpl: (id: string) => string): ReqLike => ({
  resolve: resolveImpl,
})

describe('resolveEsm', () => {
  it('resolves a scoped package via its exports map', () => {
    const pkgDir = path.join(root, 'node_modules', '@scope', 'pkg')
    fs.mkdirSync(pkgDir, { recursive: true })
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@scope/pkg',
        exports: {
          '.': { import: './dist/index.mjs', require: './dist/index.cjs' },
          './sub': { import: './dist/sub.mjs' },
        },
      }),
    )
    fs.mkdirSync(path.join(pkgDir, 'dist'))
    fs.writeFileSync(path.join(pkgDir, 'dist', 'index.mjs'), '')
    fs.writeFileSync(path.join(pkgDir, 'dist', 'sub.mjs'), '')

    const req = makeReq((id) => {
      if (id === '@scope/pkg/package.json') {
        return path.join(pkgDir, 'package.json')
      }
      throw new Error('not found')
    }) as unknown as NodeRequire

    const resolved = resolveEsm('@scope/pkg', req)
    expect(resolved).toBe(path.join(pkgDir, 'dist', 'index.mjs'))
  })

  it('resolves a subpath export', () => {
    const pkgDir = path.join(root, 'node_modules', 'pkg')
    fs.mkdirSync(pkgDir, { recursive: true })
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: 'pkg',
        exports: { './sub': './lib/sub.js' },
      }),
    )
    fs.mkdirSync(path.join(pkgDir, 'lib'))
    fs.writeFileSync(path.join(pkgDir, 'lib', 'sub.js'), '')

    const req = makeReq((id) => {
      if (id === 'pkg/package.json') return path.join(pkgDir, 'package.json')
      throw new Error('not found')
    }) as unknown as NodeRequire

    expect(resolveEsm('pkg/sub', req)).toBe(path.join(pkgDir, 'lib', 'sub.js'))
  })

  it('falls back to req.resolve when the package json cannot be located', () => {
    const target = path.join(root, 'node_modules', 'dep', 'index.js')
    const req = makeReq((id) => {
      if (id === 'dep/package.json') throw new Error('no pkg json')
      return target
    }) as unknown as NodeRequire

    expect(resolveEsm('dep', req)).toBe(target)
  })
})

describe('getBaseRequire', () => {
  it('returns a require-like resolver function', () => {
    const base = getBaseRequire()
    expect(typeof base.resolve).toBe('function')
  })
})
