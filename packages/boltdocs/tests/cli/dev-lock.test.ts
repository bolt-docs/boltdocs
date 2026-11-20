import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { acquireDevServerLock } from '../../src/node/cli/dev-lock'

describe('acquireDevServerLock', () => {
  it('prevents two live owners and releases ownership idempotently', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-dev-lock-'))
    const first = acquireDevServerLock(root)

    expect(() => acquireDevServerLock(root)).toThrow(/already running/)
    first.release()
    first.release()

    const second = acquireDevServerLock(root)
    second.release()
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('recovers a lock whose process is no longer alive', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-dev-lock-'))
    const lockPath = path.join(root, '.boltdocs', 'dev-server.lock')
    fs.mkdirSync(path.dirname(lockPath), { recursive: true })
    fs.writeFileSync(lockPath, '999999999\n')

    const lock = acquireDevServerLock(root)
    expect(fs.readFileSync(lockPath, 'utf8').trim()).toBe(String(process.pid))
    lock.release()
    expect(fs.existsSync(lockPath)).toBe(false)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
