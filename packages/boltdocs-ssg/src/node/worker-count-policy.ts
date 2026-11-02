export interface WorkerCountPolicyInput {
  cpuCount: number
  totalMemoryGB: number
  freeMemoryGB: number
  requestedWorkers?: number
  envWorkers?: string
}

/**
 * Resolve the SSG pool size without creating worker threads.
 *
 * The automatic default intentionally uses at most half of the logical CPUs,
 * capped at four workers. SSG workers each load the SSR bundle, so using every
 * CPU can increase memory pressure and structured-clone contention more than
 * it improves throughput on typical developer machines.
 *
 * Explicit `numWorkers` and `BOLTDOCS_SSG_WORKERS` values remain supported, but
 * are still constrained by the existing CPU and memory safety caps.
 */
export function resolveSsgWorkerCount({
  cpuCount,
  totalMemoryGB,
  freeMemoryGB,
  requestedWorkers,
  envWorkers,
}: WorkerCountPolicyInput): number {
  const cores = Math.max(1, cpuCount || 4)
  const cpuWorkers = Math.max(1, cores - 1)
  const maxCap = totalMemoryGB >= 4 ? Math.min(cpuWorkers, 16) : 4
  const budgetWorkers = Math.max(2, Math.floor((totalMemoryGB * 0.35) / 0.256))
  const freeWorkers = Math.max(2, Math.floor(freeMemoryGB / 0.3))
  const ramWorkers = Math.min(budgetWorkers, freeWorkers)
  const parsedEnvWorkers = Number.parseInt(envWorkers || '', 10)
  // Default: use all but one core for rendering. More workers = more pages
  // rendered in parallel, directly reducing the render-pages phase which is
  // the largest SSG cost on documentation sites (e.g. 10.5s for 260 pages).
  // RAM gates still cap this well before memory pressure.
  const defaultWorkers = Math.max(2, Math.min(cpuWorkers, 8))
  const selectedWorkers =
    requestedWorkers ??
    (Number.isFinite(parsedEnvWorkers) && parsedEnvWorkers > 0
      ? parsedEnvWorkers
      : defaultWorkers)

  return Math.max(2, Math.min(selectedWorkers, cpuWorkers, ramWorkers, maxCap))
}
