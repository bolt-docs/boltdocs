import { describe, it, expect } from 'vitest'
import {
  AUDIT_RULES,
  AUDIT_IMPORT_RULES,
  QUICK_REJECT_RE,
} from '../../src/node/security/audit/rules'
import { SEVERITY_RANK } from '../../src/node/security/audit/types'

describe('audit rule catalog', () => {
  it('has unique rule ids', () => {
    const ids = AUDIT_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every rule has valid severity and category', () => {
    for (const rule of AUDIT_RULES) {
      expect(rule.id.length).toBeGreaterThan(0)
      expect(['high', 'warning', 'low']).toContain(rule.severity)
      expect([
        'process',
        'dynamic-code',
        'network',
        'filesystem',
        'env-secrets',
      ]).toContain(rule.category)
      expect(rule.description.length).toBeGreaterThan(10)
    }
  })

  it('import rules reference unique modules', () => {
    const all = AUDIT_IMPORT_RULES.flatMap((r) => r.modules)
    expect(new Set(all).size).toBe(all.length)
  })

  it('every rule has a literal anchor in the quick-reject gate', () => {
    // One representative matching line per rule. If the rule matches, the
    // quick-reject gate MUST also match (it gates the whole catalog).
    const samples: Record<string, string> = {
      'child-process-call': "child_process.execSync('x')",
      'child-process-exec': "execSync('x')",
      'child-process-spawn': "spawn('x')",
      'child-process-fork': "fork('x')",
      'child-process-execfile': "execFile('x')",
      'shell-true': 'shell: true',
      'eval-call': 'eval(x)',
      'new-function': "new Function('x')",
      'function-constructor': "Function('x')",
      'vm-runtime': 'vm.runInThisContext(x)',
      'hex-escape-run': 'const s = "\\x66\\x65\\x74\\x63\\x68"',
      'string-fromcharcode': 'String.fromCharCode(1)',
      'base64-buffer': "Buffer.from(x, 'base64')",
      'atob-btoa': "atob('x')",
      'fetch-call': "fetch('/api')",
      'http-request': 'http.request(opts)',
      'http-client-lib': "axios.get('/')",
      'websocket-client': "new WebSocket('ws://x')",
      'dns-lookup': "dns.lookup('x')",
      'fs-write': "fs.writeFileSync('/tmp/x', d)",
      'fs-delete': "fs.rmSync('/tmp/x')",
      'env-access': 'process.env.NODE_ENV',
      'env-secret-name': "process.env['API_SECRET']",
      'env-secret-dot': 'process.env.TOKEN',
    }

    const rules = new Map(AUDIT_RULES.map((r) => [r.id, r]))
    for (const [id, rule] of rules) {
      const sample = samples[id]
      expect(sample, `missing sample for rule ${id}`).toBeDefined()
      expect(
        rule.pattern.test(sample),
        `rule ${id} should match its sample`,
      ).toBe(true)
      expect(
        QUICK_REJECT_RE.test(sample),
        `quick-reject must allow rule ${id} sample: ${sample}`,
      ).toBe(true)
    }
  })

  it('quick-reject skips clearly benign lines', () => {
    const benign = [
      'export const total = items.reduce((a, b) => a + b, 0)',
      'function helper(value) { return value * 2 }',
      'const obj = { key: "value", n: 42 }',
      "return config.theme.title ?? 'Boltdocs'",
    ]
    for (const line of benign) {
      expect(QUICK_REJECT_RE.test(line), line).toBe(false)
    }
  })

  it('high-risk rules do not fire on benign code', () => {
    const benign = [
      'const total = items.reduce((a, b) => a + b, 0)',
      'export const config = { shell: false }',
      'const x = executor.length',
      'await fetch', // no call
    ]
    const highIds = AUDIT_RULES.filter(
      (r) => SEVERITY_RANK[r.severity] === SEVERITY_RANK.high,
    )
    for (const rule of highIds) {
      for (const line of benign) {
        expect(rule.pattern.test(line)).toBe(false)
      }
    }
  })
})
