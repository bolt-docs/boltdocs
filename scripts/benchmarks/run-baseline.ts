import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import {
  collectOutputBreakdown,
  getBenchmarkEnvironment,
  findConfiguredDevRoute,
  normalizeDevRoute,
  summarizeSamples,
  describeCacheState,
  type BenchmarkCacheMode,
  type BenchmarkCacheState,
  type OutputBreakdown,
  type SampleStats,
} from './baseline-utils'
import { isValidBaselineReport } from './report-validation'
import {
  parseBuildPipelineSteps,
  parseRenderMetrics,
  type BuildPipelineMetrics,
  type BuildPipelineStepMetric,
} from './build-metrics'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..')
const DEFAULT_RUNS = 3
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const BENCHMARK_ROOT = path.join(WORKSPACE_ROOT, '.boltdocs', 'benchmarks')

interface CliOptions {
  runs: number
  root: string
  skipDev: boolean
  timeoutMs: number
  output: string | null
  route: string | null
}

interface BuildSample {
  durationMs: number
  /** RSS of the CLI parent process only; worker RSS is not included. */
  peakProcessRssKb?: number
  success: boolean
  pages: number
  renderPagesMs: number
  renderPagesPerSecond: number
  output: OutputBreakdown
  cacheState: BenchmarkCacheState
  pipeline?: BuildPipelineMetrics
  pipelineSteps?: BuildPipelineStepMetric[]
  stderr?: string
}

interface DevSample {
  startupMs: number
  firstResponseMs: number
  route: string
}

interface BaselineReport {
  schemaVersion: 2
  timestamp: string
  sourceRoot: string
  runs: number
  timeoutMs: number
  environment: ReturnType<typeof getBenchmarkEnvironment>
  cachePolicy: {
    cold: BenchmarkCacheState
    warm: BenchmarkCacheState
    incremental: BenchmarkCacheState
  }
  metrics: {
    coldBuildMs: SampleStats
    warmBuildMs: SampleStats
    incrementalBuildMs: SampleStats
    devStartupMs?: SampleStats
    devFirstResponseMs?: SampleStats
    renderThroughputPagesPerSecond: SampleStats
  }
  output: OutputBreakdown
  samples: {
    cold: BuildSample[]
    warm: BuildSample[]
    incremental: BuildSample[]
    dev: DevSample[]
  }
}

function parseArgs(argv: string[]): CliOptions {
  const getValue = (flag: string): string | null => {
    const index = argv.indexOf(flag)
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : null
  }
  const runsValue = Number.parseInt(getValue('--runs') || '', 10)
  const timeoutValue = Number.parseInt(getValue('--timeout') || '', 10)
  const rootValue = getValue('--root') || 'docs'
  const output = getValue('--output')
  const route = getValue('--route')

  return {
    runs:
      Number.isInteger(runsValue) && runsValue > 0 ? runsValue : DEFAULT_RUNS,
    root: path.resolve(WORKSPACE_ROOT, rootValue),
    skipDev: argv.includes('--skip-dev'),
    timeoutMs:
      Number.isInteger(timeoutValue) && timeoutValue > 0
        ? timeoutValue
        : DEFAULT_TIMEOUT_MS,
    output,
    route,
  }
}

function printHelp(): void {
  console.log(`
Phase 0 reproducible Boltdocs baseline

Usage:
  pnpm benchmark:baseline [options]

Options:
  --runs <n>       Repetitions per build scenario (default: 3)
  --root <path>    Project directory relative to the workspace (default: docs)
  --skip-dev       Skip dev-start and first-response measurements
  --timeout <ms>   Per-build timeout (default: 600000)
  --output <path>  Report path relative to the workspace
  --route <path>   Dev route to request (overrides config detection)

The benchmark copies the project to a temporary sandbox and never edits the
source project. Results are written under .boltdocs/benchmarks by default.
`)
}

function copyProject(source: string, destination: string): void {
  const ignored = new Set(['node_modules', 'dist', '.boltdocs', '.git'])
  fs.mkdirSync(destination, { recursive: true })

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)
    if (entry.isDirectory()) {
      copyProject(sourcePath, destinationPath)
    } else if (entry.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(sourcePath), destinationPath)
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath)
    }
  }
}

