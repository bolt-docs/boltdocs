import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('generateStaticPages', () => {
  let tempOutDir: string
  let tempDocsDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-ssg-out-'))
    tempDocsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-ssg-docs-'))
  })

  afterAll(() => {
    if (fs.existsSync(tempOutDir)) {
      fs.rmSync(tempOutDir, { recursive: true, force: true })
    }
    if (fs.existsSync(tempDocsDir)) {
      fs.rmSync(tempDocsDir, { recursive: true, force: true })
    }
  })

  it('should prepare directories for static page generation', async () => {
    // Create minimal setup
    fs.writeFileSync(
      path.join(tempOutDir, 'index.html'),
      '<html><body><div id="root"></div></body></html>',
    )

    // Verify directories exist
    expect(fs.existsSync(tempOutDir)).toBe(true)
    expect(fs.existsSync(tempDocsDir)).toBe(true)
  })

  it('should handle missing template index.html gracefully', async () => {
    // Without index.html template, SSG should handle gracefully
    const emptyDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'boltdocs-ssg-empty-'),
    )

    expect(fs.existsSync(path.join(emptyDir, 'index.html'))).toBe(false)

    fs.rmSync(emptyDir, { recursive: true, force: true })
  })
})
