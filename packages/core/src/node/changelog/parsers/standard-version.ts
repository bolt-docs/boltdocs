import type { ChangelogParser } from './base'
import type { ChangelogVersion, ChangelogChange } from '../../types'
import {
  normalizeVersion,
  extractAuthor,
  extractAuthorUrl,
  extractCommit,
  extractCommitUrl,
  extractMessage,
} from './base'

const STANDARD_VERSION_TYPES: Record<string, ChangelogChange['type']> = {
  features: 'feat',
  'breaking changes': 'feat',
  breaking: 'feat',
  'bug fixes': 'fix',
  fixes: 'fix',
  performance: 'perf',
  'build system': 'chore',
  builds: 'chore',
  tests: 'chore',
  chores: 'chore',
  documentation: 'docs',
  docs: 'docs',
  revert: 'fix',
  reverts: 'fix',
  refactor: 'refactor',
  'code refactoring': 'refactor',
}

function detectStandardVersion(content: string): boolean {
  const versionPattern = /^##\s+(\d+\.\d+\.\d+)\s*\((\d{4}-\d{2}-\d{2})\)/m
  const hasSimpleVersion = versionPattern.test(content)

  const typePattern =
    /^###\s+(Features|Bug Fixes|BREAKING CHANGES|Build System|Tests|Chores|Documentation)/m
  const hasConventionalTypes = typePattern.test(content)

  const hasBulletPoints = /^[*-]\s+/m.test(content)

  return hasSimpleVersion && hasConventionalTypes && hasBulletPoints
}

function parseStandardVersion(content: string): ChangelogVersion[] {
  const lines = content.split('\n')
  const versions: ChangelogVersion[] = []
  let currentVersion: ChangelogVersion | null = null
  let currentChangeType: string = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    const versionMatch = line.match(
      /^##\s+(\d+\.\d+\.\d+)\s*\((\d{4}-\d{2}-\d{2})\)/,
    )
    if (versionMatch) {
      if (currentVersion) {
        versions.push(currentVersion)
      }

      const version = normalizeVersion(versionMatch[1])
      let type: ChangelogVersion['type'] = 'patch'

      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        const section = lines[j].toLowerCase()
        if (section.includes('major') || section.includes('breaking')) {
          type = 'major'
          break
        }
        if (section.includes('minor') || section.includes('feat')) {
          type = 'minor'
        }
      }

      currentVersion = {
        version,
        type,
        date: versionMatch[2],
        changes: [],
      }
      currentChangeType = ''
      continue
    }

    const typeMatch = line.match(/^###\s+(.+)$/i)
    if (typeMatch) {
      currentChangeType = typeMatch[1].toLowerCase()
      continue
    }

    if ((line.startsWith('- ') || line.startsWith('* ')) && currentVersion) {
      const changeText = line.slice(2).trim()

      const changeType = STANDARD_VERSION_TYPES[currentChangeType] || 'other'

      const parsedChange: ChangelogChange = {
        type: changeType,
        message: extractMessage(changeText, changeType),
        author: extractAuthor(changeText),
        authorUrl: extractAuthorUrl(changeText),
        commit: extractCommit(changeText),
        commitUrl: extractCommitUrl(changeText),
      }

      currentVersion.changes.push(parsedChange)
    }
  }

  if (currentVersion) {
    versions.push(currentVersion)
  }

  return versions
}

export const standardVersionParser: ChangelogParser = {
  name: 'standard-version',
  detect: detectStandardVersion,
  parse: parseStandardVersion,
}