function createSandbox(source: string): string {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-baseline-'))
  try {
    copyProject(source, sandbox)

    const nodeModules = path.join(source, 'node_modules')
    if (!fs.existsSync(nodeModules)) {
      throw new Error(`Missing dependencies: ${nodeModules}`)
    }
    fs.symlinkSync(nodeModules, path.join(sandbox, 'node_modules'))
    return sandbox
  } catch (error) {
    removePath(sandbox)
    throw error
  }
}

function removePath(target: string): void {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
}

function clearBuildArtifacts(sandbox: string): void {
  removePath(path.join(sandbox, 'dist'))
  removePath(path.join(sandbox, '.boltdocs'))
  removePath(path.join(sandbox, '.cache'))
  removePath(path.join(sandbox, '.vite'))
}

function cacheModeForBuild(
  mode: 'cold' | 'warm' | 'incremental',
): BenchmarkCacheMode {
  if (mode === 'cold') return 'cold-framework'
  if (mode === 'warm') return 'warm-framework'
  return 'incremental-framework'
}

function findCli(source: string): string {
  const packageBin = path.join(
    source,
    'node_modules',
    'boltdocs',
    'bin',
    'boltdocs.js',
  )
  if (fs.existsSync(packageBin)) return fs.realpathSync(packageBin)
  const workspaceBin = path.join(
    WORKSPACE_ROOT,
    'packages',
    'core',
    'bin',
    'boltdocs.js',
  )
  if (fs.existsSync(workspaceBin)) return workspaceBin
  throw new Error(
    'Could not find the local boltdocs CLI. Build the core package first.',
  )
}

function parsePhaseOutput(stdout: string, name: string): number {
  const prefix = '[boltdocs] '
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith(prefix)) continue
    try {
      const record: unknown = JSON.parse(line.slice(prefix.length))
      if (
        typeof record === 'object' &&
        record !== null &&
        (record as { name?: unknown }).name === name &&
        typeof (record as { duration?: unknown }).duration === 'number'
      ) {
        return (record as { duration: number }).duration
      }
    } catch {
      // Fall back to the legacy human-readable phase format below.
    }
  }

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = stdout.match(
    new RegExp(
      `\\[boltdocs\\]\\s*\\{\\s*name:\\s*'${escapedName}'\\s*,\\s*duration:\\s*([\\d.]+)`,
    ),
  )
  return match ? Number.parseFloat(match[1]) : 0
}

function countHtmlPages(rootDir: string): number {
  let count = 0
  if (!fs.existsSync(rootDir)) return count
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.name === 'assets' || entry.name.startsWith('.')) continue
    const filePath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) count += countHtmlPages(filePath)
    else if (entry.isFile() && entry.name.endsWith('.html')) count++
  }
  return count
}

function readRssKb(pid: number | undefined): number | undefined {
  if (process.platform !== 'linux' || !pid) return undefined
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8')
    const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m)
    return match ? Number.parseInt(match[1], 10) : undefined
  } catch {
    return undefined
  }
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv,
  setActiveProcess: (process: ReturnType<typeof spawn> | null) => void,
): Promise<{
  code: number | null
  stdout: string
  stderr: string
  peakProcessRssKb?: number
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    setActiveProcess(child)
    let stdout = ''
    let stderr = ''
    let settled = false
    let exitCode: number | null = null
    let fallbackTimer: NodeJS.Timeout | undefined
    let rssTimer: NodeJS.Timeout | undefined
    let peakProcessRssKb: number | undefined
    const sampleRss = () => {
      const rss = readRssKb(child.pid)
      if (rss !== undefined) {
        peakProcessRssKb = Math.max(peakProcessRssKb ?? 0, rss)
      }
    }
    const stopRssSampling = () => {
      if (rssTimer) {
        clearInterval(rssTimer)
        rssTimer = undefined
      }
      sampleRss()
    }
    rssTimer = setInterval(sampleRss, 20)
    const finish = (code: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (fallbackTimer) clearTimeout(fallbackTimer)
      stopRssSampling()
      child.stdout?.destroy()
      child.stderr?.destroy()
      setActiveProcess(null)
      resolve({ code, stdout, stderr, peakProcessRssKb })
    }
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      killProcessTree(child)
      stopRssSampling()
      setActiveProcess(null)
      reject(new Error(`Process timed out after ${timeoutMs}ms: ${command}`))
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopRssSampling()
      setActiveProcess(null)
      reject(error)
    })
    child.on('exit', (code) => {
      if (settled) return
      exitCode = code
      // Prefer `close`, which means the readable pipes drained. A descendant
      // can inherit a pipe indefinitely, so retain a bounded fallback.
      fallbackTimer = setTimeout(() => finish(exitCode), 500)
    })
    child.on('close', (code) => finish(exitCode ?? code))
  })
}

