import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseDocFile } from '../packages/core/src/node/routes/parser'
import { generateSearchData } from '../packages/core/src/node/search'

describe('Frontmatter Extensibility: Tabs', () => {
  it('should parse custom tabs frontmatter and pass it to route meta', async () => {
    // 1. Arrange: Create a temporary MDX file with tabs frontmatter
    const tempDir = path.resolve(__dirname, 'temp-frontmatter')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const filePath = path.resolve(tempDir, 'tabs-example.mdx')
    const fileContent = `---
title: "Tabs Test"
tabs:
  - id: t1
    title: React
    content: "Content for React"
  - id: t2
    title: Vue
    content: "Content for Vue"
---
# Content`

    fs.writeFileSync(filePath, fileContent)

    // 2. Act: Parse the file
    const parsed = await parseDocFile(filePath, tempDir, '/docs')

    // 3. Assert: Verify the frontmatter was parsed and preserved
    expect(parsed.route.title).toBe('Tabs Test')
    expect(parsed.route.frontmatter).toBeDefined()
    expect(parsed.route.frontmatter?.tabs).toBeDefined()
    expect(Array.isArray(parsed.route.frontmatter?.tabs)).toBe(true)
    expect(parsed.route.frontmatter?.tabs.length).toBe(2)
    expect(parsed.route.frontmatter?.tabs[0].title).toBe('React')

    // 4. Act: Generate search data to ensure tabs are indexed
    const searchData = generateSearchData([parsed.route])

    // 5. Assert: Verify tab content is in the search index
    expect(searchData.length).toBeGreaterThan(0)
    expect(searchData[0].content).toContain('Content for React')
    expect(searchData[0].content).toContain('Content for Vue')

    // Cleanup
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir)
    }
  })
})
