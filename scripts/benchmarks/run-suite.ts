import fs from 'node:fs'
import type { BenchmarkConfig, SuiteResult } from './utils/types'

interface SuiteRunner {
  name: string
  run: (config: BenchmarkConfig) => Promise<SuiteResult>
}

const SUITES: Record<string, () => Promise<SuiteRunner>> = {
  pipeline: async () => {
    const mod = await import('./build-pipeline.ts')
    return {
      name: 'Build Pipeline',
      run: (config: BenchmarkConfig) => mod.runBuildPipelineSuite(config),
    }
  },
  ssg: async () => {
    const mod = await import('./ssg-rendering.ts')
    return {
      name: 'SSG Rendering',
      run: (config: BenchmarkConfig) => mod.runSSGRenderingSuite(config),
    }
  },
  vite: async () => {
    const mod = await import('./vite-builds.ts')
    return {
      name: 'Vite Build',
      run: (config: BenchmarkConfig) => mod.runViteBuildSuite(config),
    }
  },
  parser: async () => {
    const mod = await import('./parser-speed.ts')
    return {
      name: 'Parser',
      run: (config: BenchmarkConfig) => mod.runParserSuite(config),
    }
  },
  mdx: async () => {
    const mod = await import('./mdx-transforms.ts')
    return {
      name: 'MDX Transforms',
      run: (config: BenchmarkConfig) => mod.runMdxTransformSuite(config),
    }
  },
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index !== -1 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : undefined
}

function writeResult(result: SuiteResult, resultFile: string): void {
  const output = JSON.stringify(result)
  if (resultFile) {
    fs.writeFileSync(resultFile, output)
  } else {
    process.stdout.write(output)
  }
}

async function main(): Promise<void> {
  const suiteName = getArg('--suite')
  const configRaw = getArg('--config')
  const resultFile = getArg('--result-file')

  if (!suiteName) {
    process.stderr.write(JSON.stringify({ error: 'Missing --suite argument' }))
    process.exit(1)
  }

  const config: BenchmarkConfig = configRaw ? JSON.parse(configRaw) : {}

  const suiteLoader = SUITES[suiteName]
  if (!suiteLoader) {
    process.stderr.write(
      JSON.stringify({
        error: `Unknown suite: ${suiteName}. Available: ${Object.keys(SUITES).join(', ')}`,
      }),
    )
    process.exit(1)
  }

  const runner = await suiteLoader()
  const result = await runner.run(config)
  writeResult(result, resultFile)
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
