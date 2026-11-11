import { createRequire } from 'node:module'

export type LanguageId = string

const require = createRequire(import.meta.url)

type PrismLike = {
  languages: Record<string, unknown>
}

let loadLanguages: ((langs: string[]) => void) | null = null

function getLoader(Prism: PrismLike): (langs: string[]) => void {
  if (loadLanguages)
    return loadLanguages
    // Prism components expect a global Prism reference in Node.
  ;(globalThis as any).Prism = Prism
  try {
    const mod = require('prismjs/components/index.js')
    loadLanguages = typeof mod === 'function' ? mod : (mod.default ?? mod)
  } catch {
    loadLanguages = () => {}
  }
  return loadLanguages!
}

// Canonical Prism language id for common aliases.
const ALIASES: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  yml: 'yaml',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  ps1: 'powershell',
  psm1: 'powershell',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  svelte: 'markup',
  astro: 'markup',
  mathml: 'markup',
  ssml: 'markup',
  atom: 'markup',
  rss: 'markup',
  md: 'markdown',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  golang: 'go',
  cs: 'csharp',
  'c#': 'csharp',
  dotnet: 'csharp',
  'c++': 'cpp',
  kt: 'kotlin',
  kts: 'kotlin',
  docker: 'docker',
  tf: 'hcl',
  postgres: 'sql',
  plsql: 'sql',
  mysql: 'sql',
  gql: 'graphql',
  proto: 'protobuf',
  objc: 'objectivec',
  tex: 'latex',
  conf: 'ini',
  properties: 'ini',
  env: 'ini',
  dotenv: 'ini',
  patch: 'diff',
  text: 'plain',
  plaintext: 'plain',
  txt: 'plain',
  none: 'plain',
  '': 'plain',
}

const PLAIN = new Set(['plain', 'text', 'plaintext', 'txt', 'none', ''])

export function canonicalLanguage(lang: string | undefined | null): string {
  if (!lang) return 'plain'
  const key = String(lang).trim().toLowerCase()
  if (!key || PLAIN.has(key)) return 'plain'
  return ALIASES[key] ?? key
}

export function ensurePrismLanguage(
  Prism: PrismLike,
  lang: string,
): string | null {
  const id = canonicalLanguage(lang)
  if (id === 'plain') return null
  if (Prism.languages[id]) return id
  // Only attempt to load if a Prism component exists; the loader logs noisily
  // for unknown ids ("Language does not exist: ...").
  try {
    require.resolve(`prismjs/components/prism-${id}.js`)
  } catch {
    return null
  }
  try {
    getLoader(Prism)([id])
  } catch {
    // fall through
  }
  return Prism.languages[id] ? id : null
}

export { ALIASES }