async function runBuild(
  sandbox: string,
  cli: string,
  mode: 'cold' | 'warm' | 'incremental',
  timeoutMs: number,
  setActiveProcess: (process: ReturnType<typeof spawn> | null) => void,
): Promise<BuildSample> {
  if (mode === 'cold') clearBuildArtifacts(sandbox)
  const start = performance.now()
  const result = await runProcess(
    process.execPath,
    [cli, 'build'],
    sandbox,
    timeoutMs,
    {
      ...process.env,
      CI: 'true',
      NODE_ENV: 'production',
      BOLTDOCS_LOG_LEVEL: 'info',
      BOLTDOCS_BENCHMARK_PHASES: 'true',
    },
    setActiveProcess,
  )
  const durationMs = performance.now() - start
  const outputDir = path.join(sandbox, 'dist')
  const output = collectOutputBreakdown(outputDir)
  const pages = output.htmlPages || countHtmlPages(outputDir)
  const renderPagesMs = parsePhaseOutput(
    `${result.stdout}\n${result.stderr}`,
    'Render pages',
  )
  const renderPagesPerSecond =
    renderPagesMs > 0 ? (pages / renderPagesMs) * 1000 : 0
  const buildOutput = `${result.stdout}\n${result.stderr}`
  const pipeline = parseRenderMetrics(buildOutput)
  const pipelineSteps = parseBuildPipelineSteps(buildOutput)
  const success =
    result.code === 0 && pages > 0 && (renderPagesMs > 0 || mode !== 'cold')
  const validationError =
    result.code === 0 && !success
      ? `Build produced ${pages} HTML page(s) and ${renderPagesMs}ms Render pages timing for ${mode}`
      : undefined

  return {
    durationMs,
    peakProcessRssKb: result.peakProcessRssKb,
    success,
    pages,
    renderPagesMs,
    renderPagesPerSecond,
    output,
    cacheState: describeCacheState(sandbox, cacheModeForBuild(mode)),
    pipeline,
    pipelineSteps,
    ...(!success
      ? {
          stderr: validationError || result.stderr.slice(-4000),
        }
      : {}),
  }
}

function findFirstMarkdown(sandbox: string): string {
  const stack = [sandbox]
  while (stack.length > 0) {
    const directory = stack.pop()
    if (!directory) continue
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.boltdocs', '.git'].includes(entry.name)) {
        continue
      }
      const filePath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('_')) stack.push(filePath)
      } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
        return filePath
      }
    }
  }
  throw new Error(`No Markdown file found under ${sandbox}`)
}

async function getFreePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (!port) throw new Error('Could not allocate a free TCP port')
  return port
}

