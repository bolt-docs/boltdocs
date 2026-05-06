import type { ChangelogVersion, ChangelogChange } from '../types'

export interface ChangelogParser {
  name: string
  detect(content: string): boolean
  parse(content: string): ChangelogVersion[]
}

export interface DetectionResult {
  parser: ChangelogParser | null
  confidence: 'high' | 'medium' | 'low'
}

export interface ParsedChange {
  type: ChangelogChange['type']
  message: string
  author?: string
  commit?: string
  scope?: string
}

export function normalizeVersion(version: string): string {
  return version.replace(/^v/, '').replace(/^\[|\]$/g, '')
}

export function extractVersionFromMatch(match: RegExpMatchArray): string {
  return match[1]
}

export function extractDateFromVersionLine(line: string): string | undefined {
  const dateMatch = line.match(/\((\d{4}-\d{2}-\d{2})\)/)
  return dateMatch ? dateMatch[1] : undefined
}

export function extractAuthor(text: string): string | undefined {
  const authorMatch = text.match(/Thanks \[@(\w+)\]/)
  return authorMatch ? authorMatch[1] : undefined
}

export function extractAuthorUrl(text: string): string | undefined {
  const urlMatch = text.match(/Thanks \[@[^\]]+\]\(([^)]+)\)/)
  return urlMatch ? urlMatch[1] : undefined
}

export function extractCommit(text: string): string | undefined {
  const commitMatch = text.match(/\[`([a-f0-9]+)`\]/)
  return commitMatch ? commitMatch[1] : undefined
}

export function extractCommitUrl(text: string): string | undefined {
  const urlMatch = text.match(/\[`[a-f0-9]+`\]\(([^)]+)\)/)
  return urlMatch ? urlMatch[1] : undefined
}

export function extractMessage(text: string, type: ChangelogChange['type']): string {
  let message = text

  message = message.replace(/Thanks \[@[^\]]+\]\([^)]+\)/g, '')
  message = message.replace(/\[`[a-f0-9]+`\]\([^)]+\)/g, '')
  message = message.replace(/!\s*-/g, '')
  message = message.replace(/^-\s*/, '')
  message = message.replace(/^feat:\s*/i, '')
  message = message.replace(/^fix:\s*/i, '')
  message = message.replace(/^perf:\s*/i, '')
  message = message.replace(/^refactor:\s*/i, '')
  message = message.replace(/^docs:\s*/i, '')
  message = message.replace(/^chore:\s*/i, '')
  message = message.replace(/^\*\*[a-z]+(\([^)]+\))?:\*\*/gi, '')

  return message.trim()
}

export function groupChangesByType(
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