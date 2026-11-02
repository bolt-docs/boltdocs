import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

export interface DevServerLock {
  release(): void
}

function readPid(lockPath: string): number | null {
  try {
    const pid = Number.parseInt(fs.readFileSync(lockPath, 'utf8').trim(), 10)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Claim one dev-server slot per project root.
 * Stale locks are moved away atomically, but a live process is never
 * terminated and a newly-created lock cannot be unlinked by the cleanup of a
 * competing stale-lock recovery attempt.
 */
export function acquireDevServerLock(root: string): DevServerLock {
  const lockPath = path.join(root, '.boltdocs', 'dev-server.lock')
  fs.mkdirSync(path.dirname(lockPath), { recursive: true })

  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx')
      fs.writeFileSync(fd, `${process.pid}\n`)
      fs.closeSync(fd)
      let released = false
      return {
        release() {
          if (released) return
          released = true
          try {
            if (readPid(lockPath) === process.pid) fs.unlinkSync(lockPath)
          } catch {
            // Cleanup is best effort during process shutdown.
          }
        },
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const ownerPid = readPid(lockPath)
      if (ownerPid && isProcessAlive(ownerPid)) {
        throw new Error(
          `A Boltdocs dev server is already running for this project (pid ${ownerPid})`,
        )
      }

      // Rename, rather than unlink, the stale entry. Rename is atomic: if a
      // competing process replaced the lock, this operation either moves the
      // entry we observed or fails and the loop re-checks the new owner.
      const stalePath = `${lockPath}.stale-${process.pid}-${randomUUID()}`
      try {
        fs.renameSync(lockPath, stalePath)
        fs.unlinkSync(stalePath)
      } catch (recoveryError) {
        try {
          if (fs.existsSync(stalePath)) fs.unlinkSync(stalePath)
        } catch {
          // Best effort; the next acquisition attempt will report ownership.
        }
        if ((recoveryError as NodeJS.ErrnoException).code === 'ENOENT') {
          continue
        }
        throw new Error(
          `Could not recover stale Boltdocs dev lock: ${lockPath}`,
        )
      }
    }
  }
}
