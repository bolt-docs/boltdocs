import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'

function findProjectRoot(startDir: string): string {
  let dir = startDir
  while (dir && dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, '.git')) ||
      fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))
    ) {
      return dir
    }
    dir = path.dirname(dir)
  }

  dir = startDir
  let topmost = startDir
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      topmost = dir
    }
    dir = path.dirname(dir)
  }
  return topmost
}

let projectRoot = findProjectRoot(process.cwd())
let patchEnabled = true

export function disableFsPatch(): void {
  patchEnabled = false
}

export function enableFsPatch(): void {
  patchEnabled = true
}

export function setProjectRoot(root: string): void {
  projectRoot = path.resolve(root)
}

export function checkPath(targetPath: unknown): void {
  if (!patchEnabled || !targetPath) return

  let pStr: string
  if (typeof targetPath === 'string') {
    pStr = targetPath
  } else if (targetPath instanceof URL) {
    if (targetPath.protocol !== 'file:') return
    pStr = targetPath.pathname
  } else if (Buffer.isBuffer(targetPath)) {
    pStr = targetPath.toString()
  } else {
    return
  }

  const resolved = path.resolve(projectRoot, pStr)
  const relative = path.relative(projectRoot, resolved)

  const isOutside = relative.startsWith('..') || path.isAbsolute(relative)

  const parts = resolved.split(path.sep)
  const touchesEnv = parts.some((part) => part.startsWith('.env'))

  const touchesNodeModules = parts.some((part, idx) => {
    if (part === 'node_modules') {
      const next = parts[idx + 1]
      return !next || !next.startsWith('.')
    }
    return false
  })

  if (isOutside || touchesEnv || touchesNodeModules) {
    throw new Error(
      `[Boltdocs Security] Write/delete operation blocked on path: "${resolved}". Modifications are restricted to the project root, and cannot access .env or non-cache node_modules folders.`,
    )
  }
}

function isWriteFlag(flags: unknown): boolean {
  if (flags === undefined || flags === null) return false
  if (typeof flags === 'number') {
    return flags !== 0
  }
  if (typeof flags === 'string') {
    return flags.includes('w') || flags.includes('a') || flags.includes('+')
  }
  return true
}

