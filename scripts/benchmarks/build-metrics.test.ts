import { describe, expect, it } from 'vitest'
import { parseBuildPipelineSteps, parseRenderMetrics } from './build-metrics'

describe('parseRenderMetrics', () => {
  it('parses a structured render metrics envelope with nested pipeline data', () => {
    const line = `[boltdocs] ${JSON.stringify({
      name: 'Render pages',
      duration: 321,
      metrics: {
        clientBuildMs: 120,
        serverBuildMs: 180,
        ssrImportMs: 12,
        workerPoolSetupMs: 7,
        workerCount: 4,
        workerUsed: true,
        pipeline: { finalizeP95Ms: 9, nested: { value: 1 } },
      },
    })}`

    expect(parseRenderMetrics(`noise\n${line}\n`)).toEqual({
      clientBuildMs: 120,
      serverBuildMs: 180,
      ssrImportMs: 12,
      workerPoolSetupMs: 7,
      workerCount: 4,
      workerUsed: true,
      pipeline: { finalizeP95Ms: 9, nested: { value: 1 } },
    })
  })

  it('parses the machine-readable build pipeline step envelope', () => {
    const line = `[boltdocs] ${JSON.stringify({
      name: 'Build pipeline',
      success: true,
      steps: [
        { name: 'ConfigResolve', duration: 12, success: true },
        {
          name: 'TypeGenerate',
          duration: 4,
          success: true,
          details: 'parallel',
        },
      ],
    })}`

    expect(parseBuildPipelineSteps(line)).toEqual([
      { name: 'ConfigResolve', duration: 12, success: true },
      { name: 'TypeGenerate', duration: 4, success: true, details: 'parallel' },
    ])
  })

  it('ignores the legacy human-readable envelope', () => {
    expect(
      parseRenderMetrics(
        `[boltdocs] { name: 'Render pages', metrics: {"clientBuildMs": 1} }`,
      ),
    ).toBeUndefined()
  })
})
