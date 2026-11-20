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

/** Any function shape accepted by the fs patch wrappers (overload-tolerant). */
type PatchableMethod = (...args: never[]) => unknown

interface PromiseFsPatchTarget {
  writeFile?: PatchableMethod
  rm?: PatchableMethod
  mkdir?: PatchableMethod
  rmdir?: PatchableMethod
  unlink?: PatchableMethod
  appendFile?: PatchableMethod
  copyFile?: PatchableMethod
  rename?: PatchableMethod
  open?: PatchableMethod
}

function isCallback(value: unknown): value is (err: unknown) => void {
  return typeof value === 'function'
}

/** Invoke a captured fs method without unsafe casts on its overload set. */
function invokeOriginal(
  fn: unknown,
  thisArg: object,
  args: readonly unknown[],
): unknown {
  return Reflect.apply(fn as Function, thisArg, args as never[])
}

let patchInstalled = false

export function applyFsPatch(): void {
  // Wrapping twice would stack two layers of guard, and the outer layer's
  // captured `projectRoot` would shadow a later `setProjectRoot`. Make it
  // idempotent: installing the patch is a statement of intent, not a counter.
  if (patchInstalled) {
    patchEnabled = true
    return
  }
  patchInstalled = true

  const originalWriteFile = fs.writeFile
  fs.writeFile = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => cb(err))
        return
      }
      throw err
    }
    return invokeOriginal(originalWriteFile, fs, [path, ...args])
  }) as typeof fs.writeFile

  const originalWriteFileSync = fs.writeFileSync
  fs.writeFileSync = ((path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return invokeOriginal(originalWriteFileSync, fs, [path, ...args])
  }) as typeof fs.writeFileSync

  const originalRm = fs.rm
  fs.rm = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => cb(err))
        return
      }
      throw err
    }
    return invokeOriginal(originalRm, fs, [path, ...args])
  }) as typeof fs.rm

  const originalRmSync = fs.rmSync
  fs.rmSync = ((path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return invokeOriginal(originalRmSync, fs, [path, ...args])
  }) as typeof fs.rmSync

  const originalUnlink = fs.unlink
  fs.unlink = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => cb(err))
        return
      }
      throw err
    }
    return invokeOriginal(originalUnlink, fs, [path, ...args])
  }) as typeof fs.unlink

  const originalUnlinkSync = fs.unlinkSync
  fs.unlinkSync = ((path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return invokeOriginal(originalUnlinkSync, fs, [path, ...args])
  }) as typeof fs.unlinkSync

  const originalMkdir = fs.mkdir
  fs.mkdir = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => cb(err))
        return
      }
      throw err
    }
    return invokeOriginal(originalMkdir, fs, [path, ...args])
  }) as typeof fs.mkdir

  const originalMkdirSync = fs.mkdirSync
  fs.mkdirSync = ((path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return invokeOriginal(originalMkdirSync, fs, [path, ...args])
  }) as typeof fs.mkdirSync

  const originalRmdir = fs.rmdir
  fs.rmdir = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => cb(err))
        return
      }
      throw err
    }
    return invokeOriginal(originalRmdir, fs, [path, ...args])
  }) as typeof fs.rmdir

  const originalRmdirSync = fs.rmdirSync
  fs.rmdirSync = ((path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return invokeOriginal(originalRmdirSync, fs, [path, ...args])
  }) as typeof fs.rmdirSync

  const originalAppendFile = fs.appendFile
  fs.appendFile = ((path: unknown, ...args: unknown[]) => {
    try {
      checkPath(path)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => cb(err))
        return
      }
      throw err
    }
    return invokeOriginal(originalAppendFile, fs, [path, ...args])
  }) as typeof fs.appendFile

  const originalAppendFileSync = fs.appendFileSync
  fs.appendFileSync = ((path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return invokeOriginal(originalAppendFileSync, fs, [path, ...args])
  }) as typeof fs.appendFileSync

  const originalCopyFile = fs.copyFile
  fs.copyFile = ((src: unknown, dest: unknown, ...args: unknown[]) => {
    try {
      checkPath(src)
      checkPath(dest)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => cb(err))
        return
      }
      throw err
    }
    return invokeOriginal(originalCopyFile, fs, [src, dest, ...args])
  }) as typeof fs.copyFile

  const originalCopyFileSync = fs.copyFileSync
  fs.copyFileSync = ((src: unknown, dest: unknown, ...args: unknown[]) => {
    checkPath(src)
    checkPath(dest)
    return invokeOriginal(originalCopyFileSync, fs, [src, dest, ...args])
  }) as typeof fs.copyFileSync

  const originalRename = fs.rename
  fs.rename = ((oldPath: unknown, newPath: unknown, ...args: unknown[]) => {
    try {
      checkPath(oldPath)
      checkPath(newPath)
    } catch (err) {
      const cb = args[args.length - 1]
      if (typeof cb === 'function') {
        process.nextTick(() => cb(err))
        return
      }
      throw err
    }
    return invokeOriginal(originalRename, fs, [oldPath, newPath, ...args])
  }) as typeof fs.rename

  const originalRenameSync = fs.renameSync
  fs.renameSync = ((oldPath: unknown, newPath: unknown, ...args: unknown[]) => {
    checkPath(oldPath)
    checkPath(newPath)
    return invokeOriginal(originalRenameSync, fs, [oldPath, newPath, ...args])
  }) as typeof fs.renameSync

  const originalCreateWriteStream = fs.createWriteStream
  fs.createWriteStream = ((path: unknown, ...args: unknown[]) => {
    checkPath(path)
    return invokeOriginal(originalCreateWriteStream, fs, [path, ...args])
  }) as typeof fs.createWriteStream

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
          process.nextTick(() => actualCb(err))
          return
        }
        throw err
      }
    }
    return invokeOriginal(originalOpen, fs, [path, flags, ...args])
  }) as typeof fs.open

  const originalOpenSync = fs.openSync
  fs.openSync = ((path: unknown, flags: unknown, ...args: unknown[]) => {
    if (isWriteFlag(flags)) {
      checkPath(path)
    }
    return invokeOriginal(originalOpenSync, fs, [path, flags, ...args])
  }) as typeof fs.openSync

  const patchPromises = (promisesObj: PromiseFsPatchTarget) => {
    if (!promisesObj) return

    const originalPromisesWriteFile = promisesObj.writeFile
    if (originalPromisesWriteFile) {
      promisesObj.writeFile = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return invokeOriginal(originalPromisesWriteFile, promisesObj, [
          path,
          ...args,
        ])
      }
    }

    const originalPromisesRm = promisesObj.rm
    if (originalPromisesRm) {
      promisesObj.rm = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return invokeOriginal(originalPromisesRm, promisesObj, [path, ...args])
      }
    }

    const originalPromisesMkdir = promisesObj.mkdir
    if (originalPromisesMkdir) {
      promisesObj.mkdir = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return invokeOriginal(originalPromisesMkdir, promisesObj, [
          path,
          ...args,
        ])
      }
    }

    const originalPromisesRmdir = promisesObj.rmdir
    if (originalPromisesRmdir) {
      promisesObj.rmdir = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return invokeOriginal(originalPromisesRmdir, promisesObj, [
          path,
          ...args,
        ])
      }
    }

    const originalPromisesUnlink = promisesObj.unlink
    if (originalPromisesUnlink) {
      promisesObj.unlink = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return invokeOriginal(originalPromisesUnlink, promisesObj, [
          path,
          ...args,
        ])
      }
    }

    const originalPromisesAppendFile = promisesObj.appendFile
    if (originalPromisesAppendFile) {
      promisesObj.appendFile = async (path: unknown, ...args: unknown[]) => {
        checkPath(path)
        return invokeOriginal(originalPromisesAppendFile, promisesObj, [
          path,
          ...args,
        ])
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
        return invokeOriginal(originalPromisesCopyFile, promisesObj, [
          src,
          dest,
          ...args,
        ])
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
        return invokeOriginal(originalPromisesRename, promisesObj, [
          oldPath,
          newPath,
          ...args,
        ])
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
        return invokeOriginal(originalPromisesOpen, promisesObj, [
          path,
          flags,
          ...args,
        ])
      }
    }
  }

  patchPromises(fs.promises)
  patchPromises(fsPromises)
}
