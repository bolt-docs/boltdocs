import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseDocFile } from '../../src/node/routes/parser'
import { generateSearchData } from '../../src/node/search'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('Frontmatter Tabs Integration', () => {
  let tempProjectDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempProjectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'boltdocs-frontmatter-tabs-'),
    )
  })

  afterEach(() => {
    if (fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true })
    }
  })

  it('should parse tab items from frontmatter metadata correctly', async () => {
    const docPath = path.join(tempProjectDir, 'tabs-example.mdx')
    fs.writeFileSync(
      docPath,
      `---
title: Tabs Example
tabs:
  - id: react
    title: React Instructions
    content: Run npm install react
  - id: vue
    title: Vue Instructions
    content: Run npm install vue
---
# Main Content
`,
    )

    const parsed = await parseDocFile(docPath, tempProjectDir, '/docs')
    expect(parsed.route.frontmatter.tabs).toBeDefined()
    expect(Array.isArray(parsed.route.frontmatter.tabs)).toBe(true)
    expect(parsed.route.frontmatter.tabs).toHaveLength(2)
    expect(parsed.route.frontmatter.tabs[0].id).toBe('react')
    expect(parsed.route.frontmatter.tabs[1].title).toBe('Vue Instructions')
  })

  it('should include tab contents in generated search index data', async () => {
    const docPath = path.join(tempProjectDir, 'tabs-search-example.mdx')
    fs.writeFileSync(
      docPath,
      `---
title: Tabs Search Example
tabs:
  - id: install
    title: Installation
    content: Use pnpm install boltdocs
---
# Welcome
`,
    )

    const parsed = await parseDocFile(docPath, tempProjectDir, '/docs')
    const routes = [
      {
        path: parsed.route.path,
        filePath: docPath,
        frontmatter: parsed.route.frontmatter,
        content: parsed.route._content,
      },
    ]

    const searchData = generateSearchData(routes as any)
    expect(searchData).toBeDefined()

    // Find record for this page
    const record = searchData.find((r) => r.url === parsed.route.path)
    expect(record).toBeDefined()

    // Search data should index the tab content
    const indexedString = JSON.stringify(record)
    expect(indexedString).toContain('pnpm install boltdocs')
    expect(indexedString).toContain('Installation')
  })
})
