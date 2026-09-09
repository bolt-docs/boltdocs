import { describe, expect, it } from 'vitest'
import { resolveSsgWorkerCount } from '../src/node/worker-count-policy'

const healthyMemory = {
  totalMemoryGB: 16,
  freeMemoryGB: 16,
}

describe('resolveSsgWorkerCount', () => {
  it('defaults an 8-core host to four workers', () => {
    expect(resolveSsgWorkerCount({ cpuCount: 8, ...healthyMemory })).toBe(4)
  })

  it('defaults a 4-core host to two workers', () => {
    expect(resolveSsgWorkerCount({ cpuCount: 4, ...healthyMemory })).toBe(2)
  })

  it('caps the automatic default at four workers on large hosts', () => {
    expect(resolveSsgWorkerCount({ cpuCount: 32, ...healthyMemory })).toBe(4)
  })

  it('honors an explicit option when safety limits allow it', () => {
    expect(
      resolveSsgWorkerCount({
        cpuCount: 8,
        ...healthyMemory,
        requestedWorkers: 7,
      }),
    ).toBe(7)
  })

  it('honors the environment override when no option is provided', () => {
    expect(
      resolveSsgWorkerCount({
        cpuCount: 8,
        ...healthyMemory,
        envWorkers: '6',
      }),
    ).toBe(6)
  })

  it('gives the explicit option precedence over the environment', () => {
    expect(
      resolveSsgWorkerCount({
        cpuCount: 8,
        ...healthyMemory,
        requestedWorkers: 3,
        envWorkers: '7',
      }),
    ).toBe(3)
  })

  it('keeps explicit values below the CPU and memory safety caps', () => {
    expect(
      resolveSsgWorkerCount({
        cpuCount: 8,
        totalMemoryGB: 4,
        freeMemoryGB: 0.6,
        requestedWorkers: 8,
      }),
    ).toBe(2)
  })

  it('keeps the minimum pool size at two workers', () => {
    expect(
      resolveSsgWorkerCount({
        cpuCount: 1,
        totalMemoryGB: 0.1,
        freeMemoryGB: 0.1,
        requestedWorkers: 1,
      }),
    ).toBe(2)
  })
})
