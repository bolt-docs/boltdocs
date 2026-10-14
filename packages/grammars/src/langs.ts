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
 * ## Why this is a package
 *
 * The grammar data is 2.6 MB and the framework's own JavaScript is 0.3 MB. Left
 * in `boltdocs`, every install pays 2.6 MB for tables a given site may never
 * load — a documentation site with no C++ blocks never reads `cpp.mjs`, but it
 * still downloads it. Split out, the core tarball is 0.3 MB and this one is
 * 2.9 MB, and `boltdocs` depends on it, so nothing changes for a user: the same
 * 39 languages, the same themes, the same rendered output.
 *
 * The engine stays a separate concern. `boltdocs`' highlighter registry resolves
 * the *engine* from `theme.codeHighlighting.engine`; this package supplies the
 * *grammars* the Shiki engine consumes. Choosing another engine changes what
 * consumes these, not this package's role as a registry of languages.
 *
 * Adding a language is now a deliberate step: drop its grammar in `./grammars`,
 * copy any sibling it imports, and add it to the maps below. `grammars.test.ts`
 * fails when a vendored grammar's relative imports do not resolve, so a partial
 * copy cannot slip through.
 *
 * Grammars are TextMate definitions from the upstream Shiki project.
 */
/**
 * Languages registered when the highlighter is created, before any page is
 * seen.
 *
 * **Empty on purpose.** This used to hold the ten most common fenced-block
 * languages, on the reasoning that a documentation site always has them and
 * pre-registration avoids a first-use stall. Measured, that reasoning was
 * wrong: creating the highlighter with these ten registered costs **202 ms** of
 * synchronous CPU, against **6 ms** with none — and the highlighter is built
 * once per Sätteri compile worker, so the cost multiplies across the pool.
 *
 * A site pays that 202 ms whether or not it has a single code block. The lazy
 * path costs less in total: a grammar loads on the first block that needs it,
 * and a page with no code blocks loads none. For a site that does have blocks,
 * the work is the same work, moved from "always" to "on demand" — and it is
 * shared, because {@link ensureLanguage} caches concurrent loads and reports
 * an already-loaded grammar without re-importing it.
 *
 * The trade is not free and it is not free in one direction. A site whose first
 * page is dense with TypeScript now pays the `ts` import on that page instead
 * of at startup. That is a better place to pay it: startup happens for every
 * build including dev-server prewarm, and a code block is highlighted anyway.
 *
 * Kept as an exported, mutable-by-spread hook rather than deleted: an engine
 * that genuinely wants a warm set can do `langs: [...COMMON_LANGS, 'ts']`
 * without this package needing to know which ones matter to it.
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
 *
 * **Measured: emptying this set makes builds slower, not faster.** Creating the
 * highlighter with these ten costs 202 ms of synchronous CPU against 6 ms with
 * none, so the empty set looked like an obvious win on paper. It is not. Across
 * three cold builds of the 257-page documentation site, moving all ten to the
 * lazy path took the build from a 31.9 s median to 50.1 s — **57% slower**.
 *
 * The reason is where the work lands, not how much of it there is. Grammars
 * load once per Sätteri compile worker, and the pool runs several workers at
 * once: ten grammars parsed in parallel at startup is cheap wall-clock time,
 * while the lazy path serializes an import and a TextMate compile into every
 * worker that touches a code block, contending for the same cores. Registering
 * eagerly turns N per-worker loads into one per-worker batch, and that batching
 * is the whole effect.
 *
 * The empty set is the right call for a site with no code blocks and the wrong
 * one for a documentation site, which is what this package is for.
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
