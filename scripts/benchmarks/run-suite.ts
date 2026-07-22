import type { BenchmarkConfig, SuiteResult } from './utils/types'

interface SuiteModule {
  runBuildPipelineSuite?: (config: BenchmarkConfig) => Promise<SuiteResult>
  runSSGRenderingSuite?: (config: BenchmarkConfig) => Promise<SuiteResult>
  runViteBuildSuite?: (config: BenchmarkConfig) => Promise<SuiteResult>
  runParserSuite?: (config: BenchmarkConfig) => Promise<SuiteResult>
  runMdxTransformSuite?: (config: BenchmarkConfig) => Promise<SuiteResult>
}

const SUITES: Record<string, () => Promise<SuiteModule>> = {
  pipeline: () => import('./build-pipeline.ts'),
  ssg: () => import('./ssg-rendering.ts'),
  vite: () => import('./vite-builds.ts'),
  parser: () => import('./parser-speed.ts'),
  mdx: () => import('./mdx-transforms.ts'),
}

const RUNNERS: Record<
  string,
  (mod: SuiteModule, config: BenchmarkConfig) => Promise<SuiteResult>
> = {
  pipeline: (mod, config) => mod.runBuildPipelineSuite!(config),
  ssg: (mod, config) => mod.runSSGRenderingSuite!(config),
  vite: (mod, config) => mod.runViteBuildSuite!(config),
  parser: (mod, config) => mod.runParserSuite!(config),
  mdx: (mod, config) => mod.runMdxTransformSuite!(config),
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index !== -1 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : undefined
}

async function main(): Promise<void> {
  const suiteName = getArg('--suite')
  const configRaw = getArg('--config')

  if (!suiteName) {
    process.stderr.write(JSON.stringify({ error: 'Missing --suite argument' }))
    process.exit(1)
  }

  const config: BenchmarkConfig = configRaw ? JSON.parse(configRaw) : {}

  if (!SUITES[suiteName]) {
    process.stderr.write(
      JSON.stringify({
        error: `Unknown suite: ${suiteName}. Available: ${Object.keys(SUITES).join(', ')}`,
      }),
    )
    process.exit(1)
  }

  const mod = await SUITES[suiteName]()
  const runner = RUNNERS[suiteName]
  if (!runner) {
    process.stderr.write(
      JSON.stringify({
        error: `No runner registered for suite: ${suiteName}`,
      }),
    )
    process.exit(1)
  }

  const result = await runner(mod, config)
  process.stdout.write(JSON.stringify(result))
}

main().catch((err) => {
  process.stderr.write(
    JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }),
  )
  process.exit(1)
})
