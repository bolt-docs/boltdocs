import { describe, it, expect } from 'vitest'
import { parseChangelog } from '../../packages/core/src/node/changelog/parser'
import {
  detectParser,
  changesetsParser,
  keepAChangelogParser,
  semanticReleaseParser,
  standardVersionParser,
} from '../../packages/core/src/node/changelog/parsers'

describe('Changelog Parser (Basic)', () => {
  it('should parse basic version', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Minor Changes\n\n- New feature added\n- Another feature\n`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('1.0.0')
    expect(versions[0].type).toBe('minor')
    expect(versions[0].changes).toHaveLength(2)
  })

  it('should parse version with date', () => {
    const content = `# Changelog\n\n## 2.0.0 (2024-01-15)\n\n### Patch Changes\n\n- Bug fix\n`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('2.0.0')
    expect(versions[0].date).toBe('2024-01-15')
    expect(versions[0].type).toBe('patch')
  })

  it('should detect major version', () => {
    const content = `# Changelog\n\n## 3.0.0\n\n### Major Changes\n\n- Breaking change\n`
    const versions = parseChangelog(content)
    expect(versions[0].type).toBe('major')
  })

  it('should parse multiple versions', () => {
    const content = `# Changelog\n\n## 2.0.0\n\n### Patch Changes\n\n- fix 1\n\n## 1.0.0\n\n### Minor Changes\n\n- feat 1\n`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(2)
    expect(versions[0].version).toBe('2.0.0')
    expect(versions[1].version).toBe('1.0.0')
  })

  it('should parse changes with author and commit', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Patch Changes\n\n- Fixed bug by [\`abc123\`](https://github.com) Thanks [@johndoe](https://github.com/johndoe)\n`
    const versions = parseChangelog(content)
    expect(versions[0].changes).toHaveLength(1)
    expect(versions[0].changes[0].author).toBe('johndoe')
    expect(versions[0].changes[0].commit).toBe('abc123')
  })

  it('should categorize feat type correctly', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Minor Changes\n\n- New feature\n`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('feat')
  })

  it('should categorize fix type correctly', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Patch Changes\n\n- Fixed bug\n`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('fix')
  })

  it('should return empty array for no versions', () => {
    const content = `# Changelog\n\nNo version here\n`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(0)
  })

  it('should parse real changelog format', () => {
    const content = `# boltdocs\n\n## 2.6.2\n\n### Patch Changes\n\n- [\`2960c55\`](https://github.com/bolt-docs/boltdocs/commit/2960c5523040723f2389568b5e72866875617789) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared bug collision pages & navigation\n\n## 2.6.0\n\n### Minor Changes\n\n- [\`6a6d829\`](https://github.com/bolt-docs/boltdocs/commit/6a6d82941328c1f2c016781d8d0f004d3a890237) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: new engine ssg\n`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(2)
    expect(versions[0].version).toBe('2.6.2')
    expect(versions[0].type).toBe('patch')
    expect(versions[1].version).toBe('2.6.0')
    expect(versions[1].type).toBe('minor')
  })

  it('should parse performance changes', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Performance Improvements\n\n- Optimized rendering\n`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('perf')
  })

  it('should parse documentation changes', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Documentation\n\n- Updated readme\n`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('docs')
  })

  it('should parse chore changes', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Chores\n\n- Updated dependencies\n`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].type).toBe('chore')
  })

  it('should handle version without change sections', () => {
    const content = `# Changelog\n\n## 1.0.0\n\nJust a version with no changes\n`
    const versions = parseChangelog(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].changes).toHaveLength(0)
  })

  it('should handle multiple changes in same section', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Minor Changes\n\n- Feature one\n- Feature two\n- Feature three\n`
    const versions = parseChangelog(content)
    expect(versions[0].changes).toHaveLength(3)
  })

  it('should preserve change message without prefix', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Patch Changes\n\n- Fixed critical bug\n`
    const versions = parseChangelog(content)
    expect(versions[0].changes[0].message).toBe('Fixed critical bug')
  })

  it('should handle versions with v prefix in source', () => {
    const content = `# Changelog\n\n## v1.0.0\n\n### Minor Changes\n\n- Initial release\n`
    const versions = parseChangelog(content)
    expect(versions[0].version).toBe('1.0.0')
  })
})

describe('Changelog Auto-Detection', () => {
  it('should detect keep-a-changelog format', () => {
    const content = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n## [1.0.0] - 2024-01-01\n\n### Added\n\n- New feature\n\n### Fixed\n\n- Bug fix\n`
    const { name } = detectParser(content)
    expect(name).toBe('keep-a-changelog')
  })

  it('should detect semantic-release format', () => {
    const content = `## [2.0.0](https://github.com/test) (2024-01-01)\n\n### Features\n\n- **auth:** add login feature\n\n### Bug Fixes\n\n- Fix login issue\n`
    const { name } = detectParser(content)
    expect(name).toBe('semantic-release')
  })

  it('should detect standard-version format', () => {
    const content = `## 1.0.0 (2024-01-01)\n\n### Features\n\n- New feature\n\n### Bug Fixes\n\n- Bug fix\n`
    const { name } = detectParser(content)
    expect(name).toBe('standard-version')
  })

  it('should detect changesets format', () => {
    const content = `# Changelog\n\n## 1.0.0\n\n### Minor Changes\n\n- New feature\n\n### Patch Changes\n\n- Bug fix\n`
    const { name } = detectParser(content)
    expect(name).toBe('changesets')
  })

  it('should fallback to changesets for unknown format', () => {
    const content = `# Changelog\n\n## Version 1.0.0\n\nSome random changelog content\n`
    const { name } = detectParser(content)
    expect(name).toBe('changesets (fallback)')
  })
})

