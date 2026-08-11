import type { SsgPoolMetrics, SsgWorkerPool } from './ssg-worker-pool'

export function getSsgPoolMetrics(
  pool: SsgWorkerPool | null,
): SsgPoolMetrics | null {
  return pool === null ? null : pool.poolMetrics()
}
