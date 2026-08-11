export interface BuildPipelineStepMetric {
  name: string
  duration: number
  success: boolean
  details?: string
}

export interface BuildPipelineMetrics {
  clientBuildMs: number
  serverBuildMs: number
  ssrImportMs: number
  workerPoolSetupMs: number
  workerCount: number
  workerUsed: boolean
  pipeline?: Record<string, unknown>
  pipelineSteps?: BuildPipelineStepMetric[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Parse the machine-readable SSG phase line:
 * `[boltdocs] {"name":"Render pages",...}`.
 *
 * Parsing the complete JSON envelope avoids regex extraction of nested objects
 * such as `metrics.pipeline`, which is inherently ambiguous and used to make
 * benchmark output silently lose its timing data.
 */
export function parseBuildPipelineSteps(
  output: string,
): BuildPipelineStepMetric[] | undefined {
  const prefix = '[boltdocs] '
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith(prefix)) continue
    try {
      const record: unknown = JSON.parse(line.slice(prefix.length))
      if (!isRecord(record) || record.name !== 'Build pipeline') continue
      if (!Array.isArray(record.steps)) return undefined
      const steps = record.steps.filter(
        (step): step is Record<string, unknown> =>
          isRecord(step) &&
          typeof step.name === 'string' &&
          typeof step.duration === 'number' &&
          Number.isFinite(step.duration) &&
          typeof step.success === 'boolean',
      )
      return steps.map((step) => ({
        name: step.name as string,
        duration: step.duration as number,
        success: step.success as boolean,
        ...(typeof step.details === 'string' ? { details: step.details } : {}),
      }))
    } catch {
      // Ignore unrelated log lines.
    }
  }
  return undefined
}

export function parseRenderMetrics(
  output: string,
): BuildPipelineMetrics | undefined {
  for (const line of output.split(/\r?\n/)) {
    const prefix = '[boltdocs] '
    if (!line.startsWith(prefix)) continue

    try {
      const record: unknown = JSON.parse(line.slice(prefix.length))
      if (!isRecord(record) || record.name !== 'Render pages') continue
      const metrics = record.metrics
      if (!isRecord(metrics)) continue

      return {
        clientBuildMs: numberOrZero(metrics.clientBuildMs),
        serverBuildMs: numberOrZero(metrics.serverBuildMs),
        ssrImportMs: numberOrZero(metrics.ssrImportMs),
        workerPoolSetupMs: numberOrZero(metrics.workerPoolSetupMs),
        workerCount: numberOrZero(metrics.workerCount),
        workerUsed: metrics.workerUsed === true,
        pipeline: isRecord(metrics.pipeline) ? metrics.pipeline : undefined,
      }
    } catch {
      // Ignore unrelated or legacy log lines and continue searching.
    }
  }

  return undefined
}
