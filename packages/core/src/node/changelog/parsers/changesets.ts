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

function detectChangesets(content: string): boolean {
  const typePattern = /^###\s+(Minor Changes|Major Changes|Patch Changes)/m
  const hasChangesetTypes = typePattern.test(content)

  const versionPattern = /^##\s+v?(\d+\.\d+\.\d+)/m
  const hasVersion = versionPattern.test(content)

  return hasChangesetTypes && hasVersion
}

function detectVersionType(
  lines: string[],
  versionIndex: number,
): ChangelogVersion['type'] | null {
  for (let i = versionIndex + 1; i < Math.min(versionIndex + 10, lines.length); i++) {
    const line = lines[i].trim().toLowerCase()
    if (line.startsWith('### major')) {
      return 'major'
    }
    if (line.startsWith('### minor')) {
      return 'minor'
    }
    if (line.startsWith('### patch')) {
      return 'patch'
    }
  }
  return null
}

function parseChangesets(content: string): ChangelogVersion[] {
  const lines = content.split('\n')
  const versions: ChangelogVersion[] = []
  let currentVersion: ChangelogVersion | null = null
  let currentChangeType: string = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    const versionMatch = line.match(/^##\s+v?(\d+\.\d+\.\d+)/)
    if (versionMatch) {
      if (currentVersion) {
        versions.push(currentVersion)
      }

      const version = normalizeVersion(versionMatch[1])
      let type: ChangelogVersion['type'] = 'patch'
      let date: string | undefined = undefined

      const dateMatch = line.match(/\((\d{4}-\d{2}-\d{2})\)/)
      if (dateMatch) {
        date = dateMatch[1]
      }

      const typeFromVersion = detectVersionType(lines, i)
      if (typeFromVersion) {
        type = typeFromVersion
      }

      currentVersion = {
        version,
        type,
        date,
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

    if (line.startsWith('- ') && currentVersion) {
      const changeText = line.slice(2).trim()

      let changeType: ChangelogChange['type'] = 'other'

      if (currentChangeType.includes('feat') || currentChangeType.includes('minor')) {
        changeType = 'feat'
      } else if (currentChangeType.includes('fix') || currentChangeType.includes('patch')) {
        changeType = 'fix'
      } else if (currentChangeType.includes('perf')) {
        changeType = 'perf'
      } else if (currentChangeType.includes('refactor')) {
        changeType = 'refactor'
      } else if (currentChangeType.includes('docs') || currentChangeType.includes('documentation')) {
        changeType = 'docs'
      } else if (currentChangeType.includes('chore')) {
        changeType = 'chore'
      }

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

export const changesetsParser: ChangelogParser = {
  name: 'changesets',
  detect: detectChangesets,
  parse: parseChangesets,
}