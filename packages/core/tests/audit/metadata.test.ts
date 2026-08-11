import { describe, it, expect } from 'vitest'
import { auditPackageMetadata } from '../../src/node/security/audit/metadata'

function ruleIds(
  pkg: Record<string, unknown>,
  ctx?: { boltdocsVersion?: string },
) {
  return auditPackageMetadata(pkg, ctx ?? { name: 'pkg' }).map((f) => f.ruleId)
}

describe('audit package metadata', () => {
  it('flags install scripts as high risk with evidence', () => {
    const findings = auditPackageMetadata({
      name: 'pkg',
      version: '1.0.0',
      scripts: { postinstall: 'node install.js' },
    }).filter((f) => f.ruleId === 'install-script')
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('high')
    expect(findings[0].snippet).toContain('postinstall: node install.js')
    expect(findings[0].file).toBe('package.json')
  })

  it('flags bundled dependencies', () => {
    expect(ruleIds({ name: 'pkg', bundledDependencies: ['a', 'b'] })).toContain(
      'bundled-deps',
    )
  })

  it('flags dependencies from non-registry sources', () => {
    const ids = ruleIds({
      name: 'pkg',
      dependencies: { evil: 'git+https://github.com/x/y.git' },
      devDependencies: { other: 'file:../local' },
    })
    expect(ids).toContain('remote-deps')
  })

  it('ignores registry-style dependencies', () => {
    expect(
      ruleIds({
        name: 'pkg',
        dependencies: { lodash: '^4.17.0' },
        devDependencies: { typescript: '~5.9.0' },
      }),
    ).not.toContain('remote-deps')
  })

  it('flags missing license and provenance', () => {
    const ids = ruleIds({ name: 'pkg' })
    expect(ids).toContain('no-license')
    expect(ids).toContain('no-provenance')
  })

  it('does not flag license/provenance when present', () => {
    const ids = ruleIds({
      name: 'pkg',
      license: 'MIT',
      repository: { type: 'git', url: 'https://github.com/x/y' },
    })
    expect(ids).not.toContain('no-license')
    expect(ids).not.toContain('no-provenance')
  })

  it('flags version mismatches against boltdocsVersion', () => {
    const ids = ruleIds(
      { name: 'pkg', version: '1.0.0' },
      { boltdocsVersion: '>=2.0.0' },
    )
    expect(ids).toContain('version-mismatch')
  })

  it('accepts satisfying versions', () => {
    const ids = ruleIds(
      { name: 'pkg', version: '2.3.0' },
      { boltdocsVersion: '>=2.0.0' },
    )
    expect(ids).not.toContain('version-mismatch')
  })

  it('is silent for a healthy package', () => {
    expect(
      ruleIds({
        name: 'pkg',
        version: '1.0.0',
        license: 'MIT',
        repository: { type: 'git', url: 'https://github.com/x/y' },
        scripts: { build: 'tsc' },
        dependencies: { lodash: '^4.17.0' },
      }),
    ).toEqual([])
  })
})
