import type { OutputBreakdown, SampleStats } from './baseline-utils'

const SAMPLE_STAT_KEYS = [
  'samples',
  'count',
  'min',
  'max',
  'mean',
  'median',
  'p95',
  'standardDeviation',
] as const

const OUTPUT_CATEGORY_KEYS = ['bytes', 'files'] as const

function isCacheState(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (
    !['cold-framework', 'warm-framework', 'incremental-framework'].includes(
      String(value.mode),
    )
  ) {
    return false
  }
  if (!Array.isArray(value.clearedPaths)) return false
  if (!Array.isArray(value.preservedPaths)) return false
  if (
    !['shared', 'isolated', 'unknown'].includes(String(value.dependencyCache))
  ) {
    return false
  }
  return (
    value.clearedPaths.every((item) => typeof item === 'string') &&
    value.preservedPaths.every((item) => typeof item === 'string') &&
    Array.isArray(value.limitations) &&
    value.limitations.every((item) => typeof item === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isSampleStats(value: unknown): value is SampleStats {
  if (!isRecord(value)) return false
  if (!SAMPLE_STAT_KEYS.every((key) => key in value)) return false
  if (
    !Array.isArray(value.samples) ||
    value.samples.some((sample) => !isFiniteNumber(sample))
  ) {
    return false
  }
  return (
    value.count === value.samples.length &&
    value.count >= 0 &&
    isFiniteNumber(value.min) &&
    isFiniteNumber(value.max) &&
    isFiniteNumber(value.mean) &&
    isFiniteNumber(value.median) &&
    isFiniteNumber(value.p95) &&
    isFiniteNumber(value.standardDeviation)
  )
}

function isOutputCategory(value: unknown): boolean {
  if (!isRecord(value)) return false
  return OUTPUT_CATEGORY_KEYS.every(
    (key) => isFiniteNumber(value[key]) && value[key] >= 0,
  )
}

function isOutputBreakdown(value: unknown): value is OutputBreakdown {
  if (!isRecord(value)) return false
  const categories = [
    'total',
    'javascript',
    'css',
    'html',
    'images',
    'fonts',
    'other',
  ]
  if (!categories.every((key) => isOutputCategory(value[key]))) return false
  if (!isRecord(value.compressed)) return false
  if (
    typeof value.contentDigest !== 'string' ||
    value.contentDigest.length !== 64
  ) {
    return false
  }
  return (
    isFiniteNumber(value.compressed.gzipBytes) &&
    value.compressed.gzipBytes >= 0 &&
    isFiniteNumber(value.compressed.brotliBytes) &&
    value.compressed.brotliBytes >= 0 &&
    isFiniteNumber(value.htmlPages) &&
    value.htmlPages >= 0
  )
}

/**
 * Validate only stable report invariants. Deliberately avoids wall-clock
 * thresholds because CPU contention and CI scheduling make those flaky.
 */
export function isValidBaselineReport(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (
    value.schemaVersion !== 2 ||
    typeof value.timestamp !== 'string' ||
    typeof value.sourceRoot !== 'string' ||
    !isFiniteNumber(value.runs) ||
    value.runs < 1 ||
    !isFiniteNumber(value.timeoutMs) ||
    value.timeoutMs < 1
  ) {
    return false
  }

  if (
    !isRecord(value.metrics) ||
    !isOutputBreakdown(value.output) ||
    !isRecord(value.cachePolicy) ||
    !isCacheState(value.cachePolicy.cold) ||
    !isCacheState(value.cachePolicy.warm) ||
    !isCacheState(value.cachePolicy.incremental)
  ) {
    return false
  }
  const requiredMetrics = [
    'coldBuildMs',
    'warmBuildMs',
    'incrementalBuildMs',
    'renderThroughputPagesPerSecond',
  ]
  if (!requiredMetrics.every((key) => isSampleStats(value.metrics?.[key]))) {
    return false
  }
  if (
    value.metrics.devStartupMs !== undefined &&
    !isSampleStats(value.metrics.devStartupMs)
  ) {
    return false
  }
  if (
    value.metrics.devFirstResponseMs !== undefined &&
    !isSampleStats(value.metrics.devFirstResponseMs)
  ) {
    return false
  }

  if (!isRecord(value.samples)) return false
  return ['cold', 'warm', 'incremental', 'dev'].every((key) =>
    Array.isArray(value.samples?.[key]),
  )
}
