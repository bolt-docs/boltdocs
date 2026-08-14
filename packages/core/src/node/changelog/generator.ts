import fs from 'node:fs'
import path from 'node:path'
import { info, warn, success, double } from '@bdocs/dui'
import { parseChangelog, readChangelogFile } from './parser'
import type { ChangelogVersion } from './types'

const TYPE_LABELS: Record<string, string> = {
  feat: 'Feature',
  fix: 'Bug Fix',
  perf: 'Performance',
  refactor: 'Refactor',
  docs: 'Documentation',
  chore: 'Chore',
  other: 'Other',
}

/**
 * Escape `{` and `}` that appear outside inline-code spans so MDX does not
 * interpret them as JSX expressions (e.g. `- ga4: { measurementId: 'G' },`
 * would otherwise crash the Sätteri compiler with mdx-jsx:unexpected-character).
 */
function escapeMdxBraces(value: string): string {
  let result = ''
  let inCode = false
  for (const char of value) {
    if (char === '`') {
      inCode = !inCode
      result += char
    } else if (!inCode && (char === '{' || char === '}')) {
      result += `\\${char}`
    } else {
      result += char
    }
  }
  return result
}

export interface GenerateOptions {
  output?: string
  title?: string
  inferTab?: boolean
  limit?: number
  type?: 'major' | 'minor'
  // When type is undefined, generates major and minor versions only
}

export async function generateChangelog(
  filePath: string,
  options: GenerateOptions = {},
): Promise<void> {
  const outputDir = path.resolve(options.output || 'docs/changelog')
  const title = options.title || 'Changelog'
  const inferTab = options.inferTab !== false
  const limit = options.limit ? Math.max(1, options.limit) : undefined

  info(`📄 Reading changelog from: ${filePath}`)

  const content = readChangelogFile(filePath)
  const versions = parseChangelog(content)

  if (versions.length === 0) {
    warn('⚠️  No versions found in changelog')
    return
  }

  let limitedVersions = versions

  if (options.type) {
    limitedVersions = versions.filter((v) => v.type === options.type)
  } else if (limit) {
    // When limit is used without type, only filter from major/minor versions
    const majorMinorVersions = versions.filter((v) => v.type !== 'patch')
    limitedVersions = majorMinorVersions.slice(0, limit)
  } else {
    // Generate only major and minor versions (exclude patch)
    limitedVersions = versions.filter((v) => v.type !== 'patch')
    // If filtering out patch versions leaves nothing, keep all versions
    // (e.g., changelog with only patch-version entries like 1.0.0)
    if (limitedVersions.length === 0) {
      limitedVersions = versions
    }
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
    info(`📁 Created directory: ${outputDir}`)
  }

  for (const [i, version] of limitedVersions.entries()) {
    const mdContent = generateMarkdown(version, title, inferTab)
    const filename = `${i + 1}.v${version.version}.md`
    const filePath = path.join(outputDir, filename)

    fs.writeFileSync(filePath, mdContent, 'utf-8')
    success(`Generated: ${filename}`)
  }

  const totalTypeFiltered = options.type
    ? versions.filter((v) => v.type === options.type).length
    : versions.filter((v) => v.type !== 'patch').length

  const totalLimitFiltered = limit
    ? Math.min(limit, versions.filter((v) => v.type !== 'patch').length)
    : undefined

  const totalVersions =
    (options.type
      ? totalTypeFiltered
      : (totalLimitFiltered ??
        versions.filter((v) => v.type !== 'patch').length)) +
    ' of ' +
    versions.filter((v) => v.type !== 'patch').length +
    ' versions'

  const typeLabel = options.type ? ` (${options.type})` : ''
  const summaryLines = [
    `  ✨ Generated ${totalVersions}${typeLabel} changelog pages in ${outputDir}`,
    '',
    `  📝 Add this to your navbar in boltdocs.config.ts:`,
    `     { label: '${title}', href: '/changelog' }`,
  ]
  console.log(`\n${double(summaryLines, { title: 'Changelog Generation' })}\n`)
}

function getCoverImage(version: string): string | undefined {
  const versionNum = version.replace(/^v/, '')
  const coverMap: Record<string, string> = {
    '2.8.0': '/blog-covers/Boltdocs-2.8.0.webp',
    '2.9.0': '/blog-covers/Boltdocs-2.9.0.webp',
    '3.0.0': '/blog-covers/Boltdocs-3.0.0.webp',
    '3.1.0': '/blog-covers/Boltdocs-3.1.0.webp',
    '3.2.0': '/blog-covers/Boltdocs-3.2.0.webp',
    '4.0.0-Nitro': '/blog-covers/Boltdocs-4.0.0-Nitro.webp',
  }
  return coverMap[versionNum]
}

function generateMarkdown(
  version: ChangelogVersion,
  title: string,
  _inferTab: boolean,
): string {
  const badgeLabel =
    version.type.charAt(0).toUpperCase() + version.type.slice(1)

  const groupedChanges = groupChangesByType(version.changes)
  const coverImage = getCoverImage(version.version)

  let content = `---
title: v${version.version}
badge: "${badgeLabel}"
description: Changelog version ${version.version}${version.date ? ` (${version.date})` : ''}
tab: "(releases)"
${coverImage ? `cover: "${coverImage}"` : ''}
---

# ${title} v${version.version}

${version.date ? `**Released:** ${version.date}` : ''}

`

  for (const [changeType, changes] of Object.entries(groupedChanges)) {
    if (changes.length === 0) continue

    const label = TYPE_LABELS[changeType] || changeType

    content += `## ${label}\n\n`

    for (const change of changes) {
      content += `- ${escapeMdxBraces(change.message)}\n`
      if (change.author) {
        if (change.authorUrl) {
          content += `  - **Author:** [@${change.author}](${change.authorUrl})\n`
        } else {
          content += `  - **Author:** @${change.author}\n`
        }
      }
      if (change.commit) {
        if (change.commitUrl) {
          content += `  - **Commit:** [\`${change.commit.slice(0, 7)}\`](${change.commitUrl})\n`
        } else {
          content += `  - **Commit:** \`${change.commit.slice(0, 7)}\`\n`
        }
      }
    }

    content += '\n'
  }

  return content
}

function groupChangesByType(
  changes: ChangelogVersion['changes'],
): Record<string, ChangelogVersion['changes']> {
  const grouped: Record<string, ChangelogVersion['changes']> = {
    feat: [],
    fix: [],
    perf: [],
    refactor: [],
    docs: [],
    chore: [],
    other: [],
  }

  for (const change of changes) {
    const type = grouped[change.type] ? change.type : 'other'
    grouped[type].push(change)
  }

  return grouped
}