describe('Keep a Changelog Parser', () => {
  it('should parse keep-a-changelog format', () => {
    const content = `# Changelog\n\n## [1.0.0] - 2024-01-15\n\n### Added\n\n- New feature added\n\n### Fixed\n\n- Bug fixed\n\n### Changed\n\n- Something changed\n`
    const versions = keepAChangelogParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('1.0.0')
    expect(versions[0].date).toBe('2024-01-15')
    expect(versions[0].changes).toHaveLength(3)
  })

  it('should detect unreleased section', () => {
    const content = `# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Work in progress\n`
    const versions = keepAChangelogParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('unreleased')
  })

  it('should categorize changes correctly', () => {
    const content = `# Changelog\n\n## [1.0.0] - 2024-01-01\n\n### Added\n\n- Feature\n\n### Fixed\n\n- Fix\n\n### Removed\n\n- Removed item\n`
    const versions = keepAChangelogParser.parse(content)
    expect(versions[0].changes[0].type).toBe('feat')
    expect(versions[0].changes[1].type).toBe('fix')
    expect(versions[0].changes[2].type).toBe('fix')
  })

  it('should detect keep-a-changelog', () => {
    const content = `# Changelog\n\n## [1.0.0] - 2024-01-01\n\n### Added\n\n- Feature\n`
    expect(keepAChangelogParser.detect(content)).toBe(true)
  })
})

describe('Semantic Release Parser', () => {
  it('should parse semantic-release format', () => {
    const content = `## [2.0.0](https://github.com/test) (2024-01-01)\n\n### Features\n\n- **auth:** new login feature\n\n### Bug Fixes\n\n- Fixed authentication issue\n`
    const versions = semanticReleaseParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('2.0.0')
    expect(versions[0].date).toBe('2024-01-01')
    expect(versions[0].changes).toHaveLength(2)
  })

  it('should handle BREAKING CHANGES', () => {
    const content = `## [3.0.0](https://github.com/test) (2024-01-01)\n\n### BREAKING CHANGES\n\n- API redesigned\n\n### Features\n\n- New feature\n`
    const versions = semanticReleaseParser.parse(content)
    expect(versions[0].type).toBe('major')
  })

  it('should detect semantic-release', () => {
    const content = `## [1.0.0](https://github.com) (2024-01-01)\n\n### Features\n\n- Feature\n`
    expect(semanticReleaseParser.detect(content)).toBe(true)
  })
})

describe('Standard Version Parser', () => {
  it('should parse standard-version format', () => {
    const content = `## 1.0.0 (2024-01-01)\n\n### Features\n\n- New feature\n\n### Bug Fixes\n\n- Fixed bug\n`
    const versions = standardVersionParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('1.0.0')
    expect(versions[0].date).toBe('2024-01-01')
  })

  it('should detect standard-version', () => {
    const content = `## 1.0.0 (2024-01-01)\n\n### Features\n\n- Feature\n`
    expect(standardVersionParser.detect(content)).toBe(true)
  })
})

describe('Changesets Parser', () => {
  it('should parse changesets format', () => {
    const content = `## 2.0.0\n\n### Minor Changes\n\n- New feature\n\n### Patch Changes\n\n- Bug fix\n`
    const versions = changesetsParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe('2.0.0')
    expect(versions[0].type).toBe('minor')
  })

  it('should detect changesets', () => {
    const content = `## 1.0.0\n\n### Minor Changes\n\n- Feature\n`
    expect(changesetsParser.detect(content)).toBe(true)
  })

  it('should handle v prefix', () => {
    const content = `## v1.0.0\n\n### Minor Changes\n\n- Feature\n`
    const versions = changesetsParser.parse(content)
    expect(versions[0].version).toBe('1.0.0')
  })
})

describe('Edge Cases', () => {
  it('should handle empty changelog', () => {
    const content = `# Changelog\n\nNo versions here\n`
    const { parser } = detectParser(content)
    const versions = parser.parse(content)
    expect(versions).toHaveLength(0)
  })

  it('should handle changelog without dates', () => {
    const content = `## 1.0.0\n\n### Minor Changes\n\n- Feature\n`
    const versions = changesetsParser.parse(content)
    expect(versions).toHaveLength(1)
    expect(versions[0].date).toBeUndefined()
  })

  it('should handle version with pre-release tag', () => {
    const content = `## [2.0.0-beta.1] - 2024-01-01\n\n### Added\n\n- Beta feature\n`
    const versions = keepAChangelogParser.parse(content)
    expect(versions[0].version).toBe('2.0.0-beta.1')
  })
})
