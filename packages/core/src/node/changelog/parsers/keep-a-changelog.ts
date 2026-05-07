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

const KEEP_A_CHANGELOG_TYPES: Record<string, ChangelogChange['type']> = {
  added: 'feat',
  changed: 'refactor',
  deprecated: 'fix',
  removed: 'fix',
  fixed: 'fix',
  security: 'fix',
}

function detectKeepAChangelog(content: string): boolean {
  const hasChangelogHeader = /^#\s+Changelog/i.test(content)

  const versionPattern = /^##\s*\[[\d.]+\]\s*-\s*\d{4}-\d{2}-\d{2}/m
  const hasVersionWithDash = versionPattern.test(content)

  const typePattern =
    /^###\s+(Added|Changed|Deprecated|Removed|Fixed|Security)$/m
  const hasKeepATypes = typePattern.test(content)

  return hasChangelogHeader && hasVersionWithDash && hasKeepATypes
}

function parseKeepAChangelog(content: string): ChangelogVersion[] {
  const lines = content.split('\n')
  const versions: ChangelogVersion[] = []
  let currentVersion: ChangelogVersion | null = null
  let currentChangeType: string = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    const versionMatch = line.match(
      /^##\s*\[(\d+\.\d+\.\d+[^\]]*)\]\s*-\s*(\d{4}-\d{2}-\d{2})/,
    )
    if (versionMatch) {
      if (currentVersion) {
        versions.push(currentVersion)
      }

      currentVersion = {
        version: normalizeVersion(versionMatch[1]),
        type: 'patch',
        date: versionMatch[2],
        changes: [],
      }
      currentChangeType = ''
      continue
    }

    const unreleasedMatch = line.match(/^##\s*\[Unreleased\]/i)
    if (unreleasedMatch) {
      if (currentVersion) {
        versions.push(currentVersion)
      }

      currentVersion = {
        version: 'unreleased',
        type: 'patch',
        date: undefined,
        changes: [],
      }
      currentChangeType = ''
      continue
    }

    const typeMatch = line.match(
      /^###\s+(Added|Changed|Deprecated|Removed|Fixed|Security)$/i,
    )
    if (typeMatch) {
      currentChangeType = typeMatch[1].toLowerCase()
      continue
    }

    if ((line.startsWith('- ') || line.startsWith('* ')) && currentVersion) {
      const changeText = line.slice(2).trim()

      const changeType = KEEP_A_CHANGELOG_TYPES[currentChangeType] || 'other'

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

export const keepAChangelogParser: ChangelogParser = {
  name: 'keep-a-changelog',
  detect: detectKeepAChangelog,
  parse: parseKeepAChangelog,
}
