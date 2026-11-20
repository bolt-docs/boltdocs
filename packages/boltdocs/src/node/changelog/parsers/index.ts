import type { ChangelogParser } from './base'
import { changesetsParser } from './changesets'
import { keepAChangelogParser } from './keep-a-changelog'
import { semanticReleaseParser } from './semantic-release'
import { standardVersionParser } from './standard-version'

export type { ChangelogParser, DetectionResult } from './base'

export const parsers: ChangelogParser[] = [
  keepAChangelogParser,
  semanticReleaseParser,
  standardVersionParser,
  changesetsParser,
]

export function detectParser(content: string): {
  parser: ChangelogParser | null
  name: string
} {
  for (const parser of parsers) {
    if (parser.detect(content)) {
      return { parser, name: parser.name }
    }
  }

  return { parser: changesetsParser, name: 'changesets (fallback)' }
}

export function parseWithAutoDetect(content: string) {
  const { parser } = detectParser(content)
  return parser?.parse(content) || []
}

export {
  changesetsParser,
  keepAChangelogParser,
  semanticReleaseParser,
  standardVersionParser,
}
