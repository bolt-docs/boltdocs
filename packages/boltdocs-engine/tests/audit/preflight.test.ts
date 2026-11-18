import { describe, expect, it } from 'vitest'
import {
  assertReportsSafe,
  PluginAuditError,
} from '../../src/node/security/audit/preflight'
import type { AuditPluginReport } from '../../src/node/security/audit/types'

function report(partial: Partial<AuditPluginReport>): AuditPluginReport {
  return {
    name: 'test-plugin',
    status: 'clean',
    filesScanned: 1,
    findings: [],
    ...partial,
  }
}

describe('plugin audit preflight (SPEC §2.3)', () => {
  it('lets clean plugins through', () => {
    expect(() =>
      assertReportsSafe([
        report({ name: 'clean' }),
        report({
          name: 'with-low',
          status: 'warning',
          findings: [
            {
              ruleId: 'fs-read',
              category: 'filesystem',
              severity: 'low',
              message: 'fs',
              file: 'index.js',
              line: 1,
            },
          ],
        }),
      ]),
    ).not.toThrow()
  })

  it('blocks unresolved and errored plugins', () => {
    expect(() =>
      assertReportsSafe([report({ name: 'ghost', status: 'unresolved' })]),
    ).toThrow(PluginAuditError)
    expect(() =>
      assertReportsSafe([report({ name: 'broken', status: 'error' })]),
    ).toThrow(/could not|scan failed/i)
  })

  it('blocks high-risk findings and truncated scans', () => {
    expect(() =>
      assertReportsSafe([report({ name: 'evil', severity: 'high' })]),
    ).toThrow(/high-risk/)
    expect(() =>
      assertReportsSafe([
        report({
          name: 'huge',
          findings: [
            {
              ruleId: 'scan-truncated',
              category: 'metadata',
              severity: 'high',
              message: 'truncated',
              file: 'package.json',
              line: 0,
            },
          ],
        }),
      ]),
    ).toThrow(/truncated/)
  })

  it('blocks unreviewed warnings unless explicitly allowed', () => {
    const warned = report({
      name: 'networking',
      severity: 'warning',
      findings: [
        {
          ruleId: 'import-http',
          category: 'network',
          severity: 'warning',
          message: 'network',
          file: 'index.js',
          line: 1,
        },
      ],
    })
    expect(() => assertReportsSafe([warned])).toThrow(/risky finding/)
    expect(() => assertReportsSafe([warned], ['networking'])).not.toThrow()
  })

  it('names every blocker in one error', () => {
    try {
      assertReportsSafe([
        report({ name: 'ghost', status: 'unresolved' }),
        report({ name: 'evil', severity: 'high' }),
      ])
      throw new Error('expected the guard to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(PluginAuditError)
      expect((error as Error).message).toContain('ghost')
      expect((error as Error).message).toContain('evil')
    }
  })
})
