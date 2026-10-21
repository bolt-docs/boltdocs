import { execFileSync } from 'node:child_process'
import os from 'node:os'
import process from 'node:process'

/**
 * The machine a benchmark was measured on.
 *
 * A build time is a property of the machine as much as of the code: the same
 * commit takes half as long on a laptop with a fast disk and a cold cache as
 * it does on a machine with a spinning one. A baseline without the machine it
 * came from is a number nobody can compare, and a gate that compares across
 * machines fails on the machine, not on the change.
 */
export interface MachineFingerprint {
  /** The CPU model, as the OS reports it. */
  cpu: string
  /** The logical cores. */
  cores: number
  /** The total memory, in gigabytes. */
  memoryGb: number
  /** The Node version the measurement ran on. */
  node: string
}

function readCpuModel(): string {
  try {
    const output = execFileSync('lscpu', [], { encoding: 'utf-8' })
    const line = output
      .split('\n')
      .find((entry) => entry.includes('Model name:'))
    return line?.split(':')[1]?.trim() || 'unknown'
  } catch {
    // A machine that cannot be described is described as unknown, and an
    // unknown machine is never taken to be the same as another unknown one.
    return 'unknown'
  }
}

/**
 * The machine this process is running on.
 *
 * Best effort: the CPU model and the core count are what decide whether two
 * measurements can be compared, and they are read from the OS. The memory and
 * the Node version are recorded so a reader can see what else was in play.
 */
export function currentMachine(): MachineFingerprint {
  return {
    cpu: readCpuModel(),
    cores: os.cpus().length,
    memoryGb: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    node: process.version,
  }
}

/**
 * Whether two machines can be compared.
 *
 * The CPU model and the core count decide it. The memory and the Node version
 * are recorded so a reader can see what else was in play, but they are not
 * part of the verdict: a machine that differs only in Node can still be
 * compared, and a machine with a different CPU cannot.
 */
export function isComparable(
  baseline: MachineFingerprint | undefined,
  current: MachineFingerprint,
): boolean {
  if (!baseline) return false
  if (baseline.cpu === 'unknown' || current.cpu === 'unknown') return false
  return baseline.cpu === current.cpu && baseline.cores === current.cores
}
