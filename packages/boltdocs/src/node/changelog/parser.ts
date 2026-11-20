import fs from 'node:fs'
import path from 'node:path'
import type { ChangelogVersion } from './types'
import { detectParser, parseWithAutoDetect } from './parsers'

export { detectParser } from './parsers'

export function parseChangelog(content: string): ChangelogVersion[] {
  return parseWithAutoDetect(content)
}

export function parseChangelogWithDetection(content: string): {
  versions: ChangelogVersion[]
  parserName: string
} {
  const { parser } = detectParser(content)
  return {
    versions: parser?.parse(content) || [],
    parserName: parser?.name || 'unknown',
  }
}

export function readChangelogFile(filePath: string): string {
  const absolutePath = path.resolve(filePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Changelog file not found: ${absolutePath}`)
  }
  return fs.readFileSync(absolutePath, 'utf-8')
}
