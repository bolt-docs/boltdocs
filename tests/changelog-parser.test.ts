import { describe, it, expect } from 'vitest'
import { parseChangelog } from '../packages/core/src/node/changelog/parser'

describe('Changelog Parser', () => {
  it('should parse basic version', () => {
    const content = `# Changelog

## 1.0.0

### Minor Changes

- New feature added
- Another feature
`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('1.0.0')
    expect(versions[0].type).toBe('minor')
    expect(versions[0].changes).toHaveLength(2)
  })

  it('should parse version with date', () => {
    const content = `# Changelog

## 2.0.0 (2024-01-15)

### Patch Changes

- Bug fix
`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('2.0.0')
    expect(versions[0].date).toBe('2024-01-15')
    expect(versions[0].type).toBe('patch')
  })

  it('should detect major version', () => {
    const content = `# Changelog

## 3.0.0

### Major Changes

- Breaking change
`
    const versions = parseChangelog(content)
    expect(versions[0].type).toBe('major')
  })

  it('should parse multiple versions', () => {
    const content = `# Changelog

## 2.0.0

### Patch Changes

- fix 1

## 1.0.0

### Minor Changes

- feat 1
`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(2)
    expect(versions[0].version).toBe('2.0.0')
    expect(versions[1].version).toBe('1.0.0')
  })

  it('should parse changes with author and commit', () => {
    const content = `# Changelog

## 1.0.0

### Patch Changes

- Fixed bug by [\`abc123\`](https://github.com) Thanks [@johndoe](https://github.com/johndoe)
`
    const versions = parseChangelog(content)
    expect(versions[0].changes).toHaveLength(1)
    expect(versions[0].changes[0].author).toBe('johndoe')
    expect(versions[0].changes[0].commit).toBe('abc123')
  })

  it('should categorize feat type correctly', () => {
    const content = `# Changelog

## 1.0.0

### Minor Changes

- New feature
`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('feat')
  })

  it('should categorize fix type correctly', () => {
    const content = `# Changelog

## 1.0.0

### Patch Changes

- Fixed bug
`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('fix')
  })

  it('should return empty array for no versions', () => {
    const content = `# Changelog

No version here
`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(0)
  })

  it('should parse real changelog format', () => {
    const content = `# boltdocs

## 2.6.2

### Patch Changes

- [\`2960c55\`](https://github.com/bolt-docs/boltdocs/commit/2960c5523040723f2389568b5e72866875617789) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared bug collision pages & navigation

## 2.6.0

### Minor Changes

- [\`6a6d829\`](https://github.com/bolt-docs/boltdocs/commit/6a6d82941328c1f2c016781d8d0f004d3a890237) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: new engine ssg
`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(2)
    expect(versions[0].version).toBe('2.6.2')
    expect(versions[0].type).toBe('patch')
    expect(versions[1].version).toBe('2.6.0')
    expect(versions[1].type).toBe('minor')
  })

  it('should parse performance changes', () => {
    const content = `# Changelog

## 1.0.0

### Performance Improvements

- Optimized rendering
`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('perf')
  })

  it('should parse documentation changes', () => {
    const content = `# Changelog

## 1.0.0

### Documentation

- Updated readme
`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('docs')
  })

  it('should parse chore changes', () => {
    const content = `# Changelog

## 1.0.0

### Chores

- Updated dependencies
`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('chore')
  })

  it('should handle version without change sections', () => {
    const content = `# Changelog

## 1.0.0

Just a version with no changes
`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].changes).toHaveLength(0)
  })

  it('should handle multiple changes in same section', () => {
    const content = `# Changelog

## 1.0.0

### Minor Changes

- Feature one
- Feature two
- Feature three
`
    const versions = parseChangelog(content)
    expect(versions[0].changes).toHaveLength(3)
  })

  it('should preserve change message without prefix', () => {
    const content = `# Changelog

## 1.0.0

### Patch Changes

- Fixed critical bug
`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].message).toBe('Fixed critical bug')
  })

  it('should handle versions with v prefix in source', () => {
    const content = `# Changelog

## v1.0.0

### Minor Changes

- Initial release
`
    const versions = parseChangelog(content)
    expect(versions[0].version).toBe('1.0.0')
  })
})