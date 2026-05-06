import { describe, it, expect } from 'vitest'
import {
  detectParser,
  changesetsParser,
  keepAChangelogParser,
  semanticReleaseParser,
  standardVersionParser,
} from '../packages/core/src/node/changelog/parsers'

describe('Changelog Auto-Detection', () => {
  it('should detect keep-a-changelog format', () => {
    const content = `# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2024-01-01

### Added

- New feature

### Fixed

- Bug fix
`
    const { name } = detectParser(content)
    expect(name).toBe('keep-a-changelog')
  })

  it('should detect semantic-release format', () => {
    const content = `## [2.0.0](https://github.com/test) (2024-01-01)

### Features

- **auth:** add login feature

### Bug Fixes

- Fix login issue
`
    const { name } = detectParser(content)
    expect(name).toBe('semantic-release')
  })

  it('should detect standard-version format', () => {
    const content = `## 1.0.0 (2024-01-01)

### Features

- New feature

### Bug Fixes

- Bug fix
`
    const { name } = detectParser(content)
    expect(name).toBe('standard-version')
  })

  it('should detect changesets format', () => {
    const content = `# Changelog

## 1.0.0

### Minor Changes

- New feature

### Patch Changes

- Bug fix
`
    const { name } = detectParser(content)
    expect(name).toBe('changesets')
  })

  it('should fallback to changesets for unknown format', () => {
    const content = `# Changelog

## Version 1.0.0

Some random changelog content
`
    const { name } = detectParser(content)
    expect(name).toBe('changesets (fallback)')
  })
})

describe('Keep a Changelog Parser', () => {
  it('should parse keep-a-changelog format', () => {
    const content = `# Changelog

## [1.0.0] - 2024-01-15

### Added

- New feature added

### Fixed

- Bug fixed

### Changed

- Something changed
`
    const versions = keepAChangelogParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('1.0.0')
    expect(versions[0].date).toBe('2024-01-15')
    expect(versions[0].changes).toHaveLength(3)
  })

  it('should detect unreleased section', () => {
    const content = `# Changelog

## [Unreleased]

### Added

- Work in progress
`
    const versions = keepAChangelogParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('unreleased')
  })

  it('should categorize changes correctly', () => {
    const content = `# Changelog

## [1.0.0] - 2024-01-01

### Added

- Feature

### Fixed

- Fix

### Removed

- Removed item
`
    const versions = keepAChangelogParser.parse(content)
    expect(versions[0].changes[0].type).toBe('feat')
    expect(versions[0].changes[1].type).toBe('fix')
    expect(versions[0].changes[2].type).toBe('fix')
  })

  it('should detect keep-a-changelog', () => {
    const content = `# Changelog

## [1.0.0] - 2024-01-01

### Added

- Feature
`
    expect(keepAChangelogParser.detect(content)).toBe(true)
  })
})

describe('Semantic Release Parser', () => {
  it('should parse semantic-release format', () => {
    const content = `## [2.0.0](https://github.com/test) (2024-01-01)

### Features

- **auth:** new login feature

### Bug Fixes

- Fixed authentication issue
`
    const versions = semanticReleaseParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('2.0.0')
    expect(versions[0].date).toBe('2024-01-01')
    expect(versions[0].changes).toHaveLength(2)
  })

  it('should handle BREAKING CHANGES', () => {
    const content = `## [3.0.0](https://github.com/test) (2024-01-01)

### BREAKING CHANGES

- API redesigned

### Features

- New feature
`
    const versions = semanticReleaseParser.parse(content)
    expect(versions[0].type).toBe('major')
  })

  it('should detect semantic-release', () => {
    const content = `## [1.0.0](https://github.com) (2024-01-01)

### Features

- Feature
`
    expect(semanticReleaseParser.detect(content)).toBe(true)
  })
})

describe('Standard Version Parser', () => {
  it('should parse standard-version format', () => {
    const content = `## 1.0.0 (2024-01-01)

### Features

- New feature

### Bug Fixes

- Fixed bug
`
    const versions = standardVersionParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('1.0.0')
    expect(versions[0].date).toBe('2024-01-01')
  })

  it('should detect standard-version', () => {
    const content = `## 1.0.0 (2024-01-01)

### Features

- Feature
`
    expect(standardVersionParser.detect(content)).toBe(true)
  })
})

describe('Changesets Parser', () => {
  it('should parse changesets format', () => {
    const content = `## 2.0.0

### Minor Changes

- New feature

### Patch Changes

- Bug fix
`
    const versions = changesetsParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('2.0.0')
    expect(versions[0].type).toBe('minor')
  })

  it('should detect changesets', () => {
    const content = `## 1.0.0

### Minor Changes

- Feature
`
    expect(changesetsParser.detect(content)).toBe(true)
  })

  it('should handle v prefix', () => {
    const content = `## v1.0.0

### Minor Changes

- Feature
`
    const versions = changesetsParser.parse(content)
    expect(versions[0].version).toBe('1.0.0')
  })
})

describe('Edge Cases', () => {
  it('should handle empty changelog', () => {
    const content = `# Changelog

No versions here
`
    const { parser } = detectParser(content)
    const versions = parser.parse(content)
    expect(versions).toHaveLength(0)
  })

  it('should handle changelog without dates', () => {
    const content = `## 1.0.0

### Minor Changes

- Feature
`
    const versions = changesetsParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].date).toBeUndefined()
  })

  it('should handle version with pre-release tag', () => {
    const content = `## [2.0.0-beta.1] - 2024-01-01

### Added

- Beta feature
`
    const versions = keepAChangelogParser.parse(content)
    expect(versions[0].version).toBe('2.0.0-beta.1')
  })
})