function waitForDevServer(
  cli: string,
  sandbox: string,
  port: number,
  timeoutMs: number,
  setActiveProcess: (process: ReturnType<typeof spawn> | null) => void,
): Promise<{ process: ReturnType<typeof spawn>; startedAt: number }> {
  return new Promise((resolve, reject) => {
    const start = performance.now()
    const child = spawn(
      process.execPath,
      [cli, 'dev', '--port', String(port), '--host', '127.0.0.1'],
      {
        cwd: sandbox,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          BOLTDOCS_LOG_LEVEL: 'info',
        },
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    setActiveProcess(child)
    let output = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      killProcessTree(child)
      setActiveProcess(null)
      reject(
        new Error(
          `Dev server timed out after ${timeoutMs}ms.\n${output.slice(-3000)}`,
        ),
      )
    }, timeoutMs)

    const onData = (chunk: Buffer) => {
      output += chunk.toString()
      if (settled) return
      const ready =
        output.includes(`:${port}`) &&
        /(http:\/\/|Local:|ready|listening)/i.test(output)
      if (!ready) return
      settled = true
      clearTimeout(timer)
      resolve({ process: child, startedAt: start })
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      setActiveProcess(null)
      reject(error)
    })
    child.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      setActiveProcess(null)
      reject(
        new Error(
          `Dev server exited before ready with code ${code}.\n${output}`,
        ),
      )
    })
  })
}

function killProcessTree(child: ReturnType<typeof spawn>): void {
  if (child.pid) {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
  // Detached Vite processes may keep the benchmark alive through inherited
  // pipes even after the process group receives SIGTERM.
  child.stdout?.destroy()
  child.stderr?.destroy()
  child.unref()
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect(port, '127.0.0.1')
        const finish = (error?: Error) => {
          socket.destroy()
          if (error) reject(error)
          else resolve()
        }
        socket.once('connect', () => finish())
        socket.once('error', (error) => finish(error))
      })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  throw new Error(`Dev server port ${port} did not become available in time`)
}
function findDevRoute(sandbox: string): string {
  const configNames = [
    'boltdocs.config.ts',
    'boltdocs.config.mts',
    'boltdocs.config.js',
    'boltdocs.config.mjs',
  ]
  for (const name of configNames) {
    const configPath = path.join(sandbox, name)
    if (!fs.existsSync(configPath)) continue
    return findConfiguredDevRoute(fs.readFileSync(configPath, 'utf8'))
  }
  return '/'
}

async function requestFirstPage(port: number, route: string): Promise<number> {
  const start = performance.now()
  await new Promise<void>((resolve, reject) => {
    const request = http.get(`http://127.0.0.1:${port}${route}`, (response) => {
      if (
        response.statusCode !== undefined &&
        (response.statusCode < 200 || response.statusCode >= 300)
      ) {
        response.resume()
        reject(new Error(`First page returned HTTP ${response.statusCode}`))
        return
      }
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
      })
      response.once('end', () => {
        if (!body.toLowerCase().includes('<html')) {
          reject(new Error('First page response did not contain HTML'))
          return
        }
        resolve()
      })
    })
    request.setTimeout(30_000, () => {
      request.destroy(new Error('First page request timed out'))
    })
    request.once('error', reject)
  })
  return performance.now() - start
}

async function runDev(
  sandbox: string,
  cli: string,
  timeoutMs: number,
  configuredRoute: string | null,
  setActiveProcess: (process: ReturnType<typeof spawn> | null) => void,
): Promise<DevSample> {
  const port = await getFreePort()
  const route = configuredRoute
    ? normalizeDevRoute(configuredRoute)
    : findDevRoute(sandbox)
  let server: Awaited<ReturnType<typeof waitForDevServer>> | undefined
  try {
    server = await waitForDevServer(
      cli,
      sandbox,
      port,
      timeoutMs,
      setActiveProcess,
    )
    await waitForPort(port, timeoutMs)
    return {
      startupMs: performance.now() - server.startedAt,
      firstResponseMs: await requestFirstPage(port, route),
      route,
    }
  } finally {
    if (server) killProcessTree(server.process)
    setActiveProcess(null)
  }
}

function outputSignature(output: OutputBreakdown): string {
  return JSON.stringify({
    total: output.total,
    javascript: output.javascript,
    css: output.css,
    html: output.html,
    images: output.images,
    fonts: output.fonts,
    other: output.other,
    htmlPages: output.htmlPages,
    compressed: output.compressed,
    contentDigest: output.contentDigest,
  })
}

function outputInventorySignature(output: OutputBreakdown): string {
  return JSON.stringify({
    totalFiles: output.total.files,
    javascriptFiles: output.javascript.files,
    cssFiles: output.css.files,
    htmlFiles: output.html.files,
    imageFiles: output.images.files,
    fontFiles: output.fonts.files,
    otherFiles: output.other.files,
    htmlPages: output.htmlPages,
  })
}

