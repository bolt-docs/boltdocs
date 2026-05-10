import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import * as ui from '../../src/node/cli/ui'

// Hoist the mock config so it's available for the hoisted vi.mock
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    docsDir: 'docs',
    theme: { title: 'Boltdocs' },
    i18n: undefined as any,
  },
}))

vi.mock('../../src/node/config', () => ({
  resolveConfig: vi.fn(async () => mockConfig),
}))

// Import after mocking
import {
  doctorAction,
  generateLinkTree,
  checkMetadata,
  DEFAULT_DOCTOR_CONFIG,
  type DoctorConfig,
  type DoctorContext,
} from '../../src/node/cli/doctor'

describe('doctor unified tests', () => {
  let tempDir: string
  let docsDir: string
  let mockDoctorConfig: DoctorConfig
  let ctx: DoctorContext

  beforeEach(() => {
    // Reset mock config
    mockConfig.base = '/'
    vi.clearAllMocks()
    tempDir = path.join(os.tmpdir(), `boltdocs-doctor-test-${Date.now()}`)
    docsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })

    // Reset mock config
    mockConfig.i18n = undefined

    // Create standard mock files with valid metadata to avoid noisy warnings
    fs.writeFileSync(
      path.join(docsDir, 'index.md'),
      '---\ntitle: "Home Page Title"\ndescription: "This is a valid description for the home page of Boltdocs."\n---\nWelcome',
    )
    fs.writeFileSync(
      path.join(docsDir, 'guide.md'),
      '---\ntitle: "Guide Page Title"\ndescription: "This is a valid description for the guide page of Boltdocs."\n---\nGuide content',
    )

    // Reset mock doctor config
    mockDoctorConfig = { ...DEFAULT_DOCTOR_CONFIG }

    // Standard context for individual check tests
    ctx = {
      root: tempDir,
      docsDir,
      config: mockConfig as any,
      doctorConfig: mockDoctorConfig,
      linkTree: { routes: ['/', '/guide'], timestamp: Date.now() },
      files: [],
      options: {},
    }

    vi.stubGlobal('process', { ...process, exit: vi.fn() })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    // Mock ui.confirm to always confirm in tests
    vi.spyOn(ui, 'confirm').mockResolvedValue(true)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  // --- Basic Checks ---

  it('generateLinkTree should create link-tree.json', async () => {
    await generateLinkTree(docsDir, tempDir, mockConfig as any)
    const treePath = path.join(tempDir, '.boltdocs', 'link-tree.json')

    expect(fs.existsSync(treePath)).toBe(true)
    const tree = JSON.parse(fs.readFileSync(treePath, 'utf-8'))
    expect(tree.routes).toContain('/')
    expect(tree.routes).toContain('/guide')
  })

  it('doctorAction should detect broken links', async () => {
    const brokenFilePath = path.join(docsDir, 'broken.md')
    fs.writeFileSync(
      brokenFilePath,
      '---\ntitle: Broken\n---\n[Invalid Link](/non-existent)',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Broken internal link: "/non-existent"')
  })

  it('doctorAction should suggest similar links', async () => {
    const typoFilePath = path.join(docsDir, 'typo.md')
    fs.writeFileSync(
      typoFilePath,
      '---\ntitle: "Typo Suggest Title"\ndescription: "This is a valid description for the typo suggest test page."\n---\n[Typo Link](/guido)',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Did you mean "/guide"?')
  })

  it('doctorAction with --fix should repair broken links', async () => {
    const typoFilePath = path.join(docsDir, 'typo-fix.md')
    fs.writeFileSync(
      typoFilePath,
      '---\ntitle: "Fixable Typo Title"\ndescription: "This is a valid description for the typo fix test page."\n---\nCheck out the [guide](/guido)',
    )

    await doctorAction(tempDir, { fix: true })

    const content = fs.readFileSync(typoFilePath, 'utf-8')
    expect(content).toContain('[guide](/guide)')
    expect(
      (console.log as any).mock.calls.map((c: any) => c[0]).join('\n'),
    ).toContain('Successfully fixed 1 issues automatically!')
  })

  it('doctorAction should handle base path correctly', async () => {
    // Set base path in mock config
    mockConfig.base = '/docs'

    const filePath = path.join(docsDir, 'base-test.md')
    // Link without /docs should be broken
    fs.writeFileSync(
      filePath,
      '---\ntitle: "Base Test"\ndescription: "D"\n---\n[Broken Link](/guide)',
    )

    // Regenerate link tree with new config
    await generateLinkTree(docsDir, tempDir, mockConfig as any)

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Broken internal link: "/guide"')
    expect(calls).toContain('Did you mean "/docs/guide"?')

    // Cleanup
    delete (mockConfig as any).base
  })

  // --- Complex Link Scenarios ---

  it('should handle nested relative links correctly', async () => {
    const subDir = path.join(docsDir, 'level1', 'level2')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(
      path.join(docsDir, 'target.md'),
      '---\ntitle: T\n---\nTarget',
    )
    const sourceFile = path.join(subDir, 'source.md')
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: S\n---\n[Relative](../../target.md)',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Broken internal link')
  })

  it('should handle links with anchors and query params', async () => {
    fs.writeFileSync(
      path.join(docsDir, 'page.md'),
      '---\ntitle: P\n---\n# Page',
    )
    const sourceFile = path.join(docsDir, 'source.md')
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: S\n---\n[Anchor](/page#section) and [Query](/page?v=1)',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Broken internal link')
  })

  it('should suggest fixes for complex broken links while preserving anchors', async () => {
    fs.writeFileSync(
      path.join(docsDir, 'installation.md'),
      '---\ntitle: I\n---\n# Install',
    )
    const sourceFile = path.join(docsDir, 'source.md')
    fs.writeFileSync(sourceFile, '---\ntitle: S\n---\n[Wrong](/install#step-1)')

    await doctorAction(tempDir, { fix: true })

    const content = fs.readFileSync(sourceFile, 'utf-8')
    expect(content).toContain('(/installation#step-1)')
  })

  it('should handle folder links by looking for index.md', async () => {
    const subDir = path.join(docsDir, 'folder')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(
      path.join(subDir, 'index.md'),
      '---\ntitle: F\n---\n# Index',
    )

    const sourceFile = path.join(docsDir, 'source.md')
    fs.writeFileSync(sourceFile, '---\ntitle: S\n---\n[Folder](/folder)')

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Broken internal link')
  })

  it('should handle links inside MDX component props', async () => {
    fs.writeFileSync(
      path.join(docsDir, 'target.md'),
      '---\ntitle: T\n---\n# Target',
    )
    const sourceFile = path.join(docsDir, 'source.mdx')
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: S\n---\n<Button href="/target">Click Me</Button>',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Broken internal link')
  })

  it('should handle links with non-ASCII characters and spaces', async () => {
    const specialFile = path.join(docsDir, 'página con espacios.md')
    fs.writeFileSync(specialFile, '---\ntitle: E\n---\n# Especial')

    const sourceFile = path.join(docsDir, 'source.md')
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: S\n---\n[Link](/página%20con%20espacios)',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Broken internal link')
  })

  // --- i18n Checks ---

  it('doctorAction should detect missing translations', async () => {
    mockConfig.i18n = { defaultLocale: 'en', locales: { en: 'en', es: 'es' } }
    const i18nDocsDir = path.join(tempDir, 'docs')
    fs.mkdirSync(path.join(i18nDocsDir, 'en'), { recursive: true })
    fs.mkdirSync(path.join(i18nDocsDir, 'es'), { recursive: true })
    fs.writeFileSync(
      path.join(i18nDocsDir, 'en', 'page.md'),
      '---\ntitle: Page\n---\nContent',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Missing translation for locale "es"')
  })

  it('doctorAction with --fix should create missing translations', async () => {
    mockConfig.i18n = { defaultLocale: 'en', locales: { en: 'en', es: 'es' } }
    const i18nDocsDir = path.join(tempDir, 'docs')
    const enPath = path.join(i18nDocsDir, 'en', 'fix-me.md')
    const esPath = path.join(i18nDocsDir, 'es', 'fix-me.md')

    if (!fs.existsSync(path.dirname(enPath)))
      fs.mkdirSync(path.dirname(enPath), { recursive: true })
    fs.writeFileSync(enPath, '---\ntitle: Fix Me\n---\nContent')

    await doctorAction(tempDir, { fix: true })

    expect(fs.existsSync(esPath)).toBe(true)
    expect(fs.readFileSync(esPath, 'utf-8')).toContain('title: Fix Me')
  })

  it('should handle asymmetric i18n nested structures', async () => {
    mockConfig.i18n = { defaultLocale: 'en', locales: { en: 'en', es: 'es' } }
    const enPath = path.join(docsDir, 'en', 'deep', 'nested', 'file.md')
    const esPath = path.join(docsDir, 'es', 'file.md')

    fs.mkdirSync(path.dirname(enPath), { recursive: true })
    fs.mkdirSync(path.dirname(esPath), { recursive: true })
    fs.writeFileSync(enPath, '---\ntitle: EN\n---\n# EN')
    fs.writeFileSync(esPath, '---\ntitle: ES\n---\n# ES')

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Missing translation for locale "es"')
    expect(calls).toContain('en/deep/nested/file.md')
    expect(calls).toContain('Orphaned translation')
    expect(calls).toContain('es/file.md')
  })

  // --- Frontmatter & Metadata Checks ---

  it('should handle frontmatter with special characters', async () => {
    const sourceFile = path.join(docsDir, 'source.md')
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: "Hello: World & More"\ndescription: A valid description for SEO purposes.\n---\nContent',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Missing "title"')
  })

  it('should detect short titles and missing descriptions', async () => {
    const sourceFile = path.join(docsDir, 'short.md')
    fs.writeFileSync(sourceFile, '---\ntitle: Short\n---\nContent')

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Title is too short')
    expect(calls).toContain('Missing required frontmatter field: "description"')
  })

  it('should detect duplicate titles', async () => {
    fs.writeFileSync(
      path.join(docsDir, 'p1.md'),
      '---\ntitle: Same Title\ndescription: D1\n---\nC1',
    )
    fs.writeFileSync(
      path.join(docsDir, 'p2.md'),
      '---\ntitle: Same Title\ndescription: D2\n---\nC2',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Duplicate title found: "Same Title"')
  })

  // --- External Link Checks ---

  it('should ignore external links by default', async () => {
    const sourceFile = path.join(docsDir, 'ext.md')
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: Ext\ndescription: D\n---\n[Google](https://google.com/404)',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Broken external link')
  })

  it('should detect broken external links when enabled', async () => {
    const sourceFile = path.join(docsDir, 'ext-check.md')
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: Ext Check\ndescription: D\n---\n[Bad](https://invalid-url-123.com)',
    )

    // Mock fetch to fail
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockRejectedValue(new Error('DNS Error'))

    try {
      await doctorAction(tempDir, { checkExternal: true })
      const calls = (console.log as any).mock.calls
        .map((c: any) => c[0])
        .join('\n')
      expect(calls).toContain(
        'Broken external link: "https://invalid-url-123.com"',
      )
    } finally {
      global.fetch = originalFetch
    }
  })

  // --- Configuration Checks ---

  it('should respect metadata.enabled: false from doctor.json', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'doctor.json'),
      JSON.stringify({
        checks: { metadata: { enabled: false } },
      }),
    )

    const sourceFile = path.join(docsDir, 'no-meta.md')
    fs.writeFileSync(sourceFile, '# No Meta') // Should warn about missing title if enabled

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Missing "title"')
  })

  it('should respect custom metadata thresholds from doctor.json', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'doctor.json'),
      JSON.stringify({
        checks: { metadata: { titleMin: 5 } },
      }),
    )

    const sourceFile = path.join(docsDir, 'short.md')
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: "Short"\ndescription: "Valid description"\n---\nContent',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Title is too short')
  })

  it('should respect exclude patterns from doctor.json', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'doctor.json'),
      JSON.stringify({
        exclude: ['**/ignored.md'],
      }),
    )

    const ignoredFile = path.join(docsDir, 'ignored.md')
    fs.writeFileSync(ignoredFile, '# Should be ignored')

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('ignored.md')
  })

  it('should respect ignore links from doctor.json', async () => {
    fs.writeFileSync(
      path.join(tempDir, 'doctor.json'),
      JSON.stringify({
        checks: { links: { ignore: ['internal-tool.com'] } },
      }),
    )

    const sourceFile = path.join(docsDir, 'links.md')
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: "Links"\ndescription: "D"\n---\n[Tool](https://internal-tool.com/broken)',
    )

    await doctorAction(tempDir, { checkExternal: true })

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).not.toContain('Broken external link')
  })

  // --- Sidebar Validation Checks ---

  it('should detect broken links in the sidebar', async () => {
    mockConfig.theme.sidebar = {
      'Getting Started': [
        { text: 'Introduction', link: '/intro' }, // Broken link
      ],
    }

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Broken sidebar link: "/intro"')
  })

  it('should detect orphaned pages not in the sidebar', async () => {
    mockConfig.theme.sidebar = {
      Guide: [
        { text: 'Home', link: '/' },
        // /guide is missing
      ],
    }

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Orphaned page found: "/guide"')
  })

  it('should detect missing labels in the sidebar', async () => {
    mockConfig.theme.sidebar = {
      Empty: [{ text: '', link: '/guide' }],
    }

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('missing a label')
  })

  // --- Frontmatter Schema Checks ---

  it('should detect invalid frontmatter types', async () => {
    const sourceFile = path.join(docsDir, 'invalid-type.md')
    // sidebarPosition should be a number, not a string
    fs.writeFileSync(
      sourceFile,
      '---\ntitle: "T"\ndescription: "D"\nsidebarPosition: "first"\n---\nContent',
    )

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Invalid frontmatter field "sidebarPosition"')
  })

  it('should detect malformed YAML', async () => {
    const sourceFile = path.join(docsDir, 'bad-yaml.md')
    // Unclosed quote or bad indentation
    fs.writeFileSync(sourceFile, '---\ntitle: "Unclosed\n---\nContent')

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(calls).toContain('Malformed frontmatter')
  })

  it('should flag missing required frontmatter fields', async () => {
    const filePath = path.join(docsDir, 'required.md')
    fs.writeFileSync(filePath, '---\ntitle: Only Title\n---\nContent')
    const config: DoctorConfig = {
      ...mockDoctorConfig,
      checks: {
        ...mockDoctorConfig.checks,
        metadata: { ...mockDoctorConfig.checks.metadata, required: ['author'] },
      },
    }
    fs.writeFileSync(path.join(tempDir, 'doctor.json'), JSON.stringify(config))

    const issues = await checkMetadata({
      ...ctx,
      doctorConfig: config,
      files: [filePath],
    })
    expect(issues).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining(
          'Missing required frontmatter field: "author"',
        ),
      }),
    )
  })

  it('should validate date formats if enabled', async () => {
    const filePath = path.join(docsDir, 'bad-date.md')
    fs.writeFileSync(
      filePath,
      '---\ntitle: Bad Date\ndate: not-a-date\n---\nContent',
    )
    const config: DoctorConfig = {
      ...mockDoctorConfig,
      checks: {
        ...mockDoctorConfig.checks,
        metadata: { ...mockDoctorConfig.checks.metadata, validateDates: true },
      },
    }
    fs.writeFileSync(path.join(tempDir, 'doctor.json'), JSON.stringify(config))

    const issues = await checkMetadata({
      ...ctx,
      doctorConfig: config,
      files: [filePath],
    })
    expect(issues).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('Invalid date format in field "date"'),
      }),
    )
  })

  it('should respect custom severity overrides', async () => {
    const filePath = path.join(docsDir, 'severity.md')
    fs.writeFileSync(filePath, '---\ntitle: Short\n---\nContent')
    const config: DoctorConfig = {
      ...mockDoctorConfig,
      severity: { shortMetadata: 'high' },
    }
    fs.writeFileSync(path.join(tempDir, 'doctor.json'), JSON.stringify(config))

    const issues = await checkMetadata({
      ...ctx,
      doctorConfig: config,
      files: [filePath],
    })
    expect(issues.some((i) => i.level === 'high')).toBe(true)
  })

  it('should create backups before fixing if enabled', async () => {
    const typoFilePath = path.join(docsDir, 'typo-backup.md')
    fs.writeFileSync(typoFilePath, '[guide](/guido)')

    const backupPath = '.boltdocs/backups'
    const config: DoctorConfig = {
      ...mockDoctorConfig,
      fix: { ...mockDoctorConfig.fix, backupFiles: true, backupPath },
    }
    fs.writeFileSync(path.join(tempDir, 'doctor.json'), JSON.stringify(config))

    await doctorAction(tempDir, { fix: true })

    const fullBackupPath = path.resolve(tempDir, backupPath)
    expect(fs.existsSync(fullBackupPath)).toBe(true)
    const backups = fs.readdirSync(fullBackupPath)
    expect(backups.length).toBeGreaterThan(0)
    expect(backups.some((b) => b.includes('typo-backup.md'))).toBe(true)
  })

  it('should output JSON when format is set to json', async () => {
    const config: DoctorConfig = {
      ...mockDoctorConfig,
      reporting: { ...mockDoctorConfig.reporting, format: 'json' },
    }
    fs.writeFileSync(path.join(tempDir, 'doctor.json'), JSON.stringify(config))

    await doctorAction(tempDir)

    const calls = (console.log as any).mock.calls
      .map((c: any) => c[0])
      .join('\n')
    expect(() => JSON.parse(calls)).not.toThrow()
    const report = JSON.parse(calls)
    expect(report).toHaveProperty('summary')
    expect(report).toHaveProperty('issues')
  })

  it('should save report to outputFile if configured', async () => {
    const reportFile = 'custom-report.json'
    const config: DoctorConfig = {
      ...mockDoctorConfig,
      reporting: { ...mockDoctorConfig.reporting, outputFile: reportFile },
    }
    fs.writeFileSync(path.join(tempDir, 'doctor.json'), JSON.stringify(config))

    await doctorAction(tempDir)

    const fullReportPath = path.resolve(tempDir, reportFile)
    expect(fs.existsSync(fullReportPath)).toBe(true)
    const report = JSON.parse(fs.readFileSync(fullReportPath, 'utf-8'))
    expect(report.summary.total).toBeGreaterThan(0)
  })

  it('should exit with 1 if failOnError is true and errors exist', async () => {
    // Create an error (broken link)
    fs.writeFileSync(path.join(docsDir, 'error.md'), '[broken](/non-existent)')

    const config: DoctorConfig = {
      ...mockDoctorConfig,
      reporting: { ...mockDoctorConfig.reporting, failOnError: true },
    }
    fs.writeFileSync(path.join(tempDir, 'doctor.json'), JSON.stringify(config))

    await doctorAction(tempDir)
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('should exit with 1 if maxWarnings is exceeded', async () => {
    // Create warnings (missing descriptions)
    fs.writeFileSync(path.join(docsDir, 'w1.md'), '---\ntitle: T1\n---\n')
    fs.writeFileSync(path.join(docsDir, 'w2.md'), '---\ntitle: T2\n---\n')

    const config: DoctorConfig = {
      ...mockDoctorConfig,
      reporting: { ...mockDoctorConfig.reporting, maxWarnings: 1 },
    }
    fs.writeFileSync(path.join(tempDir, 'doctor.json'), JSON.stringify(config))

    await doctorAction(tempDir)
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
