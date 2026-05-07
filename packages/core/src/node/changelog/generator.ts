import fs from 'node:fs'
import path from 'node:path'
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

export interface GenerateOptions {
  output?: string
  title?: string
  inferTab?: boolean
  limit?: number
}

export async function generateChangelog(
  filePath: string,
  options: GenerateOptions = {},
): Promise<void> {
  const outputDir = path.resolve(options.output || 'docs/changelog')
  const title = options.title || 'Changelog'
  const inferTab = options.inferTab !== false
  const limit = options.limit ? Math.max(1, options.limit) : undefined

  console.log(`📄 Reading changelog from: ${filePath}`)

  const content = readChangelogFile(filePath)
  const versions = parseChangelog(content)

  if (versions.length === 0) {
    console.warn('⚠️  No versions found in changelog')
    return
  }

  const limitedVersions = limit ? versions.slice(0, limit) : versions

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
    console.log(`📁 Created directory: ${outputDir}`)
  }

  for (const [i, version] of limitedVersions.entries()) {
    const mdContent = generateMarkdown(version, title, inferTab)
    const filename = `${i + 1}.v${version.version}.md`
    const filePath = path.join(outputDir, filename)

    fs.writeFileSync(filePath, mdContent, 'utf-8')
    console.log(`✅ Generated: ${filename}`)
  }

  const totalVersions =
    limit && limit < versions.length
      ? `${limit} of ${versions.length} versions`
      : `${versions.length} versions`

  console.log(`\n✨ Generated ${totalVersions} changelog pages in ${outputDir}`)
  console.log(`\n📝 Add this to your navbar in boltdocs.config.ts:`)
  console.log(`   { label: '${title}', href: '/changelog' }`)
}

function generateMarkdown(
  version: ChangelogVersion,
  title: string,
  _inferTab: boolean,
): string {
  const badgeLabel =
    version.type.charAt(0).toUpperCase() + version.type.slice(1)

  const groupedChanges = groupChangesByType(version.changes)

  let content = `---
title: v${version.version}
badge: "${badgeLabel}"
description: Changelog version ${version.version}${version.date ? ` (${version.date})` : ''}
---

# ${title} v${version.version}

${version.date ? `**Released:** ${version.date}` : ''}

`

  for (const [changeType, changes] of Object.entries(groupedChanges)) {
    if (changes.length === 0) continue

    const label = TYPE_LABELS[changeType] || changeType

    content += `## ${label}\n\n`

    for (const change of changes) {
      content += `- ${change.message}\n`
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