function assertOutputParity(
  cold: BuildSample[],
  warm: BuildSample[],
  incremental: BuildSample[],
): OutputBreakdown {
  const first = cold[0]?.output
  if (!first) throw new Error('No successful output sample was produced')
  const exactSignature = outputSignature(first)
  const coldDifference = cold.findIndex(
    (sample) => outputSignature(sample.output) !== exactSignature,
  )
  const warmDifference = warm.findIndex(
    (sample) => outputSignature(sample.output) !== exactSignature,
  )
  if (coldDifference >= 0 || warmDifference >= 0) {
    const details = [
      coldDifference >= 0
        ? `cold[${coldDifference}] digest ${cold[coldDifference].output.contentDigest} (expected ${first.contentDigest})`
        : null,
      warmDifference >= 0
        ? `warm[${warmDifference}] digest ${warm[warmDifference].output.contentDigest} (expected ${first.contentDigest})`
        : null,
    ]
      .filter(Boolean)
      .join('; ')
    throw new Error(
      `Cold and warm output bytes changed between repeated runs: ${details}`,
    )
  }

  const inventorySignature = outputInventorySignature(first)
  if (
    incremental.some(
      (sample) =>
        outputInventorySignature(sample.output) !== inventorySignature,
    )
  ) {
    throw new Error(
      'Incremental output inventory changed; edited content may change bytes but not the file/page shape',
    )
  }
  return first
}

function assertSuccessfulSamples(
  scenario: string,
  samples: BuildSample[],
): void {
  const failed = samples.find((sample) => !sample.success)
  if (failed) {
    throw new Error(
      `${scenario} benchmark failed${failed.stderr ? `:\n${failed.stderr}` : ''}`,
    )
  }
}

