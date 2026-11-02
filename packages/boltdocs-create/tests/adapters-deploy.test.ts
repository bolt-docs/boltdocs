import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { adaptersDeploy } from '../src/deploy/adapters'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('adaptersDeploy generator', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdocs-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })
  it('should scaffold Vercel configurations', () => {
    adaptersDeploy(tempDir, 'vercel')

    const feedbackFile = path.join(tempDir, 'api', 'feedback.ts')
    expect(fs.existsSync(feedbackFile)).toBe(true)
    expect(fs.readFileSync(feedbackFile, 'utf-8')).toContain(
      "import { handleVercelFeedback } from 'boltdocs'",
    )
  })

  it('should scaffold Netlify configurations', () => {
    adaptersDeploy(tempDir, 'netlify')

    const feedbackFile = path.join(
      tempDir,
      'netlify',
      'functions',
      'feedback.ts',
    )
    const tomlFile = path.join(tempDir, 'netlify.toml')

    expect(fs.existsSync(feedbackFile)).toBe(true)
    expect(fs.readFileSync(feedbackFile, 'utf-8')).toContain(
      "import { handleNetlifyFeedback } from 'boltdocs'",
    )
    expect(fs.existsSync(tomlFile)).toBe(true)
    expect(fs.readFileSync(tomlFile, 'utf-8')).toContain(
      '/.netlify/functions/feedback',
    )
  })

  it('should scaffold Cloudflare configurations', () => {
    adaptersDeploy(tempDir, 'cloudflare')

    const feedbackFile = path.join(tempDir, 'functions', 'api', 'feedback.ts')
    expect(fs.existsSync(feedbackFile)).toBe(true)
    expect(fs.readFileSync(feedbackFile, 'utf-8')).toContain(
      "import { handleWebFeedback } from 'boltdocs'",
    )
  })

  it('should scaffold AWS Lambda configurations', () => {
    adaptersDeploy(tempDir, 'aws')

    const feedbackFile = path.join(tempDir, 'lambda', 'feedback.ts')
    expect(fs.existsSync(feedbackFile)).toBe(true)
    expect(fs.readFileSync(feedbackFile, 'utf-8')).toContain(
      "import { handleAwsFeedback } from 'boltdocs'",
    )
  })

  it('should do nothing for static target', () => {
    adaptersDeploy(tempDir, 'static')
    expect(fs.readdirSync(tempDir)).toHaveLength(0)
  })
})
