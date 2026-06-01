import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  checkPath,
  setProjectRoot,
  applyFsPatch,
  disableFsPatch,
  enableFsPatch,
} from '@/node/security/fs-patch'
import { inspectPluginsSecurity } from '@/node/security/inspect'
import * as dui from '@bdocs/dui'

// Disable patch globally for the test environment to prevent interference with other tests
disableFsPatch()

describe('Security Features', () => {
  const root = path.resolve(__dirname, '../../temp-security-test')

  beforeEach(() => {
    disableFsPatch()
    setProjectRoot(root)
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true })
    }
  })

  afterEach(() => {
    disableFsPatch()
    try {
      fs.rmSync(root, { recursive: true, force: true })
    } catch (e) {
      // Ignore cleanup error
    }
  })

  afterAll(() => {
    disableFsPatch()
  })

  describe('FS Surgical Patch - path validation', () => {
    beforeEach(() => {
      enableFsPatch()
    })

    afterEach(() => {
      disableFsPatch()
    })

    it('allows path inside project root', () => {
      const target = path.join(root, 'docs/index.md')
      expect(() => checkPath(target)).not.toThrow()
    })

    it('blocks path outside project root', () => {
      const target = path.join(root, '../outside.txt')
      expect(() => checkPath(target)).toThrow(/blocked/)
    })

    it('blocks path touching .env', () => {
      const target1 = path.join(root, '.env')
      const target2 = path.join(root, 'docs/.env.local')
      expect(() => checkPath(target1)).toThrow(/blocked/)
      expect(() => checkPath(target2)).toThrow(/blocked/)
    })

    it('blocks path touching node_modules (non-cache)', () => {
      const target = path.join(root, 'node_modules/some-plugin/index.js')
      expect(() => checkPath(target)).toThrow(/blocked/)
    })

    it('allows path touching node_modules dot-folders (caches like .vite)', () => {
      const target = path.join(root, 'node_modules/.vite/deps/react.js')
      expect(() => checkPath(target)).not.toThrow()
    })
  })

  describe('FS Surgical Patch - monkey patch execution', () => {
    beforeEach(() => {
      applyFsPatch()
      enableFsPatch()
    })

    afterEach(() => {
      disableFsPatch()
    })

    it('throws error when writeFileSync is called on a blocked path', () => {
      const target = path.join(root, '../blocked-write.txt')
      expect(() => fs.writeFileSync(target, 'data')).toThrow(/blocked/)
    })

    it('passes callback error when writeFile is called on a blocked path', async () => {
      const target = path.join(root, '../blocked-write-async.txt')
      const err = await new Promise<Error | null>((resolve) => {
        fs.writeFile(target, 'data', (e) => {
          resolve(e)
        })
      })
      expect(err).toBeDefined()
      expect(err?.message).toMatch(/blocked/)
    })
  })

  describe('Plugin Install Script Inspector', () => {
    it('warns if plugin package.json defines install scripts', () => {
      const warnSpy = vi.spyOn(dui, 'warn').mockImplementation(() => {})

      const config = {
        plugins: [
          {
            name: 'mock-install-plugin',
          },
        ],
      }

      const pluginDir = path.join(root, 'node_modules/mock-install-plugin')
      fs.mkdirSync(pluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'mock-install-plugin',
          scripts: {
            postinstall: 'node build.js',
          },
        }),
      )

      inspectPluginsSecurity(config, root)

      expect(warnSpy).toHaveBeenCalled()
      expect(warnSpy.mock.calls[0][0]).toContain('mock-install-plugin')
      expect(warnSpy.mock.calls[0][0]).toContain('scripts nativos')

      warnSpy.mockRestore()
    })

    it('does not warn if plugin package.json does not define install scripts', () => {
      const warnSpy = vi.spyOn(dui, 'warn').mockImplementation(() => {})

      const config = {
        plugins: [
          {
            name: 'mock-clean-plugin',
          },
        ],
      }

      const pluginDir = path.join(root, 'node_modules/mock-clean-plugin')
      fs.mkdirSync(pluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(pluginDir, 'package.json'),
        JSON.stringify({
          name: 'mock-clean-plugin',
          scripts: {
            build: 'tsdown',
          },
        }),
      )

      inspectPluginsSecurity(config, root)

      expect(warnSpy).not.toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })
})
