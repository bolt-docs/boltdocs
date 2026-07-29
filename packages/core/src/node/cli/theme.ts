import { createServer } from '@bdocs/ssg/node'
import { createViteConfig } from '../index'
import { error } from '@bdocs/dui'
import { notifyUpdateAvailable } from '../update-check'
import type { BoltdocsConfig } from '../config'
import path from 'node:path'
import fs from 'node:fs'

// ─── Public Types ─────────────────────────────────────────────

export interface ThemeDevOptions {
  port?: number
  host?: string | boolean
  name?: string
  layout?: string
  mdx?: string
  tailwind?: boolean
  sass?: boolean
  verbose?: boolean
}

// ─── Main Action ──────────────────────────────────────────────

/**
 * `boltdocs theme:dev` command.
 *
 * Creates a temporary Boltdocs project with sample MDX content and starts
 * a dev server so theme developers can preview their themes in real time.
 *
 * Key behaviours:
 *  - `--layout` and `--mdx` files are **symlinked** so edits trigger HMR.
 *  - `--tailwind` loads `@bdocs/plugin-tailwindcss` (must be installed).
 *  - `--sass` loads `@bdocs/plugin-sass` (must be installed).
 *  - The temp project lives under `.boltdocs/theme-preview/` and is
 *    cleaned up on SIGINT / SIGTERM.
 */
