import { describe, expect, it } from 'vitest'
import { currentMachine, isComparable } from './machine'

describe('isComparable', () => {
  const baseline = {
    cpu: 'Intel(R) Core(TM) i5-8350U CPU @ 1.70GHz',
    cores: 8,
    memoryGb: 7.6,
    node: 'v22.0.0',
  }

  it('compares a machine with itself', () => {
    expect(isComparable(baseline, { ...baseline })).toBe(true)
  })

  it('refuses a comparison across CPUs', () => {
    // The build time is a property of the machine as much as of the code. A
    // different CPU makes the ratio meaningless, and a gate that reports it
    // anyway fails on the hardware rather than on the change.
    expect(
      isComparable(baseline, { ...baseline, cpu: 'AMD Ryzen 9 5950X' }),
    ).toBe(false)
  })

  it('refuses a comparison across core counts', () => {
    expect(isComparable(baseline, { ...baseline, cores: 16 })).toBe(false)
  })

  it('compares across Node versions and memory', () => {
    // The version and the memory are recorded so a reader can see what else
    // was in play, but they do not decide the verdict.
    expect(
      isComparable(baseline, {
        ...baseline,
        node: 'v24.0.0',
        memoryGb: 32,
      }),
    ).toBe(true)
  })

  it('refuses a comparison with an unknown machine on either side', () => {
    expect(isComparable({ ...baseline, cpu: 'unknown' }, baseline)).toBe(false)
    expect(isComparable(baseline, { ...baseline, cpu: 'unknown' })).toBe(false)
    expect(isComparable(undefined, baseline)).toBe(false)
  })
})

describe('currentMachine', () => {
  it('describes the machine it runs on', () => {
    const machine = currentMachine()

    expect(machine.cores).toBeGreaterThan(0)
    expect(machine.memoryGb).toBeGreaterThan(0)
    expect(machine.node).toMatch(/^v\d+/)
  })

  it('is comparable with itself', () => {
    const machine = currentMachine()
    expect(isComparable(machine, currentMachine())).toBe(true)
  })
})