function reportPath(value: string | null): string {
  if (!value) {
    fs.mkdirSync(BENCHMARK_ROOT, { recursive: true })
    return path.join(
      BENCHMARK_ROOT,
      `baseline-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    )
  }
  return path.resolve(WORKSPACE_ROOT, value)
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    return
  }
  const options = parseArgs(argv)
  if (!fs.existsSync(options.root))
    throw new Error(`Benchmark root not found: ${options.root}`)

  const sandbox = createSandbox(options.root)
  let activeProcess: ReturnType<typeof spawn> | null = null
  let cleanupDone = false
  const cleanup = () => {
    if (cleanupDone) return
    cleanupDone = true
    removePath(sandbox)
  }
  const stopOnSignal = (_signal: NodeJS.Signals, exitCode: number) => {
    if (activeProcess) killProcessTree(activeProcess)
    cleanup()
    process.exit(exitCode)
  }
  process.once('SIGINT', () => stopOnSignal('SIGINT', 130))
  process.once('SIGTERM', () => stopOnSignal('SIGTERM', 143))

  try {
    const cli = findCli(options.root)
    const incrementalFile = findFirstMarkdown(sandbox)
    const originalContent = fs.readFileSync(incrementalFile, 'utf8')
    const cold: BuildSample[] = []
    const warm: BuildSample[] = []
    const incremental: BuildSample[] = []
    const dev: DevSample[] = []

    console.log(`Phase 0 baseline: ${options.runs} run(s), isolated sandbox`)
    for (let index = 0; index < options.runs; index++) {
      process.stdout.write(`  cold ${index + 1}/${options.runs}... `)
      const sample = await runBuild(
        sandbox,
        cli,
        'cold',
        options.timeoutMs,
        (process) => {
          activeProcess = process
        },
      )
      cold.push(sample)
      console.log(`${(sample.durationMs / 1000).toFixed(2)}s`)
    }

    for (let index = 0; index < options.runs; index++) {
      process.stdout.write(`  warm ${index + 1}/${options.runs}... `)
      const sample = await runBuild(
        sandbox,
        cli,
        'warm',
        options.timeoutMs,
        (process) => {
          activeProcess = process
        },
      )
      warm.push(sample)
      console.log(`${(sample.durationMs / 1000).toFixed(2)}s`)
    }

    for (let index = 0; index < options.runs; index++) {
      fs.writeFileSync(
        incrementalFile,
        `${originalContent}\n\n<!-- phase-0-incremental-${index} -->\n`,
        'utf8',
      )
      try {
        process.stdout.write(`  incremental ${index + 1}/${options.runs}... `)
        const sample = await runBuild(
          sandbox,
          cli,
          'incremental',
          options.timeoutMs,
          (process) => {
            activeProcess = process
          },
        )
        incremental.push(sample)
        console.log(`${(sample.durationMs / 1000).toFixed(2)}s`)
      } finally {
        fs.writeFileSync(incrementalFile, originalContent, 'utf8')
      }
    }

    if (!options.skipDev) {
      for (let index = 0; index < options.runs; index++) {
        process.stdout.write(`  dev ${index + 1}/${options.runs}... `)
        const sample = await runDev(
          sandbox,
          cli,
          options.timeoutMs,
          options.route,
          (process) => {
            activeProcess = process
          },
        )
        dev.push(sample)
        console.log(
          `${sample.startupMs.toFixed(0)}ms startup, ${sample.firstResponseMs.toFixed(0)}ms first response`,
        )
      }
    }

    assertSuccessfulSamples('cold', cold)
    assertSuccessfulSamples('warm', warm)
    assertSuccessfulSamples('incremental', incremental)
    const throughputSamples = cold
      .map((sample) => sample.renderPagesPerSecond)
      .filter((value) => value > 0)
    const output = assertOutputParity(cold, warm, incremental)
    const report: BaselineReport = {
      schemaVersion: 2,
      timestamp: new Date().toISOString(),
      sourceRoot: path.relative(WORKSPACE_ROOT, options.root),
      runs: options.runs,
      timeoutMs: options.timeoutMs,
      environment: getBenchmarkEnvironment(),
      cachePolicy: {
        cold: cold[0].cacheState,
        warm: warm[0].cacheState,
        incremental: incremental[0].cacheState,
      },
      metrics: {
        coldBuildMs: summarizeSamples(cold.map((sample) => sample.durationMs)),
        warmBuildMs: summarizeSamples(warm.map((sample) => sample.durationMs)),
        incrementalBuildMs: summarizeSamples(
          incremental.map((sample) => sample.durationMs),
        ),
        ...(dev.length > 0
          ? {
              devStartupMs: summarizeSamples(
                dev.map((sample) => sample.startupMs),
              ),
              devFirstResponseMs: summarizeSamples(
                dev.map((sample) => sample.firstResponseMs),
              ),
            }
          : {}),
        renderThroughputPagesPerSecond: summarizeSamples(throughputSamples),
      },
      output,
      samples: { cold, warm, incremental, dev },
    }

    if (!isValidBaselineReport(report)) {
      throw new Error('Generated baseline report failed structural validation')
    }

    const destination = reportPath(options.output)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)

    console.log('\nPhase 0 baseline complete')
    console.log(
      `  cold median:        ${(report.metrics.coldBuildMs.median / 1000).toFixed(2)}s`,
    )
    console.log(
      `  warm median:        ${(report.metrics.warmBuildMs.median / 1000).toFixed(2)}s`,
    )
    console.log(
      `  incremental median: ${(report.metrics.incrementalBuildMs.median / 1000).toFixed(2)}s`,
    )
    if (report.metrics.devStartupMs) {
      console.log(
        `  dev startup median: ${report.metrics.devStartupMs.median.toFixed(0)}ms`,
      )
      const firstResponse = report.metrics.devFirstResponseMs
      if (firstResponse) {
        console.log(
          `  first response:     ${firstResponse.median.toFixed(0)}ms`,
        )
      }
    }
    console.log(
      `  output:             ${(output.total.bytes / 1024 / 1024).toFixed(2)} MB (${output.htmlPages} HTML pages)`,
    )
    console.log(`  report:             ${destination}`)
  } finally {
    cleanup()
  }
}

main().catch((error) => {
  console.error(
    `Phase 0 baseline failed: ${error instanceof Error ? error.message : String(error)}`,
  )
  process.exitCode = 1
})
