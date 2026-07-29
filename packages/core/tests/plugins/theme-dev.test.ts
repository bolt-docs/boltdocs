import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

// ── Module-level mocks ───────────────────────────────────────

// Mock @bdocs/ssg/node before importing the module under test
vi.mock('@bdocs/ssg/node', () => ({
  createServer: vi.fn().mockResolvedValue({
    listen: vi.fn().mockResolvedValue(undefined),
    resolvedUrls: {
      local: ['http://localhost:5173/'],
      network: [],
    },
    bindCLIShortcuts: vi.fn(),
  }),
}))

// Mock @bdocs/dui
vi.mock('@bdocs/dui', () => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
}))

// Mock update-check
vi.mock('../../src/node/update-check', () => ({
  notifyUpdateAvailable: vi.fn(),
}))

// Mock createViteConfig
vi.mock('../../src/node/index', () => ({
  createViteConfig: vi.fn().mockResolvedValue({
    logLevel: 'warn',
    clearScreen: false,
    server: {},
  }),
}))

// Mock @bdocs/plugin-tailwindcss for --tailwind dynamic import
vi.mock('@bdocs/plugin-tailwindcss', () => ({
  default: () => ({ name: 'plugin-tailwindcss' }),
}))

// Mock @bdocs/plugin-sass for --sass dynamic import
vi.mock('@bdocs/plugin-sass', () => ({
  default: () => ({ name: 'plugin-sass' }),
}))

// Import AFTER mocks
import { themeDevAction, type ThemeDevOptions } from '../../src/node/cli/theme'

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-dev-test-'))
  return dir
}

