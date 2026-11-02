import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }

type PackageShape = {
  exports: Record<string, Record<string, string>>
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
}

const packageShape = pkg as unknown as PackageShape

describe('@bdocs/ssg package contract', () => {
  it('keeps React and ReactDOM as required consumer peers', () => {
    expect(packageShape.peerDependencies.react).toBe('^19.0.0')
    expect(packageShape.peerDependencies['react-dom']).toBe('^19.0.0')
  })

  it('keeps Helmet available as an SSG runtime dependency', () => {
    expect(packageShape.dependencies['react-helmet-async']).toBe('^2.0.1')
  })

  it('publishes ESM and CommonJS entrypoints for the runtime', () => {
    for (const exportKey of ['.', './node']) {
      expect(packageShape.exports[exportKey]?.import).toMatch(/\.mjs$/)
      expect(packageShape.exports[exportKey]?.require).toMatch(/\.cjs$/)
    }
  })
})
