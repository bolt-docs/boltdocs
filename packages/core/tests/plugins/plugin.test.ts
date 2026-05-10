import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'

describe('boltdocsPlugin', () => {
  let tempDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-plugin-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('plugin features', () => {
    it('should have security headers defined', async () => {
      const { SECURITY_HEADERS } = await import(
        '../../src/node/security/headers'
      )
      expect(SECURITY_HEADERS).toBeDefined()
    })
  })
})