export async function themeDevAction(
  root: string = process.cwd(),
  options: ThemeDevOptions = {},
): Promise<void> {
  notifyUpdateAvailable()

  const rootDir = root || process.cwd()
  const themeName = options.name || 'Untitled Theme'

  // Validate plugin dependencies upfront
  if (options.tailwind) {
    checkPackageDependency(rootDir, '@bdocs/plugin-tailwindcss')
  }
  if (options.sass) {
    checkPackageDependency(rootDir, '@bdocs/plugin-sass')
    checkPackageDependency(rootDir, 'sass-embedded')
  }

  // Resolve layout / mdx paths
  const resolvedLayout = options.layout
    ? path.resolve(rootDir, options.layout)
    : undefined
  const resolvedMdx = options.mdx
    ? path.resolve(rootDir, options.mdx)
    : undefined

  if (resolvedLayout && !fs.existsSync(resolvedLayout)) {
    error(`Layout file not found: ${resolvedLayout}`)
    process.exit(1)
  }
  if (resolvedMdx && !fs.existsSync(resolvedMdx)) {
    error(`MDX components file not found: ${resolvedMdx}`)
    process.exit(1)
  }

  // Create temp project
  const tempDir = createTempProject(rootDir, {
    name: themeName,
    layoutPath: resolvedLayout,
    mdxPath: resolvedMdx,
  })

  // Register cleanup early so a Ctrl+C during startup doesn't leave
  // orphaned temp directories on disk.
  const cleanupAndExit = () => {
    cleanup(tempDir)
    process.exit(0)
  }
  process.on('SIGINT', cleanupAndExit)
  process.on('SIGTERM', cleanupAndExit)

  // Build plugin array
  const plugins: unknown[] = []
  if (options.tailwind) {
    // Dynamic import via variable so Vite's static analysis skips it.
    // @bdocs/plugin-tailwindcss may not be installed in the user's project.
    // @ts-expect-error — the package is resolved from the user's project at runtime.
    const TW_PLUGIN_ID = '@bdocs/plugin-tailwindcss'
    try {
      const mod = await import(TW_PLUGIN_ID)
      const tailwindPlugin = (mod.default || mod) as (opts?: unknown) => unknown
      plugins.push(tailwindPlugin())
    } catch {
      cleanup(tempDir)
      error('Failed to load @bdocs/plugin-tailwindcss.')
      error('Make sure it is installed: pnpm add -D @bdocs/plugin-tailwindcss')
      process.exit(1)
    }
  }
  if (options.sass) {
    // @ts-expect-error — the package is resolved from the user's project at runtime.
    const SASS_PLUGIN_ID = '@bdocs/plugin-sass'
    try {
      const mod = await import(SASS_PLUGIN_ID)
      const sassPlugin = (mod.default || mod) as (opts?: unknown) => unknown
      plugins.push(sassPlugin())
    } catch {
      cleanup(tempDir)
      error('Failed to load @bdocs/plugin-sass.')
      error(
        'Make sure it is installed: pnpm add -D @bdocs/plugin-sass sass-embedded',
      )
      process.exit(1)
    }
  }

  const config: BoltdocsConfig = {
    docsDir: path.resolve(tempDir, 'docs'),
    theme: {
      title: `Theme Preview — ${themeName}`,
      description: `Preview environment for the "${themeName}" Boltdocs theme`,
      navbar: [
        { label: 'Home', href: '/' },
        { label: 'Guides', href: '/docs/guides/getting-started' },
        { label: 'Examples', href: '/docs/examples/advanced' },
      ],
      codeTheme: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
    plugins: plugins as any,
  }

  // Vite's resolve.alias maps `boltdocs/client` → `{root}/boltdocs-client.mjs`.
  // The virtual module plugin intercepts `boltdocs/client` imports anyway,
  // but we create a tiny stub as a safety net in case the virtual module
  // resolution falls through.
  const clientStub = path.join(tempDir, 'boltdocs-client.mjs')
  if (!fs.existsSync(clientStub)) {
    fs.writeFileSync(
      clientStub,
      "export { DocsLayout } from 'boltdocs/client';\n",
    )
  }

  // Save original cwd so we can restore it.  We temporarily chdir to the
  // temp project so that process.cwd()-based path resolution inside
  // createViteConfig / boltdocsPlugin resolves against the temp directory.
  const originalCwd = process.cwd()

  try {
    process.chdir(tempDir)

    const viteConfig = await createViteConfig(tempDir, 'development', config, {
      skipTypes: true,
      skipLinkTree: true,
    })

    viteConfig.logLevel = options.verbose ? 'info' : 'warn'
    viteConfig.clearScreen = false

    if (options.port !== undefined) {
      viteConfig.server = viteConfig.server || {}
      viteConfig.server.port = Number(options.port)
    }
    if (options.host !== undefined) {
      viteConfig.server = viteConfig.server || {}
      viteConfig.server.host = options.host
    }

    const server = await createServer(viteConfig)
    await server.listen()

    // Restore cwd now that the server is running
    process.chdir(originalCwd)

    const urls = server.resolvedUrls
    const localUrl =
      urls?.local?.[0] ?? `http://localhost:${options.port ?? 5173}`

    console.log('')
    console.log('  🎨  Boltdocs Theme Preview')
    console.log('')
    console.log(`     Theme: ${themeName}`)
    console.log(`     Local: ${localUrl}`)
    if (urls?.network?.[0]) {
      console.log(`   Network: ${urls.network[0]}`)
    }
    console.log('')
    console.log('     Press Ctrl+C to stop')
    console.log('')

    server.bindCLIShortcuts({ print: false })
  } catch (e) {
    process.chdir(originalCwd)
    cleanup(tempDir)
    error('Failed to start theme preview:', e)
    process.exit(1)
  }
}

// ─── Temp Project Generator ───────────────────────────────────

function createTempProject(
  rootDir: string,
  opts: {
    name: string
    layoutPath?: string
    mdxPath?: string
  },
): string {
  const previewDir = path.join(
    rootDir,
    '.boltdocs',
    'theme-preview',
    `preview-${Date.now()}`,
  )

  // Create directory structure
  fs.mkdirSync(path.join(previewDir, 'docs', 'guides'), { recursive: true })
  fs.mkdirSync(path.join(previewDir, 'docs', 'examples'), { recursive: true })

  // Generate project files
  writePackageJson(previewDir)
  writeIndexHtml(previewDir)
  writeConfigFile(previewDir, opts.name)
  writeLayoutFile(previewDir, opts.layoutPath)
  writeMdxComponentsFile(previewDir, opts.mdxPath)
  writeSampleContent(previewDir)

  return previewDir
}

// ─── File Writers ─────────────────────────────────────────────

function writePackageJson(dir: string): void {
  const content = JSON.stringify({ type: 'module', private: true }, null, 2)
  fs.writeFileSync(path.join(dir, 'package.json'), content, 'utf-8')
}

function writeIndexHtml(dir: string): void {
  const content = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Theme Preview</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
  fs.writeFileSync(path.join(dir, 'index.html'), content, 'utf-8')
}

function writeConfigFile(dir: string, themeName: string): void {
  const content = `import { defineConfig } from 'boltdocs'

export default defineConfig({
  docsDir: '${normalizePath(path.resolve(dir, 'docs'))}',
  theme: {
    title: 'Theme Preview — ${themeName}',
    description: 'Preview environment for the "${themeName}" Boltdocs theme',
    navbar: [
      { label: 'Home', href: '/' },
      { label: 'Guides', href: '/docs/guides/getting-started' },
      { label: 'Examples', href: '/docs/examples/advanced' },
    ],
    codeTheme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
})
`
  fs.writeFileSync(path.join(dir, 'boltdocs.config.ts'), content, 'utf-8')
}

function writeLayoutFile(dir: string, layoutPath?: string): void {
  const dest = path.join(dir, 'docs', 'layout.tsx')

  if (layoutPath) {
    // Try symlink first, fall back to copy
    if (!createSymlink(layoutPath, dest)) {
      // Symlink failed, copy the file
      try {
        fs.copyFileSync(layoutPath, dest)
        if (process.env.BOLTDOCS_DEBUG === 'true') {
          console.warn(
            '[boltdocs] Symlink not supported, falling back to copy. Edits to the original layout will not trigger HMR.',
          )
        }
      } catch (e) {
        error(`Failed to copy layout file: ${layoutPath}`, e)
        process.exit(1)
      }
    }
    return
  }

  // Default layout
  const content = `import { DocsLayout } from 'boltdocs/client'

interface ThemeLayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: ThemeLayoutProps) {
  return <DocsLayout>{children}</DocsLayout>
}`
  fs.writeFileSync(dest, content, 'utf-8')
}

function writeMdxComponentsFile(dir: string, mdxPath?: string): void {
  const dest = path.join(dir, 'docs', 'mdx-components.tsx')

  if (mdxPath) {
    if (!createSymlink(mdxPath, dest)) {
      try {
        fs.copyFileSync(mdxPath, dest)
        if (process.env.BOLTDOCS_DEBUG === 'true') {
          console.warn(
            '[boltdocs] Symlink not supported for MDX components, falling back to copy. Edits will not trigger HMR.',
          )
        }
      } catch (e) {
        error(`Failed to copy MDX components file: ${mdxPath}`, e)
        process.exit(1)
      }
    }
    return
  }

  // Empty export to avoid MDX compiler "export missing" errors
  const content = `const mdxComponents = {}
export default mdxComponents
`
  fs.writeFileSync(dest, content, 'utf-8')
}

// ─── Sample MDX Content ───────────────────────────────────────

function writeSampleContent(dir: string): void {
  // index.mdx
  writeMdx(
    path.join(dir, 'docs', 'index.mdx'),
    `---
title: Welcome
description: Welcome to the Boltdocs Theme Preview
sidebarPosition: 0
---

# Welcome to the Theme Preview

This preview environment showcases all the visual elements of your Boltdocs theme.

## Quick Navigation

| Section | Description |
| :--- | :--- |
| [Getting Started](/docs/guides/getting-started) | Basic setup and configuration |
| [Typography](/docs/guides/typography) | All heading levels, text styles, and block elements |
| [Lists](/docs/guides/lists) | Ordered, unordered, task, and definition lists |
| [Tables](/docs/guides/tables) | Simple, aligned, and complex tables |
| [Code](/docs/guides/code) | Multi-language code blocks with syntax highlighting |
| [Advanced Examples](/docs/examples/advanced) | Complex layouts combining all elements |

---

> **Tip:** Edit your \`layout.tsx\` file to see changes reflected instantly via Hot Module Replacement.

## Theme Information

| Property | Value |
| :--- | :--- |
| Theme | ${path.basename(dir)} |
| Mode | Preview |
| HMR | Active |
`,
  )

  // getting-started.mdx
  writeMdx(
    path.join(dir, 'docs', 'guides', 'getting-started.mdx'),
    `---
title: Getting Started
description: Getting started with your Boltdocs theme
sidebarPosition: 1
group: guides
---

# Getting Started with Your Theme

This guide walks through the basic structure and configuration of your Boltdocs theme.

## Installation

Install your theme in any Boltdocs project:

\`\`\`bash
pnpm add your-theme-package
\`\`\`

## Usage

Add the theme to your \`boltdocs.config.ts\`:

\`\`\`ts
import { defineConfig } from 'boltdocs'
import myTheme from 'your-theme-package'

export default defineConfig({
  theme: {
    title: 'My Documentation',
  },
  plugins: [
    myTheme(),
  ],
})
\`\`\`

## Customization

You can customize the theme through plugin options:

\`\`\`ts
myTheme({
  primaryColor: '#6366f1',
  borderRadius: 'medium',
  font: 'inter',
})
\`\`\`

### Available Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| \`primaryColor\` | \`string\` | \`#6366f1\` | Primary accent color |
| \`borderRadius\` | \`'small' \\| 'medium' \\| 'large'\` | \`'medium'\` | Border radius |
| \`font\` | \`string\` | \`'inter'\` | Font family |
`,
  )

  // typography.mdx
  writeMdx(
    path.join(dir, 'docs', 'guides', 'typography.mdx'),
    `---
title: Typography
description: Typography showcase for the theme
sidebarPosition: 2
group: guides
badge: "Reference"
---

# Typography Showcase

This page demonstrates all typographic elements available in your theme.

## Headings

# Heading 1 — Page Title

## Heading 2 — Section Title

### Heading 3 — Subsection Title

#### Heading 4 — Group Title

##### Heading 5 — Item Title

###### Heading 6 — Small Title

## Body Text

Regular paragraph text. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

**Bold text** for emphasis. *Italic text* for subtle emphasis.
~~Strikethrough~~ for deleted content. \`Inline code\` for technical terms.

[Hyperlinks](/) for navigation references.

## Blockquotes

> Single-line blockquote for short callouts.

> Multi-line blockquote for longer quotations.
> This continues across multiple lines.
>
> — *Attribution*

## Horizontal Rules

---

***

___
`,
  )

  // lists.mdx
  writeMdx(
    path.join(dir, 'docs', 'guides', 'lists.mdx'),
    `---
title: Lists
description: List style showcase
sidebarPosition: 3
group: guides
---

# Lists

## Unordered Lists

- Item one with a longer description that wraps to multiple lines
- Item two
  - Nested item A
  - Nested item B
    - Deeply nested item
    - Another deep item
- Item three

## Ordered Lists

1. First step in the process
2. Second step with additional context
3. Third and final step

### Nested Ordered

1. First
   1. Sub-step one
   2. Sub-step two
2. Second

## Task Lists

- [x] Completed task
- [ ] Pending task
- [ ] Another pending task
- [x] Review completed

## Definition Lists

Term One
: Definition for term one with detailed explanation.

Term Two
: Definition for term two.

Term Three
: Definition for term three with additional context and notes.
`,
  )

  // tables.mdx
  writeMdx(
    path.join(dir, 'docs', 'guides', 'tables.mdx'),
    `---
title: Tables
description: Table style showcase
sidebarPosition: 4
group: guides
---

# Tables

## Simple Table

| Feature | Status | Priority |
| :--- | :--- | :--- |
| Dark Mode | ✅ Done | High |
| Mobile Nav | ✅ Done | High |
| Search | 🚧 WIP | Medium |
| Analytics | ❌ Planned | Low |

## Aligned Table

| Left | Center | Right |
| :--- | :---: | :---: |
| Left-aligned | Centered | Right-aligned |
| Short | Medium | Long content here |
| A | B | C |

## Complex Table

| Package | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| \`boltdocs\` | 3.3.0 | Core framework | \`@jesusalcala\` |
| \`@bdocs/plugin-tailwindcss\` | 2.0.0 | Tailwind integration | \`@jesusalcala\` |
| \`@bdocs/plugin-mermaid\` | 1.2.0 | Mermaid diagram support | \`@jesusalcala\` |
`,
  )

  // code.mdx
  writeMdx(
    path.join(dir, 'docs', 'guides', 'code.mdx'),
    `---
title: Code Blocks
description: Code block showcase with syntax highlighting
sidebarPosition: 5
group: guides
---

# Code Blocks

## TypeScript

\`\`\`typescript
interface ThemeOptions {
  primaryColor: string
  borderRadius: 'small' | 'medium' | 'large'
  font?: string
}

function configureTheme(options: ThemeOptions): ThemeInstance {
  const theme = new ThemeInstance(options)
  return theme
}

const myTheme = configureTheme({
  primaryColor: '#6366f1',
  borderRadius: 'medium',
  font: 'inter',
})
\`\`\`

## Python

\`\`\`python
def fibonacci(n: int) -> int:
    """Calculate the nth Fibonacci number."""
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

result = fibonacci(10)
print(f"F(10) = {result}")

class ThemeManager:
    def __init__(self, name: str):
        self.name = name
        self._config = {}
    
    def configure(self, **kwargs):
        self._config.update(kwargs)
        return self
\`\`\`

## Bash

\`\`\`bash
# Install and build
pnpm install
pnpm run build
pnpm run dev

# Deploy to production
docker build -t my-theme .
docker run -p 3000:3000 my-theme
\`\`\`

## JSON

\`\`\`json
{
  "name": "my-theme",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch"
  },
  "dependencies": {
    "boltdocs": "^3.3.0",
    "react": "^19.0.0"
  }
}
\`\`\`

## Diff

\`\`\`diff
- const oldConfig = { theme: 'dark' }
+ const newConfig = { theme: 'system', primary: '#6366f1' }
  // Shared line
  console.log('Initialized')
\`\`\`

## Inline Code

Use the \`configureTheme()\` function with \`primaryColor: '#7c3aed'\` to customize the \`ThemeInstance\`.
`,
  )

  // advanced.mdx
  writeMdx(
    path.join(dir, 'docs', 'examples', 'advanced.mdx'),
    `---
title: Advanced Examples
description: Complex layouts and patterns
sidebarPosition: 1
group: examples
---

# Advanced Examples

Complex documentation patterns to test your theme's versatility.

## Code with Line Highlighting

\`\`\`ts {1,4-6}
import { defineConfig } from 'boltdocs'
import myTheme from 'my-theme'

export default defineConfig({
  theme: { title: 'My Docs' },
  plugins: [myTheme()],
})
\`\`\`

## Image with Caption

![Placeholder](https://placehold.co/800x400/6366f1/ffffff?text=Theme+Preview)

## API Reference

### \`configureTheme(options)\`

Configures the theme with the provided options.

**Parameters:**

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| \`options\` | \`ThemeOptions\` | Yes | Theme configuration object |
| \`options.primaryColor\` | \`string\` | No | Primary accent color |
| \`options.darkMode\` | \`boolean\` | No | Enable dark mode |

**Returns:** \`ThemeInstance\`

**Example:**

\`\`\`ts
const theme = configureTheme({
  primaryColor: '#7c3aed',
  darkMode: true,
})
\`\`\`

## Mixed Content Section

### 1. Feature Overview

The following table compares key features across different configurations:

| Feature | Basic | Pro | Enterprise |
| :--- | :---: | :---: | :---: |
| Themes | 1 | 5 | Unlimited |
| Custom CSS | — | ✅ | ✅ |
| API Access | — | — | ✅ |
| Support | Community | Email | Dedicated |

### 2. Quick Setup

To get started with the Pro plan:

1. Install the package
2. Configure your API key
3. Customize your theme

> **Note:** The Pro plan includes access to all premium themes.

### 3. Configuration Example

\`\`\`json
{
  "plan": "pro",
  "themes": ["dark", "light", "ocean"],
  "apiKey": "sk-...",
  "features": {
    "customCss": true,
    "analytics": true
  }
}
\`\`\`
`,
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function writeMdx(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

function createSymlink(target: string, linkPath: string): boolean {
  try {
    fs.mkdirSync(path.dirname(linkPath), { recursive: true })
    fs.symlinkSync(target, linkPath, 'file')
    return true
  } catch {
    return false
  }
}

function checkPackageDependency(rootDir: string, packageName: string): void {
  const found = findPackageInNodeModules(rootDir, packageName)
  if (!found) {
    error(`${packageName} is not installed in your project.`)
    error(`Run: pnpm add -D ${packageName}`)
    process.exit(1)
  }
}

function findPackageInNodeModules(
  startDir: string,
  packageName: string,
): boolean {
  let current = startDir
  const root = path.parse(current).root

  while (current !== root) {
    const nmPath = path.join(
      current,
      'node_modules',
      packageName,
      'package.json',
    )
    if (fs.existsSync(nmPath)) {
      return true
    }
    current = path.dirname(current)
  }
  return false
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function cleanup(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}
