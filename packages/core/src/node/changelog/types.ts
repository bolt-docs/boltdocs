export interface ChangelogVersion {
  version: string
  type: 'major' | 'minor' | 'patch'
  date?: string
  changes: ChangelogChange[]
}

export interface ChangelogChange {
  type: 'feat' | 'fix' | 'perf' | 'refactor' | 'docs' | 'chore' | 'other'
  scope?: string
  message: string
  author?: string
  authorUrl?: string
  commit?: string
  commitUrl?: string
}

export interface ChangelogParserOptions {
  title?: string
  inferTab?: boolean
}
