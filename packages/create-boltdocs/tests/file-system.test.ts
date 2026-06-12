import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { copy, writeDir, writeFile } from '../src/utils/file-system'

describe('file-system utilities', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdocs-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should create directories recursively with writeDir', () => {
    const targetDir = path.join(tempDir, 'sub', 'nested', 'dir')
    writeDir(targetDir)
    expect(fs.existsSync(targetDir)).toBe(true)
    expect(fs.statSync(targetDir).isDirectory()).toBe(true)
  })

  it('should create directories and write files with writeFile', () => {
    const targetFile = path.join(tempDir, 'a', 'b', 'c.txt')
    writeFile(targetFile, 'content')
    expect(fs.existsSync(targetFile)).toBe(true)
    expect(fs.readFileSync(targetFile, 'utf-8')).toBe('content')
  })

  it('should copy files recursively and replace placeholders', () => {
    const srcDir = path.join(tempDir, 'src')
    const destDir = path.join(tempDir, 'dest')
    writeDir(srcDir)

    const testFile1 = path.join(srcDir, 'test.txt')
    const testFile2 = path.join(srcDir, 'nested', 'test2.md')

    writeFile(testFile1, 'Hello {{name}}! Welcome to {{title}}.')
    writeFile(testFile2, '# Docs for {{name}}')

    // Copy directory and replace placeholders
    copy(srcDir, destDir, { name: 'World', title: 'Boltdocs' })

    const copiedFile1 = path.join(destDir, 'test.txt')
    const copiedFile2 = path.join(destDir, 'nested', 'test2.md')

    expect(fs.existsSync(copiedFile1)).toBe(true)
    expect(fs.readFileSync(copiedFile1, 'utf-8')).toBe(
      'Hello World! Welcome to Boltdocs.',
    )

    expect(fs.existsSync(copiedFile2)).toBe(true)
    expect(fs.readFileSync(copiedFile2, 'utf-8')).toBe('# Docs for World')
  })
})
