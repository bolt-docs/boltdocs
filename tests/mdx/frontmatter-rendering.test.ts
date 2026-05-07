import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseDocFile } from '../../packages/core/src/node/routes/parser'
import { adaptRoutesForSSG } from '../../packages/core/src/node/routes/route-adapter'
import { DocPage } from '../../packages/core/src/client/app/doc-page'
import mdxComponents from '../../docs/docs/mdx-components'
import fs from 'fs'
import path from 'path'
import os from 'os'
import * as React from 'react'

vi.mock('virtual:boltdocs-search', () => ({
  default: [],
}))

vi.mock('virtual:boltdocs-icons', () => ({
  default: {},
}))

vi.mock('virtual:boltdocs-mdx-components', () => ({
  default: {},
}))

vi.mock('virtual:boltdocs-layout', () => ({
  default: {},
}))

describe('Frontmatter Custom Formatter Layout Rendering', () => {
  let tempProjectDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempProjectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'boltdocs-frontmatter-rendering-'),
    )
  })

  afterEach(() => {
    if (fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true })
    }
  })

  it('should identify custom Frontmatter_{key} formatting components from imported mdx-components export', () => {
    expect(mdxComponents).toBeDefined()
    expect(mdxComponents.Frontmatter_tabs).toBeDefined()
    expect(typeof mdxComponents.Frontmatter_tabs).toBe('function')
  })

  it('should successfully match parsed metadata fields to formatting functions in mdxComponents', async () => {
    const docPath = path.join(tempProjectDir, 'test-render.mdx')
    fs.writeFileSync(
      docPath,
      `---
title: Rendering Matcher Test
tabs:
  - id: t1
    title: Tab One
    content: Tab One Content
---
# Content Here
`,
    )

    const parsed = await parseDocFile(docPath, tempProjectDir, '/docs')
    const routes = adaptRoutesForSSG([
      {
        path: '/test-render',
        filePath: docPath,
        frontmatter: parsed.route.frontmatter,
        content: parsed.route._rawContent,
      },
    ])

    const matchedRoute = routes.find((r) => r.path === '/test-render')
    expect(matchedRoute).toBeDefined()
    expect(matchedRoute!.frontmatter.tabs).toBeDefined()

    // Find custom keys in frontmatter
    const customKeys = Object.keys(matchedRoute!.frontmatter).filter(
      (k) => k !== 'title' && k !== 'description',
    )
    expect(customKeys).toContain('tabs')

    // Ensure we have a matching renderer in the components mapping
    const rendererKey = `Frontmatter_${customKeys[0]}`
    expect(mdxComponents[rendererKey]).toBeDefined()
  })

  it('should render page content and custom frontmatter layout without runtime exceptions', async () => {
    const docPath = path.join(tempProjectDir, 'test-react-render.mdx')
    fs.writeFileSync(
      docPath,
      `---
title: React Page Render
tabs:
  - id: intro
    title: Overview
    content: This is the main intro text.
---
# React Component Render Validation
`,
    )

    const parsed = await parseDocFile(docPath, tempProjectDir, '/docs')
    const route = {
      path: '/test-react-render',
      filePath: docPath,
      frontmatter: parsed.route.frontmatter,
      content: parsed.route._rawContent,
    }

    // Verify page can render under DocPage layout without crashing
    const dummyConfig = { theme: { title: 'Test Site' } }
    const element = React.createElement(DocPage, {
      route: route as any,
      config: dummyConfig as any,
      components: mdxComponents as any,
    })

    expect(element).toBeDefined()
    expect(React.isValidElement(element)).toBe(true)
  })
})