export function applyFsPatch(): void {
  const originalWriteFile = fs.writeFile
  fs.writeFile = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => (cb as Function)(err))
        return
      }
      throw err
    }
    return (originalWriteFile as any).call(fs, path, ...args)
  }) as any

  const originalWriteFileSync = fs.writeFileSync
  fs.writeFileSync = (path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return (originalWriteFileSync as any).call(fs, path, ...args)
  }

  const originalRm = fs.rm
  fs.rm = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => (cb as Function)(err))
        return
      }
      throw err
    }
    return (originalRm as any).call(fs, path, ...args)
  }) as any

  const originalRmSync = fs.rmSync
  fs.rmSync = (path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return (originalRmSync as any).call(fs, path, ...args)
  }

  const originalUnlink = fs.unlink
  fs.unlink = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => (cb as Function)(err))
        return
      }
      throw err
    }
    return (originalUnlink as any).call(fs, path, ...args)
  }) as any

  const originalUnlinkSync = fs.unlinkSync
  fs.unlinkSync = (path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return (originalUnlinkSync as any).call(fs, path, ...args)
  }

  const originalMkdir = fs.mkdir
  fs.mkdir = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => (cb as Function)(err))
        return
      }
      throw err
    }
    return (originalMkdir as any).call(fs, path, ...args)
  }) as any

  const originalMkdirSync = fs.mkdirSync
  fs.mkdirSync = (path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return (originalMkdirSync as any).call(fs, path, ...args)
  }

  const originalRmdir = fs.rmdir
  fs.rmdir = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => (cb as Function)(err))
        return
      }
      throw err
    }
    return (originalRmdir as any).call(fs, path, ...args)
  }) as any

  const originalRmdirSync = fs.rmdirSync
  fs.rmdirSync = (path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return (originalRmdirSync as any).call(fs, path, ...args)
  }

  const originalAppendFile = fs.appendFile
  fs.appendFile = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => (cb as Function)(err))
        return
      }
      throw err
    }
    return (originalAppendFile as any).call(fs, path, ...args)
  }) as any

  const originalAppendFileSync = fs.appendFileSync
  fs.appendFileSync = (path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return (originalAppendFileSync as any).call(fs, path, ...args)
  }

  const originalCopyFile = fs.copyFile
  fs.copyFile = ((src: unknown, dest: unknown, ...args: unknown[]) => {
    try {
      checkPath(src)
      checkPath(dest)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => (cb as Function)(err))
        return
      }
      throw err
    }
    return (originalCopyFile as any).call(fs, src, dest, ...args)
  }) as any

  const originalCopyFileSync = fs.copyFileSync
  fs.copyFileSync = (src: unknown, dest: unknown, ...args: unknown[]) => {
    checkPath(src)
    checkPath(dest)
    return (originalCopyFileSync as any).call(fs, src, dest, ...args)
  }

  const originalRename = fs.rename
  fs.rename = ((oldPath: unknown, newPath: unknown, ...args: unknown[]) => {
    try {
      checkPath(oldPath)
      checkPath(newPath)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => (cb as Function)(err))
        return
      }
      throw err
    }
    return (originalRename as any).call(fs, oldPath, newPath, ...args)
  }) as any

  const originalRenameSync = fs.renameSync
  fs.renameSync = (oldPath: unknown, newPath: unknown, ...args: unknown[]) => {
    checkPath(oldPath)
    checkPath(newPath)
    return (originalRenameSync as any).call(fs, oldPath, newPath, ...args)
  }

  const originalCreateWriteStream = fs.createWriteStream
  fs.createWriteStream = (path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return (originalCreateWriteStream as any).call(fs, path, ...args)
  }

  const originalOpen = fs.open
  fs.open = ((path: unknown, flags: unknown, ...args: unknown[]) => {
    const actualFlags = typeof flags === 'function' ? undefined : flags
    if (isWriteFlag(actualFlags)) {
      try {
        checkPath(path)
      } catch (err) {
        const cb = args[args.length - 1]
        const actualCb =
          typeof flags === 'function'
            ? flags
            : typeof cb === 'function'
              ? cb
              : undefined
        if (actualCb) {
          process.nextTick(() => (actualCb as Function)(err))
          return
        }
        throw err
      }
    }
    return (originalOpen as any).call(fs, path, flags, ...args)
  }) as any

  const originalOpenSync = fs.openSync
  fs.openSync = (path: unknown, flags: unknown, ...args: unknown[]) => {
    if (isWriteFlag(flags)) {
      checkPath(path)
    }
    return (originalOpenSync as any).call(fs, path, flags, ...args)
  }

  const patchPromises = (promisesObj: any) => {
    if (!promisesObj) return

    const originalPromisesWriteFile = promisesObj.writeFile
    if (originalPromisesWriteFile) {
      promisesObj.writeFile = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return originalPromisesWriteFile.call(promisesObj, path, ...args)
      }
    }

    const originalPromisesRm = promisesObj.rm
    if (originalPromisesRm) {
      promisesObj.rm = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return originalPromisesRm.call(promisesObj, path, ...args)
      }
    }

    const originalPromisesMkdir = promisesObj.mkdir
    if (originalPromisesMkdir) {
      promisesObj.mkdir = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return originalPromisesMkdir.call(promisesObj, path, ...args)
      }
    }

    const originalPromisesRmdir = promisesObj.rmdir
    if (originalPromisesRmdir) {
      promisesObj.rmdir = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return originalPromisesRmdir.call(promisesObj, path, ...args)
      }
    }

    const originalPromisesUnlink = promisesObj.unlink
    if (originalPromisesUnlink) {
      promisesObj.unlink = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return originalPromisesUnlink.call(promisesObj, path, ...args)
      }
    }

    const originalPromisesAppendFile = promisesObj.appendFile
    if (originalPromisesAppendFile) {
      promisesObj.appendFile = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return originalPromisesAppendFile.call(promisesObj, path, ...args)
      }
    }

    const originalPromisesCopyFile = promisesObj.copyFile
    if (originalPromisesCopyFile) {
      promisesObj.copyFile = async (
        src: unknown,
        dest: unknown,
        ...args: unknown[]
      ) => {
        checkPath(src)
        checkPath(dest)
        return originalPromisesCopyFile.call(promisesObj, src, dest, ...args)
      }
    }

    const originalPromisesRename = promisesObj.rename
    if (originalPromisesRename) {
      promisesObj.rename = async (
        oldPath: unknown,
        newPath: unknown,
        ...args: unknown[]
      ) => {
        checkPath(oldPath)
        checkPath(newPath)
        return originalPromisesRename.call(
          promisesObj,
          oldPath,
          newPath,
          ...args,
        )
      }
    }

    const originalPromisesOpen = promisesObj.open
    if (originalPromisesOpen) {
      promisesObj.open = async (
        path: unknown,
        flags: unknown,
        ...args: unknown[]
      ) => {
        if (isWriteFlag(flags)) {
          checkPath(path)
        }
        return originalPromisesOpen.call(promisesObj, path, flags, ...args)
      }
    }
  }

  patchPromises(fs.promises)
  patchPromises(fsPromises)
}
