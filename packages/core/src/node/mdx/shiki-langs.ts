/**
 * Grammars bundled with the framework.
 *
 * These are vendored from `@shikijs/langs` rather than imported from it. That
 * package ships 347 grammars for 9.9 MB installed, and this file could only ever
 * reach 39 of them: `ensureLanguage` returns false for anything outside
 * `LAZY_LANG_IMPORTS`, so the other 308 could never be highlighted and were dead
 * weight on every install.
 *
 * Vendoring the reachable set removes a 9.9 MB dependency. It costs 2.8 MB of
 * grammar instead, 2.8 rather than 1.9 because several grammars import siblings
 * — `js.mjs` pulls in `javascript.mjs`, `vue.mjs` pulls in three of its own — so
 * the directory holds 54 files to serve 39 reachable languages. There is no
 * change in what the highlighter can do.
 *
 * Adding a language is now a deliberate step: drop its grammar in `./grammars`,
 * copy any sibling it imports, and add it to the maps below. `grammars.test.ts`
 * fails when a vendored grammar's relative imports do not resolve, so a partial
 * copy cannot slip through.
 *
 * Grammars are TextMate definitions from the upstream Shiki project.
 */
import html from './grammars/html.mjs'
import js from './grammars/js.mjs'
import ts from './grammars/ts.mjs'
import tsx from './grammars/tsx.mjs'
import css from './grammars/css.mjs'
import bash from './grammars/bash.mjs'
import json from './grammars/json.mjs'
import markdown from './grammars/markdown.mjs'
import python from './grammars/python.mjs'
import go from './grammars/go.mjs'

/**
 * Languages eagerly registered when the Shiki highlighter is created.
 *
 * Tuned to the most common fenced-block languages in documentation sites.
 * Loading fewer TextMate grammars up front cuts highlighter startup from ~2.5s of
 * synchronous CPU to a fraction; every other bundled language is imported and
 * registered on demand via `LAZY_LANG_IMPORTS` (see `ensureLanguage` in
 * `./highlighter`).
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
  scss: () => import('./grammars/scss.mjs'),
  less: () => import('./grammars/less.mjs'),
  jsonc: () => import('./grammars/jsonc.mjs'),
  json5: () => import('./grammars/json5.mjs'),
  ini: () => import('./grammars/ini.mjs'),
  mdx: () => import('./grammars/mdx.mjs'),
  yaml: () => import('./grammars/yaml.mjs'),
  rust: () => import('./grammars/rust.mjs'),
  toml: () => import('./grammars/toml.mjs'),
  csv: () => import('./grammars/csv.mjs'),
  nginx: () => import('./grammars/nginx.mjs'),
  apache: () => import('./grammars/apache.mjs'),
  dockerfile: () => import('./grammars/dockerfile.mjs'),
  docker: () => import('./grammars/docker.mjs'),
  java: () => import('./grammars/java.mjs'),
  php: () => import('./grammars/php.mjs'),
  sql: () => import('./grammars/sql.mjs'),
  graphql: () => import('./grammars/graphql.mjs'),
  http: () => import('./grammars/http.mjs'),
  xml: () => import('./grammars/xml.mjs'),
  vue: () => import('./grammars/vue.mjs'),
  svelte: () => import('./grammars/svelte.mjs'),
  ruby: () => import('./grammars/ruby.mjs'),
  kotlin: () => import('./grammars/kotlin.mjs'),
  swift: () => import('./grammars/swift.mjs'),
  powershell: () => import('./grammars/powershell.mjs'),
  c: () => import('./grammars/c.mjs'),
  cpp: () => import('./grammars/cpp.mjs'),
  elixir: () => import('./grammars/elixir.mjs'),
}

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
