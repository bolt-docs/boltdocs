import { describe, it, expect } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { detectEntry } from '../src/node/html'
import {
  joinUrlSegments,
  removeLeadingSlash,
  stripBase,
  withTrailingSlash,
  withLeadingSlash,
} from '../src/utils/path'

describe('detectEntry', () => {
  it('picks the first module script src as the entry', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-entry-'))
    fs.writeFileSync(
      path.join(root, 'index.html'),
      `<html>
  <head></head>
  <body>
    <script src="/vendor.js" type="module"></script>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
    )
    try {
      await expect(detectEntry(root)).resolves.toBe('/vendor.js')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('skips non-module scripts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-entry-'))
    fs.writeFileSync(
      path.join(root, 'index.html'),
      `<html><body>
    <script src="/legacy.js"></script>
    <script src="/src/entry.tsx" type="module"></script>
  </body></html>`,
    )
    try {
      await expect(detectEntry(root)).resolves.toBe('/src/entry.tsx')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('falls back to src/main.ts when no module script exists', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ssg-entry-'))
    fs.writeFileSync(
      path.join(root, 'index.html'),
      `<html><body><script src="/legacy.js"></script></body></html>`,
    )
    try {
      await expect(detectEntry(root)).resolves.toBe('src/main.ts')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('path utils', () => {
  it('joinUrlSegments joins with exactly one separator', () => {
    expect(joinUrlSegments('/base', 'docs')).toBe('/base/docs')
    expect(joinUrlSegments('/base/', '/docs/guide')).toBe('/base/docs/guide')
    expect(joinUrlSegments('', 'docs')).toBe('docs')
    expect(joinUrlSegments('/base', '')).toBe('/base')
    expect(joinUrlSegments('', '')).toBe('')
  })

  it('removeLeadingSlash strips a single leading slash only', () => {
    expect(removeLeadingSlash('/docs')).toBe('docs')
    expect(removeLeadingSlash('docs')).toBe('docs')
    expect(removeLeadingSlash('/docs/')).toBe('docs/')
  })

  it('withTrailingSlash and withLeadingSlash normalize edges', () => {
    expect(withTrailingSlash('/docs')).toBe('/docs/')
    expect(withTrailingSlash('/docs/')).toBe('/docs/')
    expect(withLeadingSlash('docs')).toBe('/docs')
    expect(withLeadingSlash('/docs')).toBe('/docs')
  })

  it('stripBase removes the base prefix and returns / for the base itself', () => {
    expect(stripBase('/docs/guide', '/docs')).toBe('/guide')
    expect(stripBase('/docs', '/docs')).toBe('/')
    expect(stripBase('/other', '/docs')).toBe('/other')
  })
})
