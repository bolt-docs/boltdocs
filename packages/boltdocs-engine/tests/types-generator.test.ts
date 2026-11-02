import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  generateProjectTypes,
  writeLinkTree,
} from '../src/node/types-generator'
import type { BoltdocsConfig } from '../../src/shared/types'

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-types-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

const baseConfig = {
  siteUrl: 'https://example.com',
} as BoltdocsConfig

describe('generateProjectTypes', () => {
  it('writes types.d.ts with generic locale/version when not configured', () => {
    generateProjectTypes(baseConfig, 'docs', root)
    const file = fs.readFileSync(
      path.join(root, '.boltdocs', 'generated', 'types.d.ts'),
      'utf-8',
    )
    expect(file).toContain('interface Types')
    expect(file).toContain('Locale: string')
    expect(file).toContain('Version: string')
  })

  it('emits literal types for configured locales and versions', () => {
    const config = {
      ...baseConfig,
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
      versions: { versions: [{ path: 'v1', label: 'v1' }] },
    } as unknown as BoltdocsConfig
    generateProjectTypes(config, 'docs', root)
    const file = fs.readFileSync(
      path.join(root, '.boltdocs', 'generated', 'types.d.ts'),
      'utf-8',
    )
    expect(file).toContain("Locale: 'en' | 'es'")
    expect(file).toContain("Version: 'v1'")
  })

  it('augments RoutePaths when routePaths are provided', () => {
    generateProjectTypes(baseConfig, 'docs', root, ['/docs', '/docs/api'])
    const file = fs.readFileSync(
      path.join(root, '.boltdocs', 'generated', 'types.d.ts'),
      'utf-8',
    )
    expect(file).toContain('interface RoutePaths')
    expect(file).toContain("'/docs': void")
    expect(file).toContain("'/docs/api': void")
  })

  it('references a custom mdx-components module when present', () => {
    const docsDir = path.join(root, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })
    fs.writeFileSync(
      path.join(docsDir, 'mdx-components.tsx'),
      'export const x = 1',
    )
    generateProjectTypes(baseConfig, 'docs', root)
    const file = fs.readFileSync(
      path.join(root, '.boltdocs', 'generated', 'types.d.ts'),
      'utf-8',
    )
    expect(file).toContain('MdxComponentsModule')
    expect(file).toContain('MdxComponents: typeof MdxComponentsModule')
  })
})

describe('writeLinkTree', () => {
  it('writes sorted, deduplicated routes with a timestamp', () => {
    writeLinkTree(['/docs/zeta', '/docs/alpha', '/docs/alpha'], root)
    const raw = fs.readFileSync(
      path.join(root, '.boltdocs', 'generated', 'link-tree.json'),
      'utf-8',
    )
    const tree = JSON.parse(raw)
    expect(tree.routes).toEqual(['/docs/alpha', '/docs/zeta'])
    expect(typeof tree.timestamp).toBe('number')
  })
})