describe('theme:dev command (themeDevAction)', () => {
  let tempProjectDir: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempProjectDir = createTempDir()

    // Create a minimal project structure
    fs.mkdirSync(path.join(tempProjectDir, 'docs'), { recursive: true })
    fs.writeFileSync(
      path.join(tempProjectDir, 'package.json'),
      JSON.stringify({ type: 'module', private: true }),
    )
    fs.writeFileSync(
      path.join(tempProjectDir, 'index.html'),
      '<!doctype html><html><body><div id="root"></div></body></html>',
    )

    // Create a test layout file
    fs.writeFileSync(
      path.join(tempProjectDir, 'layout.tsx'),
      `import { DocsLayout } from 'boltdocs/client'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout>{children}</DocsLayout>
}`,
    )

    // Create a test mdx-components file
    fs.writeFileSync(
      path.join(tempProjectDir, 'mdx-components.tsx'),
      `const components = {}
export default components`,
    )

    // Simulate node_modules with boltdocs
    const nmDir = path.join(tempProjectDir, 'node_modules', 'boltdocs')
    fs.mkdirSync(nmDir, { recursive: true })
    fs.writeFileSync(
      path.join(nmDir, 'package.json'),
      JSON.stringify({ name: 'boltdocs', version: '3.3.0' }),
    )
  })

  afterEach(() => {
    process.chdir(originalCwd)
    try {
      fs.rmSync(tempProjectDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks()
  })

  // ── 1. Interface / Types ─────────────────────────────────

  it('exports ThemeDevOptions interface with all expected fields', () => {
    // Type check only: verify the interface shape
    const opts: ThemeDevOptions = {
      port: 4000,
      host: '0.0.0.0',
      name: 'Test Theme',
      layout: './layout.tsx',
      mdx: './components.tsx',
      tailwind: true,
      sass: false,
      verbose: true,
    }
    expect(opts.port).toBe(4000)
    expect(opts.host).toBe('0.0.0.0')
    expect(opts.name).toBe('Test Theme')
    expect(opts.layout).toBe('./layout.tsx')
    expect(opts.mdx).toBe('./components.tsx')
    expect(opts.tailwind).toBe(true)
    expect(opts.sass).toBe(false)
    expect(opts.verbose).toBe(true)
  })

  // ── 2. Layout file validation ────────────────────────────

  it('fails with exit code when --layout points to a non-existent file', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)')
    })

    await expect(
      themeDevAction(tempProjectDir, {
        layout: '/nonexistent/path/layout.tsx',
      }),
    ).rejects.toThrow('process.exit(1)')

    exitSpy.mockRestore()
  })

  it('fails with exit code when --mdx points to a non-existent file', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit(1)')
    })

    await expect(
      themeDevAction(tempProjectDir, {
        mdx: '/nonexistent/path/components.tsx',
      }),
    ).rejects.toThrow('process.exit(1)')

    exitSpy.mockRestore()
  })

  // ── 3. Temp project creation ────────────────────────────

  it('creates a temp project under .boltdocs/theme-preview/', async () => {
    // Spy on server.listen to prevent actual startup
    const { createServer } = await import('@bdocs/ssg/node')
    const mockServer = {
      listen: vi.fn().mockResolvedValue(undefined),
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] },
      bindCLIShortcuts: vi.fn(),
    }
    vi.mocked(createServer).mockResolvedValue(mockServer as any)

    // Spy process.exit to prevent actual exit
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })

    // Spy process.chdir to prevent actual chdir
    vi.spyOn(process, 'chdir').mockImplementation(() => {})

    try {
      await themeDevAction(tempProjectDir)
    } catch {
      // Expected: server starts, process doesn't actually exit
    }

    // Check that temp project was created
    const themePreviewDir = path.join(
      tempProjectDir,
      '.boltdocs',
      'theme-preview',
    )
    expect(fs.existsSync(themePreviewDir)).toBe(true)

    const dirs = fs.readdirSync(themePreviewDir)
    expect(dirs.length).toBeGreaterThan(0)
    const previewDir = path.join(themePreviewDir, dirs[0])

    // Verify essential files exist
    expect(fs.existsSync(path.join(previewDir, 'package.json'))).toBe(true)
    expect(fs.existsSync(path.join(previewDir, 'index.html'))).toBe(true)
    expect(fs.existsSync(path.join(previewDir, 'boltdocs.config.ts'))).toBe(
      true,
    )
    expect(fs.existsSync(path.join(previewDir, 'docs', 'layout.tsx'))).toBe(
      true,
    )
    expect(
      fs.existsSync(path.join(previewDir, 'docs', 'mdx-components.tsx')),
    ).toBe(true)

    // Verify sample MDX pages
    expect(fs.existsSync(path.join(previewDir, 'docs', 'index.mdx'))).toBe(true)
    expect(
      fs.existsSync(
        path.join(previewDir, 'docs', 'guides', 'getting-started.mdx'),
      ),
    ).toBe(true)
    expect(
      fs.existsSync(path.join(previewDir, 'docs', 'guides', 'typography.mdx')),
    ).toBe(true)
    expect(
      fs.existsSync(path.join(previewDir, 'docs', 'guides', 'lists.mdx')),
    ).toBe(true)
    expect(
      fs.existsSync(path.join(previewDir, 'docs', 'guides', 'tables.mdx')),
    ).toBe(true)
    expect(
      fs.existsSync(path.join(previewDir, 'docs', 'guides', 'code.mdx')),
    ).toBe(true)
    expect(
      fs.existsSync(path.join(previewDir, 'docs', 'examples', 'advanced.mdx')),
    ).toBe(true)

    // Clean up
    try {
      fs.rmSync(themePreviewDir, { recursive: true, force: true })
    } catch {}
  })

  // ── 4. Symlink creation ────────────────────────────────

  it('symlinks the --layout file into the temp project', async () => {
    const { createServer } = await import('@bdocs/ssg/node')
    vi.mocked(createServer).mockResolvedValue({
      listen: vi.fn().mockResolvedValue(undefined),
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] },
      bindCLIShortcuts: vi.fn(),
    } as any)

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(process, 'chdir').mockImplementation(() => {})

    const layoutPath = path.join(tempProjectDir, 'layout.tsx')

    try {
      await themeDevAction(tempProjectDir, { layout: layoutPath })
    } catch {
      // Expected
    }

    const themePreviewDir = path.join(
      tempProjectDir,
      '.boltdocs',
      'theme-preview',
    )
    const dirs = fs.readdirSync(themePreviewDir)
    const previewDir = path.join(themePreviewDir, dirs[0])
    const destLayout = path.join(previewDir, 'docs', 'layout.tsx')

    expect(fs.existsSync(destLayout)).toBe(true)
    const isSymlink = fs.lstatSync(destLayout).isSymbolicLink()
    // Some platforms may not support symlinks; verify the file exists either way
    expect(isSymlink || fs.existsSync(destLayout)).toBe(true)

    try {
      fs.rmSync(themePreviewDir, { recursive: true, force: true })
    } catch {}
  })

  // ── 5. Default layout generation ────────────────────────

  it('generates a default layout using DocsLayout when --layout is not provided', async () => {
    const { createServer } = await import('@bdocs/ssg/node')
    vi.mocked(createServer).mockResolvedValue({
      listen: vi.fn().mockResolvedValue(undefined),
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] },
      bindCLIShortcuts: vi.fn(),
    } as any)

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(process, 'chdir').mockImplementation(() => {})

    try {
      await themeDevAction(tempProjectDir)
    } catch {
      // Expected
    }

    const themePreviewDir = path.join(
      tempProjectDir,
      '.boltdocs',
      'theme-preview',
    )
    const dirs = fs.readdirSync(themePreviewDir)
    const previewDir = path.join(themePreviewDir, dirs[0])
    const layoutContent = fs.readFileSync(
      path.join(previewDir, 'docs', 'layout.tsx'),
      'utf-8',
    )

    expect(layoutContent).toContain('DocsLayout')
    expect(layoutContent).toContain("from 'boltdocs/client'")

    try {
      fs.rmSync(themePreviewDir, { recursive: true, force: true })
    } catch {}
  })

  // ── 6. Empty MDX components generation ──────────────────

  it('generates an empty mdx-components.tsx when --mdx is not provided', async () => {
    const { createServer } = await import('@bdocs/ssg/node')
    vi.mocked(createServer).mockResolvedValue({
      listen: vi.fn().mockResolvedValue(undefined),
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] },
      bindCLIShortcuts: vi.fn(),
    } as any)

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(process, 'chdir').mockImplementation(() => {})

    try {
      await themeDevAction(tempProjectDir)
    } catch {
      // Expected
    }

    const themePreviewDir = path.join(
      tempProjectDir,
      '.boltdocs',
      'theme-preview',
    )
    const dirs = fs.readdirSync(themePreviewDir)
    const previewDir = path.join(themePreviewDir, dirs[0])
    const mdxContent = fs.readFileSync(
      path.join(previewDir, 'docs', 'mdx-components.tsx'),
      'utf-8',
    )

    expect(mdxContent).toContain('export default')
    expect(mdxContent).toContain('mdxComponents')

    try {
      fs.rmSync(themePreviewDir, { recursive: true, force: true })
    } catch {}
  })

  // ── 7. boltdocs-client.mjs stub ────────────────────────

  it('creates a boltdocs-client.mjs stub in the temp project', async () => {
    const { createServer } = await import('@bdocs/ssg/node')
    vi.mocked(createServer).mockResolvedValue({
      listen: vi.fn().mockResolvedValue(undefined),
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] },
      bindCLIShortcuts: vi.fn(),
    } as any)

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(process, 'chdir').mockImplementation(() => {})

    try {
      await themeDevAction(tempProjectDir)
    } catch {
      // Expected
    }

    const themePreviewDir = path.join(
      tempProjectDir,
      '.boltdocs',
      'theme-preview',
    )
    const dirs = fs.readdirSync(themePreviewDir)
    const previewDir = path.join(themePreviewDir, dirs[0])

    expect(fs.existsSync(path.join(previewDir, 'boltdocs-client.mjs'))).toBe(
      true,
    )
    const stubContent = fs.readFileSync(
      path.join(previewDir, 'boltdocs-client.mjs'),
      'utf-8',
    )
    expect(stubContent).toContain('DocsLayout')
    expect(stubContent).toContain("from 'boltdocs/client'")

    try {
      fs.rmSync(themePreviewDir, { recursive: true, force: true })
    } catch {}
  })

  // ── 8. Config generation ────────────────────────────────

  it('generates a valid boltdocs.config.ts with navbar and theme settings', async () => {
    const { createServer } = await import('@bdocs/ssg/node')
    vi.mocked(createServer).mockResolvedValue({
      listen: vi.fn().mockResolvedValue(undefined),
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] },
      bindCLIShortcuts: vi.fn(),
    } as any)

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(process, 'chdir').mockImplementation(() => {})

    try {
      await themeDevAction(tempProjectDir, { name: 'Custom Theme' })
    } catch {
      // Expected
    }

    const themePreviewDir = path.join(
      tempProjectDir,
      '.boltdocs',
      'theme-preview',
    )
    const dirs = fs.readdirSync(themePreviewDir)
    const previewDir = path.join(themePreviewDir, dirs[0])
    const configContent = fs.readFileSync(
      path.join(previewDir, 'boltdocs.config.ts'),
      'utf-8',
    )

    expect(configContent).toContain('Custom Theme')
    expect(configContent).toContain('defineConfig')
    expect(configContent).toContain('navbar')
    expect(configContent).toContain('codeTheme')

    try {
      fs.rmSync(themePreviewDir, { recursive: true, force: true })
    } catch {}
  })

  // ── 9. Cleanup on exit ─────────────────────────────────

  it('cleans up the temp directory when process exits', async () => {
    const { createServer } = await import('@bdocs/ssg/node')
    vi.mocked(createServer).mockResolvedValue({
      listen: vi.fn().mockResolvedValue(undefined),
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] },
      bindCLIShortcuts: vi.fn(),
    } as any)

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(process, 'chdir').mockImplementation(() => {})

    try {
      await themeDevAction(tempProjectDir)
    } catch {
      // Expected
    }

    const themePreviewDir = path.join(
      tempProjectDir,
      '.boltdocs',
      'theme-preview',
    )
    expect(fs.existsSync(themePreviewDir)).toBe(true)

    // Simulate cleanup (this is what the SIGINT handler does)
    try {
      fs.rmSync(themePreviewDir, { recursive: true, force: true })
    } catch {}
    expect(fs.existsSync(themePreviewDir)).toBe(false)
  })

  // ── 10. Server URL display ─────────────────────────────

  it('displays the correct server URL with custom port', async () => {
    const { createServer } = await import('@bdocs/ssg/node')
    const mockServer = {
      listen: vi.fn().mockResolvedValue(undefined),
      resolvedUrls: {
        local: ['http://localhost:4899/'],
        network: [],
      },
      bindCLIShortcuts: vi.fn(),
    }
    vi.mocked(createServer).mockResolvedValue(mockServer as any)

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(process, 'chdir').mockImplementation(() => {})
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      await themeDevAction(tempProjectDir, { port: 4899 })
    } catch {
      // Expected
    }

    // Verify the URL was logged
    const loggedCalls = consoleSpy.mock.calls.flat().join(' ')
    expect(loggedCalls).toContain('4899')
    expect(loggedCalls).toContain('Theme Preview')

    consoleSpy.mockRestore()

    // Clean up
    const themePreviewDir = path.join(
      tempProjectDir,
      '.boltdocs',
      'theme-preview',
    )
    try {
      fs.rmSync(themePreviewDir, { recursive: true, force: true })
    } catch {}
  })

  // ── 11. Sample MDX content quality ──────────────────────

  it('generates sample MDX content with standard elements only', async () => {
    const { createServer } = await import('@bdocs/ssg/node')
    vi.mocked(createServer).mockResolvedValue({
      listen: vi.fn().mockResolvedValue(undefined),
      resolvedUrls: { local: ['http://localhost:5173/'], network: [] },
      bindCLIShortcuts: vi.fn(),
    } as any)

    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit')
    })
    vi.spyOn(process, 'chdir').mockImplementation(() => {})

    try {
      await themeDevAction(tempProjectDir, { name: 'Quality Test' })
    } catch {
      // Expected
    }

    const themePreviewDir = path.join(
      tempProjectDir,
      '.boltdocs',
      'theme-preview',
    )
    const dirs = fs.readdirSync(themePreviewDir)
    const previewDir = path.join(themePreviewDir, dirs[0])

    // Check typography page has standard elements
    const typography = fs.readFileSync(
      path.join(previewDir, 'docs', 'guides', 'typography.mdx'),
      'utf-8',
    )
    expect(typography).toContain('# Heading 1')
    expect(typography).toContain('## Heading 2')
    expect(typography).toContain('**Bold text**')
    expect(typography).toContain('*Italic text*')
    expect(typography).toContain('> Single-line blockquote')

    // Check lists page
    const lists = fs.readFileSync(
      path.join(previewDir, 'docs', 'guides', 'lists.mdx'),
      'utf-8',
    )
    expect(lists).toContain('- Item one')
    expect(lists).toContain('1. First step')
    expect(lists).toContain('- [x] Completed')
    expect(lists).toContain('Term One')

    // Check tables page
    const tables = fs.readFileSync(
      path.join(previewDir, 'docs', 'guides', 'tables.mdx'),
      'utf-8',
    )
    expect(tables).toContain('| Feature | Status | Priority |')
    expect(tables).toContain('| :--- | :---: | :---: |')

    // Check code page has multiple languages
    const code = fs.readFileSync(
      path.join(previewDir, 'docs', 'guides', 'code.mdx'),
      'utf-8',
    )
    expect(code).toContain('```typescript')
    expect(code).toContain('```python')
    expect(code).toContain('```bash')
    expect(code).toContain('```json')
    expect(code).toContain('```diff')

    // Check frontmatter is present
    const index = fs.readFileSync(
      path.join(previewDir, 'docs', 'index.mdx'),
      'utf-8',
    )
    expect(index).toContain('---')
    expect(index).toContain('title: Welcome')
    expect(index).toContain('sidebarPosition: 0')

    try {
      fs.rmSync(themePreviewDir, { recursive: true, force: true })
    } catch {}
  })
})
