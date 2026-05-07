import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { generateChangelog } from '../packages/core/src/node/changelog/generator'

const TEST_OUTPUT_DIR = path.resolve('./tests/temp-changelog-output')

describe('Changelog Generator', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true })
    }
  })

  afterEach(() => {
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true })
    }
  })

  it('should generate changelog files', async () => {
    const testChangelog = path.resolve('./tests/fixtures/changelog-test.md')
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog

## 2.0.0

### Minor Changes

- New feature

## 1.0.0

### Patch Changes

- Bug fix
`,
    )

    await generateChangelog(testChangelog, { output: TEST_OUTPUT_DIR })

    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, '1.v2.0.0.md'))).toBe(true)
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, '2.v1.0.0.md'))).toBe(true)
  })

  it('should generate files with correct content', async () => {
    const testChangelog = path.resolve('./tests/fixtures/changelog-test2.md')
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog

## 1.0.0

### Minor Changes

- New feature added
`,
    )

    await generateChangelog(testChangelog, { output: TEST_OUTPUT_DIR })

    const content = fs.readFileSync(
      path.join(TEST_OUTPUT_DIR, '1.v1.0.0.md'),
      'utf-8',
    )

    expect(content).toContain('title: v1.0.0')
    expect(content).toContain('badge: "Minor"')
    expect(content).toContain('description: Changelog version 1.0.0')
    expect(content).toContain('# Changelog v1.0.0')
    expect(content).toContain('## Feature')
    expect(content).toContain('- New feature added')
  })

  it('should use custom title', async () => {
    const testChangelog = path.resolve('./tests/fixtures/changelog-test3.md')
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog

## 1.0.0

### Minor Changes

- Test
`,
    )

    await generateChangelog(testChangelog, {
      output: TEST_OUTPUT_DIR,
      title: 'Release Notes',
    })

    const content = fs.readFileSync(
      path.join(TEST_OUTPUT_DIR, '1.v1.0.0.md'),
      'utf-8',
    )
    expect(content).toContain('# Release Notes v1.0.0')
  })

  it('should handle version with date', async () => {
    const testChangelog = path.resolve('./tests/fixtures/changelog-test4.md')
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog

## 1.0.0 (2024-01-15)

### Patch Changes

- Fixed bug
`,
    )

    await generateChangelog(testChangelog, { output: TEST_OUTPUT_DIR })

    const content = fs.readFileSync(
      path.join(TEST_OUTPUT_DIR, '1.v1.0.0.md'),
      'utf-8',
    )
    expect(content).toContain(
      'description: Changelog version 1.0.0 (2024-01-15)',
    )
    expect(content).toContain('**Released:** 2024-01-15')
  })

  it('should handle multiple change types', async () => {
    const testChangelog = path.resolve('./tests/fixtures/changelog-test5.md')
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog

## 1.0.0

### Minor Changes

- New feature

### Patch Changes

- Bug fix

### Performance Improvements

- Speed improvement

## 0.9.0

### Patch Changes

- Another fix
`,
    )

    await generateChangelog(testChangelog, { output: TEST_OUTPUT_DIR })

    const content = fs.readFileSync(
      path.join(TEST_OUTPUT_DIR, '1.v1.0.0.md'),
      'utf-8',
    )
    expect(content).toContain('## Feature')
    expect(content).toContain('## Bug Fix')
    expect(content).toContain('## Performance')
  })

  it('should include author and commit when available', async () => {
    const testChangelog = path.resolve('./tests/fixtures/changelog-test6.md')
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog

## 1.0.0

### Patch Changes

- Fix issue by [\`abc123\`](https://github.com/test) Thanks [@developer](https://github.com/developer)
`,
    )

    await generateChangelog(testChangelog, { output: TEST_OUTPUT_DIR })

    const content = fs.readFileSync(
      path.join(TEST_OUTPUT_DIR, '1.v1.0.0.md'),
      'utf-8',
    )
    expect(content).toContain(
      '**Author:** [@developer](https://github.com/developer)',
    )
    expect(content).toContain('**Commit:** [`abc123`](https://github.com/test)')
  })

  it('should throw error for non-existent file', async () => {
    await expect(
      generateChangelog('./non-existent-file.md', { output: TEST_OUTPUT_DIR }),
    ).rejects.toThrow('Changelog file not found')
  })
})
