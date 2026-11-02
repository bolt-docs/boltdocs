import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { generateChangelog } from '../../src/node/changelog/generator'

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
    const testChangelog = path.resolve(
      './tests/changelog/fixtures/changelog-test.md',
    )
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog\n\n## 2.0.0\n\n### Minor Changes\n\n- New feature\n\n## 1.0.0\n\n### Patch Changes\n\n- Bug fix\n`,
    )

    await generateChangelog(testChangelog, { output: TEST_OUTPUT_DIR })

    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, '1.v2.0.0.md'))).toBe(true)
  })

  it('should generate files with correct content', async () => {
    const testChangelog = path.resolve(
      './tests/changelog/fixtures/changelog-test2.md',
    )
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog\n\n## 1.0.0\n\n### Minor Changes\n\n- New feature added\n`,
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
    const testChangelog = path.resolve(
      './tests/changelog/fixtures/changelog-test3.md',
    )
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog\n\n## 1.0.0\n\n### Minor Changes\n\n- Test\n`,
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
    const testChangelog = path.resolve(
      './tests/changelog/fixtures/changelog-test4.md',
    )
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog\n\n## 1.0.0 (2024-01-15)\n\n### Patch Changes\n\n- Fixed bug\n`,
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
    const testChangelog = path.resolve(
      './tests/changelog/fixtures/changelog-test5.md',
    )
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog\n\n## 1.0.0\n\n### Minor Changes\n\n- New feature\n\n### Patch Changes\n\n- Bug fix\n\n### Performance Improvements\n\n- Speed improvement\n\n## 0.9.0\n\n### Patch Changes\n\n- Another fix\n`,
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
    const testChangelog = path.resolve(
      './tests/changelog/fixtures/changelog-test6.md',
    )
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog\n\n## 1.0.0\n\n### Patch Changes\n\n- Fix issue by [\`abc123\`](https://github.com/test) Thanks [@developer](https://github.com/developer)\n`,
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

  it('should escape MDX braces outside inline-code spans', async () => {
    const testChangelog = path.resolve(
      './tests/changelog/fixtures/changelog-test7.md',
    )
    fs.mkdirSync(path.dirname(testChangelog), { recursive: true })
    fs.writeFileSync(
      testChangelog,
      `# Changelog\n\n## 1.0.0\n\n### Patch Changes\n\n- ga4: { measurementId: 'G-XXXXX' },\n- \`drafts\` config: \`{ visible?: boolean, environments?: string[] }\`\n`,
    )

    await generateChangelog(testChangelog, { output: TEST_OUTPUT_DIR })

    const content = fs.readFileSync(
      path.join(TEST_OUTPUT_DIR, '1.v1.0.0.md'),
      'utf-8',
    )
    expect(content).toContain(`- ga4: \\{ measurementId: 'G-XXXXX' \\},`)
    expect(content).toContain(
      '`{ visible?: boolean, environments?: string[] }`',
    )
  })

  it('should throw error for non-existent file', async () => {
    await expect(
      generateChangelog('./non-existent-file.md', { output: TEST_OUTPUT_DIR }),
    ).rejects.toThrow('Changelog file not found')
  })
})
