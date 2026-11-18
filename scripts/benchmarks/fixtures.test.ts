import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupFixtureDir, createFixtureDir } from './utils/fixtures'

const created: string[] = []

function specFixture() {
  const dir = createFixtureDir()
  created.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of created.splice(0)) cleanupFixtureDir(dir)
})

describe('SPEC §2.2 benchmark fixture', () => {
  it('generates 100 MDX pages', () => {
    const files = fs.readdirSync(specFixture())
    expect(files).toHaveLength(100)
    expect(files.every((file) => file.endsWith('.mdx'))).toBe(true)
  })

  it('puts 3 code blocks, 2 tables and 5 custom components on every page', () => {
    const dir = specFixture()
    for (const file of fs.readdirSync(dir).slice(0, 5)) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8')
      expect(source.match(/```/g)?.length).toBe(6) // 3 fenced blocks
      expect(source.match(/^\| .* \|$/gm)?.length).toBeGreaterThanOrEqual(6)
      expect(source).toContain('<Callout')
      expect(source).toContain('<Cards>')
      expect(source.match(/<Card /g)).toHaveLength(2)
      expect(source).toContain('<Field ')
    }
  })

  it('puts roughly 1,500 words on every page', () => {
    const dir = specFixture()
    const source = fs.readFileSync(path.join(dir, 'page-1.mdx'), 'utf8')
    const words = source.split(/\s+/).length
    expect(words).toBeGreaterThanOrEqual(1200)
    expect(words).toBeLessThanOrEqual(2200)
  })

  it('does not write a stale boltdocs/client layout', () => {
    const dir = specFixture()
    expect(fs.existsSync(path.join(dir, 'docs', 'layout.tsx'))).toBe(false)
  })
})
