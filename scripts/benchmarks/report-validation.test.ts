import { describe, expect, it } from 'vitest'
import { isValidBaselineReport } from './report-validation'

function stats(samples: number[]) {
  return {
    samples,
    count: samples.length,
    min: samples[0] || 0,
    max: samples[samples.length - 1] || 0,
    mean: samples[0] || 0,
    median: samples[0] || 0,
    p95: samples[samples.length - 1] || 0,
    standardDeviation: 0,
  }
}

function category() {
  return { bytes: 1, files: 1 }
}

function report() {
  return {
    schemaVersion: 2,
    timestamp: new Date().toISOString(),
    sourceRoot: 'docs',
    runs: 1,
    timeoutMs: 1000,
    environment: {},
    cachePolicy: {
      cold: {
        mode: 'cold-framework',
        clearedPaths: ['dist', '.boltdocs', '.cache', '.vite'],
        preservedPaths: ['node_modules'],
        dependencyCache: 'shared',
        limitations: ['shared dependencies'],
      },
      warm: {
        mode: 'warm-framework',
        clearedPaths: [],
        preservedPaths: ['node_modules'],
        dependencyCache: 'shared',
        limitations: ['shared dependencies'],
      },
      incremental: {
        mode: 'incremental-framework',
        clearedPaths: [],
        preservedPaths: ['node_modules'],
        dependencyCache: 'shared',
        limitations: ['shared dependencies'],
      },
    },
    metrics: {
      coldBuildMs: stats([10]),
      warmBuildMs: stats([5]),
      incrementalBuildMs: stats([6]),
      renderThroughputPagesPerSecond: stats([100]),
    },
    output: {
      total: category(),
      javascript: category(),
      css: category(),
      html: category(),
      images: category(),
      fonts: category(),
      other: category(),
      compressed: { gzipBytes: 1, brotliBytes: 1 },
      contentDigest: 'a'.repeat(64),
      htmlPages: 1,
    },
    samples: { cold: [], warm: [], incremental: [], dev: [] },
  }
}

describe('baseline report validation', () => {
  it('accepts a structurally valid report', () => {
    expect(isValidBaselineReport(report())).toBe(true)
  })

  it('rejects malformed metrics without checking absolute timings', () => {
    const malformed = report()
    malformed.metrics.warmBuildMs.count = 2
    expect(isValidBaselineReport(malformed)).toBe(false)
  })

  it('rejects incomplete output inventories', () => {
    const malformed = report()
    delete malformed.output.html
    expect(isValidBaselineReport(malformed)).toBe(false)
  })
})
