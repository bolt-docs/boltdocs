import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { auditAction } from '../../src/node/cli/audit'
import { makeProjectCopy, cleanupProject, assertNoMarkers } from './test-utils'

let root: string

beforeEach(() => {
  root = makeProjectCopy()
  process.exitCode = 0
})

afterEach(() => {
  process.exitCode = 0
  cleanupProject(root)
})

describe('boltdocs audit CLI (end-to-end)', () => {
  it('runs the full pipeline WITHOUT executing plugin code', async () => {
    const writes: string[] = []
    const stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: unknown) => {
        writes.push(String(chunk))
        return true
      })
    const logSpy = vi
      .spyOn(console, 'log')
      .mockImplementation((...args: unknown[]) => {
        writes.push(args.join(' '))
      })

    try {
      await expect(auditAction(root)).resolves.toBeUndefined()
    } finally {
      stdoutSpy.mockRestore()
      logSpy.mockRestore()
    }

    // The audit must never have executed the plugin packages:
    assertNoMarkers(root)

    const output = writes.join('\n')
    expect(output).toContain('evil-plugin')
    expect(output).toContain('clean-plugin')
    expect(output).toContain('sneaky-plugin')
    expect(output).toContain('missing-plugin')
    expect(output).toContain('High risk')
    expect(output).toContain('install-script')
    expect(output).toContain('✅ Clean')

    // CI contract: high-risk findings + unresolved plugins → non-zero exit.
    expect(process.exitCode).toBe(1)
  })

  it('is a no-op when no plugins are configured', async () => {
    const writes: string[] = []
    const spies = [
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        writes.push(String(chunk))
        return true
      }),
      vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        writes.push(args.join(' '))
      }),
      vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        writes.push(args.join(' '))
      }),
    ]

    try {
      const fs = await import('node:fs')
      const os = await import('node:os')
      const path = await import('node:path')
      const emptyRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'boltdocs-audit-empty-'),
      )
      fs.writeFileSync(
        path.join(emptyRoot, 'boltdocs.config.mjs'),
        'export default { plugins: [] }\n',
      )
      await auditAction(emptyRoot)
      fs.rmSync(emptyRoot, { recursive: true, force: true })
    } finally {
      for (const spy of spies) spy.mockRestore()
    }

    expect(writes.join('\n')).toContain('No plugins configured')
    expect(process.exitCode).toBe(0)
  })

  it('exits 0 when every plugin is clean', async () => {
    const writes: string[] = []
    const spies = [
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        writes.push(String(chunk))
        return true
      }),
      vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        writes.push(args.join(' '))
      }),
    ]

    try {
      const fs = await import('node:fs')
      const os = await import('node:os')
      const path = await import('node:path')
      const cleanRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'boltdocs-audit-clean-'),
      )
      fs.cpSync(
        path.join(root, 'node_modules', 'clean-plugin'),
        path.join(cleanRoot, 'node_modules', 'clean-plugin'),
        { recursive: true },
      )
      fs.writeFileSync(
        path.join(cleanRoot, 'boltdocs.config.mjs'),
        'export default { plugins: [{ name: "clean-plugin" }] }\n',
      )
      await auditAction(cleanRoot)
      fs.rmSync(cleanRoot, { recursive: true, force: true })
    } finally {
      for (const spy of spies) spy.mockRestore()
    }

    expect(writes.join('\n')).toContain('All plugins passed')
    expect(process.exitCode).toBe(0)
  })

  it('treats unresolved plugins as fail-closed (never "all passed")', async () => {
    const writes: string[] = []
    const spies = [
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        writes.push(String(chunk))
        return true
      }),
      vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
        writes.push(args.join(' '))
      }),
      vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        writes.push(args.join(' '))
      }),
    ]

    try {
      const fs = await import('node:fs')
      const os = await import('node:os')
      const path = await import('node:path')
      const unresolvedRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'boltdocs-audit-unresolved-'),
      )
      fs.writeFileSync(
        path.join(unresolvedRoot, 'boltdocs.config.mjs'),
        'export default { plugins: [{ name: "ghost-plugin" }] }\n',
      )
      await auditAction(unresolvedRoot)
      fs.rmSync(unresolvedRoot, { recursive: true, force: true })
    } finally {
      for (const spy of spies) spy.mockRestore()
    }

    const output = writes.join('\n')
    expect(output).toContain('ghost-plugin')
    expect(output).not.toContain('All plugins passed')
    expect(output).toContain('could not be scanned')
    // No orphan `[boltdocs] ` prefix lines from messages that start with \n.
    const lines = output.split('\n')
    expect(lines.some((l) => /^\[boltdocs\]\s*$/.test(l))).toBe(false)
    // CI contract: an unresolved plugin must fail the run.
    expect(process.exitCode).toBe(1)
  })
})
