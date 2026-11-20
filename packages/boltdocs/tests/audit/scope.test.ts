import { describe, it, expect, afterEach } from 'vitest'
import path from 'node:path'
import { selectShippedFiles } from '../../src/node/security/audit/scope'
import { makePlugin, cleanupPlugin } from './test-utils'

const cleanups: string[] = []
afterEach(() => {
  const dir = cleanups.pop()
  if (dir) cleanupPlugin(dir)
})

function rel(dir: string, files: string[]): string[] {
  return files
    .map((f) => path.relative(dir, f).split(path.sep).join('/'))
    .sort()
}

describe('audit file scope', () => {
  it('respects the files publish whitelist and skips tests', () => {
    const dir = makePlugin({
      'index.js': 'export default 1',
      'dist/main.js': 'export default 2',
      'dist/sub/helper.mjs': 'export default 3',
      'test/t.test.js': 'it("x", () => fetch("https://x"))',
      'README.md': 'not code',
    })
    const files = selectShippedFiles(dir, {
      name: 'pkg',
      files: ['index.js', 'dist'],
    })
    expect(rel(dir, files)).toEqual([
      'dist/main.js',
      'dist/sub/helper.mjs',
      'index.js',
    ])
  })

  it('always includes declared entry points even outside the files field', () => {
    const dir = makePlugin({
      'lib/main.js': 'export default 1',
      'index.js': 'export default 2',
    })
    const files = selectShippedFiles(dir, {
      name: 'pkg',
      main: 'lib/main.js',
      files: ['index.js'],
    })
    expect(rel(dir, files)).toEqual(['index.js', 'lib/main.js'])
  })

  it('without a files field, walks the package minus noise', () => {
    const dir = makePlugin({
      'index.js': 'export default 1',
      'lib/util.ts': 'export const x = 1',
      'lib/util.d.ts': 'export const x: number',
      'test/t.test.js': 'it("x", () => 1)',
      'examples/demo.js': 'console.log("demo")',
      'dist/bundle.js': 'export default 2',
      'docs/guide.js': 'export default 3',
    })
    const files = selectShippedFiles(dir, { name: 'pkg' })
    expect(rel(dir, files)).toEqual(['index.js', 'lib/util.ts'])
  })

  it('respects the maxFiles cap', () => {
    const dir = makePlugin({
      'a.js': 'export default 1',
      'b.js': 'export default 2',
      'c.js': 'export default 3',
    })
    const files = selectShippedFiles(dir, { name: 'pkg' }, 2)
    expect(files).toHaveLength(2)
  })

  it('does not follow into node_modules of the plugin', () => {
    const dir = makePlugin({
      'index.js': 'export default 1',
      'node_modules/dep/index.js': 'export default 2',
    })
    const files = selectShippedFiles(dir, { name: 'pkg' })
    expect(rel(dir, files)).toEqual(['index.js'])
  })
})
