import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

import { resolveConfig } from '../../src/node/config'

describe('Configuration Validation', () => {
  let tempProjectDir: string
  let docsDir: string

  beforeEach(() => {
    tempProjectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'boltdocs-validation-test-'),
    )
    docsDir = path.join(tempProjectDir, 'docs')
    fs.mkdirSync(docsDir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true })
    }
  })

  it('should validate a correct configuration', async () => {
    fs.writeFileSync(
      path.join(tempProjectDir, 'boltdocs.config.ts'),
      `export default {
        siteUrl: 'https://example.com',
        theme: { title: 'Test Site' }
      }`,
    )

    const config = await resolveConfig(docsDir, tempProjectDir)
    expect(config.siteUrl).toBe('https://example.com')
    expect(config.theme?.title).toBe('Test Site')
  })

  it('should throw an error for invalid siteUrl', async () => {
    fs.writeFileSync(
      path.join(tempProjectDir, 'boltdocs.config.ts'),
      `export default { siteUrl: 'not-a-url' }`,
    )

    await expect(resolveConfig(docsDir, tempProjectDir)).rejects.toThrow(
      /Invalid Boltdocs configuration/,
    )
    await expect(resolveConfig(docsDir, tempProjectDir)).rejects.toThrow(
      /siteUrl/,
    )
  })

  it('should validate social links correctly', async () => {
    fs.writeFileSync(
      path.join(tempProjectDir, 'boltdocs.config.ts'),
      `export default {
        theme: {
          socialLinks: [{ icon: 'github', link: 'https://github.com/test' }]
        }
      }`,
    )

    const config = await resolveConfig(docsDir, tempProjectDir)
    expect(config.theme?.socialLinks?.[0].icon).toBe('github')
  })

  it('should throw error for invalid social link URL', async () => {
    fs.writeFileSync(
      path.join(tempProjectDir, 'boltdocs.config.ts'),
      `export default {
        theme: {
          socialLinks: [{ icon: 'github', link: 'invalid-url' }]
        }
      }`,
    )

    await expect(resolveConfig(docsDir, tempProjectDir)).rejects.toThrow(
      /socialLinks\.0\.link/,
    )
  })

  it('should allow route groups in sidebar config (regression check for earlier fix)', async () => {
    fs.writeFileSync(
      path.join(tempProjectDir, 'boltdocs.config.ts'),
      `export default {
        theme: {
          sidebar: {
            '(guides)': [{ text: 'Intro', link: '/intro' }]
          }
        }
      }`,
    )

    const config = await resolveConfig(docsDir, tempProjectDir)
    expect(config.theme?.sidebar?.['(guides)']).toBeDefined()
  })

  it('should validate integrations config for ga4', async () => {
    fs.writeFileSync(
      path.join(tempProjectDir, 'boltdocs.config.ts'),
      `export default {
        integrations: {
          analytics: {
            ga4: {
              measurementId: 'G-12345678',
              debug: true
            }
          }
        }
      }`,
    )

    const config = await resolveConfig(docsDir, tempProjectDir)
    expect(config.integrations?.analytics?.ga4?.measurementId).toBe('G-12345678')
    expect(config.integrations?.analytics?.ga4?.debug).toBe(true)
  })

  it('should throw error for invalid ga4 measurementId', async () => {
    fs.writeFileSync(
      path.join(tempProjectDir, 'boltdocs.config.ts'),
      `export default {
        integrations: {
          analytics: {
            ga4: {
              measurementId: ''
            }
          }
        }
      }`,
    )

    await expect(resolveConfig(docsDir, tempProjectDir)).rejects.toThrow(
      /integrations\.analytics\.ga4\.measurementId/,
    )
  })
})
