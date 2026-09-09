import { describe, it, expect } from 'vitest'
import {
  devServer,
  previewServer,
  updateAvailable,
  buildSummary,
} from '../src/node/ui-utils'

describe('ui-utils server boxes', () => {
  it('should render the dev server with a version badge', () => {
    const out = devServer('http://localhost:5173/', null, { readyIn: 320 })
    expect(out).toContain('boltdocs')
    // Version is read from package.json
    expect(out).toMatch(/v\d+\.\d+\.\d+/)
    expect(out).toMatch(/ready in 320ms/)
    expect(out).toContain('DEV')
    expect(out).toContain('http://localhost:5173/')
    expect(out).toContain('use --host to expose')
  })

  it('should render the network URL when provided', () => {
    const out = devServer('http://localhost:5173/', 'http://192.168.1.10:5173/')
    expect(out).toContain('http://192.168.1.10:5173/')
  })

  it('should render the preview server with a PREVIEW badge', () => {
    const out = previewServer('http://localhost:4173/', null, {
      readyIn: 512,
    })
    expect(out).toContain('preview server')
    expect(out).toMatch(/v\d+\.\d+\.\d+/)
    expect(out).toContain('PREVIEW')
    expect(out).toContain('http://localhost:4173/')
  })

  it('should render the update box with version info', () => {
    const out = updateAvailable('1.0.0', '2.0.0')
    expect(out).toContain('update available')
    expect(out).toContain('1.0.0')
    expect(out).toContain('2.0.0')
    expect(out).toMatch(
      /(npm install|pnpm add|yarn add|bun add) boltdocs@latest/,
    )
  })
})

describe('buildSummary', () => {
  const steps = [
    { name: 'ConfigResolve', success: true, duration: 120 },
    { name: 'SSGBuild', success: true, duration: 3000 },
    { name: 'SEOWrite', success: true, duration: 5 },
  ]

  it('should render the header with version and total time', () => {
    const out = buildSummary({ totalMs: 3456, steps })
    expect(out).toContain('boltdocs')
    expect(out).toMatch(/v\d+\.\d+\.\d+/)
    expect(out).toContain('build completed')
    expect(out).toContain('3.5s')
  })

  it('should prettify pipeline step names into readable labels', () => {
    const out = buildSummary({ totalMs: 3456, steps })
    expect(out).toContain('Config resolve')
    expect(out).toContain('SSG build')
    expect(out).toContain('SEO write')
  })

  it('should render the metrics line with pluralization', () => {
    const out = buildSummary({
      totalMs: 3456,
      steps,
      pages: 1,
      jsSize: '186 kB',
      cssSize: '0 kB',
      outDir: 'dist/',
    })
    expect(out).toContain('1 page')
    expect(out).toContain('JS 186 kB')
    expect(out).toContain('CSS 0 kB')
    expect(out).toContain('→ dist/')

    const many = buildSummary({
      totalMs: 3456,
      steps,
      pages: 256,
      jsSize: '7.3 MB',
      cssSize: '102 kB',
      outDir: 'dist/',
    })
    expect(many).toContain('256 pages')
  })

  it('should flag failed steps with an error marker', () => {
    const out = buildSummary({
      totalMs: 1000,
      steps: [{ name: 'SSGBuild', success: false, duration: 900 }],
    })
    expect(out).toContain('✘')
  })
})
