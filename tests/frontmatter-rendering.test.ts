import * as React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'

// Mock Vite virtual modules that are imported by the client
vi.mock('virtual:boltdocs-search', () => ({ default: [] }), {
  factory: () => ({ default: [] }),
})
vi.mock('virtual:boltdocs-icons', () => ({ default: {} }), {
  factory: () => ({ default: {} }),
})
vi.mock('virtual:boltdocs-config', () => ({ default: {} }), {
  factory: () => ({ default: {} }),
})
vi.mock('virtual:boltdocs-routes', () => ({ default: [] }), {
  factory: () => ({ default: [] }),
})
vi.mock('virtual:boltdocs-mdx-components', () => ({ default: {} }), {
  factory: () => ({ default: {} }),
})
vi.mock('virtual:boltdocs-layout', () => ({ default: {} }), {
  factory: () => ({ default: {} }),
})

import { parseDocFile } from '../packages/core/src/node/routes/parser'
import { adaptRoutesForSSG } from '../packages/core/src/node/routes/route-adapter'
import { DocPage } from '../packages/core/src/client/app/doc-page'
import mdxComponents from '../docs/docs/mdx-components'

describe('Frontmatter Full Pipeline: Parsing & Rendering Integration', () => {
  it('should parse an MDX file and successfully render custom frontmatter tabs using mdx-components.tsx', async () => {
    // 1. Setup temporary directory and MDX file
    const tempDir = path.resolve(__dirname, 'temp-render-test')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const mdxPath = path.resolve(tempDir, 'tabs-example.mdx')
    const mdxContent = `---
title: "Tabs Frontmatter Example"
description: "Página de ejemplo para probar la extensibilidad del frontmatter renderizando componentes personalizados como Tabs."
tabs:
  - id: tab-react
    title: React
    content: "Instrucciones de instalación para React..."
  - id: tab-vue
    title: Vue
    content: "Instrucciones de instalación para Vue..."
---

# Frontmatter Extensibility Demo
`

    fs.writeFileSync(mdxPath, mdxContent)

    // 2. Step 1: Parsing
    const parsed = await parseDocFile(mdxPath, tempDir, '/docs')

    // Validate parser parsed it
    expect(parsed.route.frontmatter).toBeDefined()
    expect(parsed.route.frontmatter?.tabs).toBeDefined()
    expect(parsed.route.frontmatter?.tabs.length).toBe(2)

    // 3. Step 2: Route adaptation for SSG / Client
    const adaptedRoutes = adaptRoutesForSSG([parsed.route])
    const adaptedRoute = adaptedRoutes[0]

    // Validate adapter preserved it
    expect(adaptedRoute.frontmatter).toBeDefined()
    expect(adaptedRoute.frontmatter?.tabs).toBeDefined()
    expect(adaptedRoute.frontmatter?.tabs.length).toBe(2)

    // 4. Step 3: Rendering using DocPage and components from mdx-components.tsx
    const MockContent = () => React.createElement('div', null, 'Demo Content')

    // Render using DocPage
    // @ts-ignore
    const html = renderToString(
      React.createElement(DocPage, {
        // @ts-ignore
        route: adaptedRoute,
        content: MockContent,
        mdxComponents: mdxComponents,
      }),
    )

    console.log('--- Rendered HTML output ---')
    console.log(html)
    console.log('----------------------------')

    // 5. Assertions: Check if the custom Frontmatter_tabs component rendered the content
    expect(html).toContain('Tabs Generados por Frontmatter:')
    expect(html).toContain('React')
    expect(html).toContain('Vue')
    expect(html).toContain('Instrucciones de instalación para React...')

    // Cleanup
    if (fs.existsSync(mdxPath)) fs.unlinkSync(mdxPath)
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir)
  })
})
