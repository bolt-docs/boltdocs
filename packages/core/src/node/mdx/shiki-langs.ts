import html from '@shikijs/langs/html'
import js from '@shikijs/langs/js'
import ts from '@shikijs/langs/ts'
import tsx from '@shikijs/langs/tsx'
import css from '@shikijs/langs/css'
import bash from '@shikijs/langs/bash'
import json from '@shikijs/langs/json'
import markdown from '@shikijs/langs/markdown'
import python from '@shikijs/langs/python'
import go from '@shikijs/langs/go'

/**
 * Languages eagerly registered when the Shiki highlighter is created.
 *
 * Tuned to the ~10 most common fenced-block languages in documentation
 * sites. Loading fewer TextMate grammars up front cuts highlighter startup
 * from ~2.5s of synchronous CPU to a fraction; every other bundled language
 * is imported and registered on demand via `LAZY_LANG_IMPORTS`
 * (see `ensureLanguage` in `./highlighter`).
 */
export const COMMON_LANGS: any[] = [
  html,
  js,
  ts,
  tsx,
  css,
  bash,
  json,
  markdown,
  python,
  go,
]

type LangImporter = () => Promise<unknown>

/**
 * Lazy importers for every bundled language NOT in COMMON_LANGS.
 * Keyed by canonical Shiki language name.
 */
export const LAZY_LANG_IMPORTS: Record<string, LangImporter> = {
  scss: () => import('@shikijs/langs/scss'),
  less: () => import('@shikijs/langs/less'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  json5: () => import('@shikijs/langs/json5'),
  ini: () => import('@shikijs/langs/ini'),
  mdx: () => import('@shikijs/langs/mdx'),
  yaml: () => import('@shikijs/langs/yaml'),
  rust: () => import('@shikijs/langs/rust'),
  toml: () => import('@shikijs/langs/toml'),
  csv: () => import('@shikijs/langs/csv'),
  nginx: () => import('@shikijs/langs/nginx'),
  apache: () => import('@shikijs/langs/apache'),
  dockerfile: () => import('@shikijs/langs/dockerfile'),
  docker: () => import('@shikijs/langs/docker'),
  java: () => import('@shikijs/langs/java'),
  php: () => import('@shikijs/langs/php'),
  sql: () => import('@shikijs/langs/sql'),
  graphql: () => import('@shikijs/langs/graphql'),
  http: () => import('@shikijs/langs/http'),
  xml: () => import('@shikijs/langs/xml'),
  vue: () => import('@shikijs/langs/vue'),
  svelte: () => import('@shikijs/langs/svelte'),
  ruby: () => import('@shikijs/langs/ruby'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  swift: () => import('@shikijs/langs/swift'),
  powershell: () => import('@shikijs/langs/powershell'),
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  elixir: () => import('@shikijs/langs/elixir'),
}

/**
 * Common fence-info aliases resolved to canonical Shiki language names.
 * Loaded languages register their own aliases with Shiki; this map only
 * needs to cover aliases used BEFORE their grammar has been loaded.
 */
export const LANG_ALIASES: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  shell: 'bash',
  sh: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  shellsession: 'bash',
  yml: 'yaml',
  py: 'python',
  golang: 'go',
  rs: 'rust',
  rb: 'ruby',
  kt: 'kotlin',
}

/** Languages that Shiki treats as plain text (no grammar needed). */
const PLAINTEXT_LANGS = new Set([
  'text',
  'plaintext',
  'txt',
  'plain',
  'ansi',
  'none',
])

export type Languages =
  | 'html'
  | 'js'
  | 'ts'
  | 'tsx'
  | 'css'
  | 'scss'
  | 'less'
  | 'bash'
  | 'json'
  | 'jsonc'
  | 'json5'
  | 'ini'
  | 'markdown'
  | 'mdx'
  | 'yaml'
  | 'rust'
  | 'toml'
  | 'csv'
  | 'nginx'
  | 'apache'
  | 'dockerfile'
  | 'docker'
  | 'python'
  | 'go'
  | 'java'
  | 'php'
  | 'sql'
  | 'graphql'
  | 'http'
  | 'xml'
  | 'vue'
  | 'svelte'
  | 'ruby'
  | 'kotlin'
  | 'swift'
  | 'powershell'
  | 'c'
  | 'cpp'
  | 'elixir'

/**
 * Normalize a user-provided fence language to a canonical registry key.
 * Returns `null` for plaintext-like languages (nothing to load) and for
 * languages we do not bundle.
 */
export function normalizeLanguage(rawLang: string | undefined): string | null {
  if (!rawLang) return null
  const lang = rawLang.trim().toLowerCase()
  if (!lang || PLAINTEXT_LANGS.has(lang)) return null
  return LANG_ALIASES[lang] ?? lang
}
