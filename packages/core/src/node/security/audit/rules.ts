import type {
  AuditCategory,
  AuditImportRule,
  AuditRule,
  AuditRuleLayer,
  AuditSeverity,
} from './types'

/**
 * Rules that match against the `code` layer (comments, strings, templates and
 * regex literals removed). These are structural patterns: real call sites and
 * property accesses only.
 */
function rule(
  id: string,
  category: AuditCategory,
  severity: AuditSeverity,
  description: string,
  layer: AuditRuleLayer,
  pattern: RegExp,
  codeGuard?: RegExp,
): AuditRule {
  return { id, category, severity, description, layer, pattern, codeGuard }
}

export const AUDIT_RULES: AuditRule[] = [
  // ─── process — arbitrary command execution (high) ───────────────────────
  rule(
    'child-process-call',
    'process',
    'high',
    'Calls a child_process API (exec/spawn/fork) — can run arbitrary commands',
    'code',
    /child_process\s*\.\s*(?:exec(?:Sync)?|spawn(?:Sync)?|fork|execFile(?:Sync)?)\s*\(/,
  ),
  rule(
    'child-process-exec',
    'process',
    'high',
    'Executes shell commands via exec()',
    'code',
    /(?<![\w$.])exec(?:Sync)?\s*\(/,
  ),
  rule(
    'child-process-spawn',
    'process',
    'high',
    'Spawns child processes via spawn()',
    'code',
    /(?<![\w$.])spawn(?:Sync)?\s*\(/,
  ),
  rule(
    'child-process-fork',
    'process',
    'high',
    'Forks child processes via fork()',
    'code',
    /(?<![\w$.])fork\s*\(/,
  ),
  rule(
    'child-process-execfile',
    'process',
    'high',
    'Executes binaries via execFile()',
    'code',
    /(?<![\w$.])execFile(?:Sync)?\s*\(/,
  ),
  rule(
    'shell-true',
    'process',
    'high',
    'Enables shell:true — passes strings through a shell',
    'code',
    /(?<![\w$])shell\s*:\s*true\b/,
  ),

  // ─── dynamic-code — obfuscation / arbitrary code (high) ─────────────────
  rule(
    'eval-call',
    'dynamic-code',
    'high',
    'Uses eval() — can execute arbitrary strings',
    'code',
    /(?<![\w$.])eval\s*\(/,
  ),
  rule(
    'new-function',
    'dynamic-code',
    'high',
    'Uses new Function() — string-compiled code',
    'code',
    /new\s+Function\s*\(/,
  ),
  rule(
    'function-constructor',
    'dynamic-code',
    'high',
    'Uses the Function constructor — string-compiled code',
    'code',
    /(?<![\w$.])Function\s*\(/,
  ),
  rule(
    'vm-runtime',
    'dynamic-code',
    'high',
    'Uses the vm module runtime APIs — can execute arbitrary code',
    'code',
    /vm\s*\.\s*(?:runInThisContext|runInNewContext|runInContext|compileFunction)\s*\(/,
  ),
  rule(
    'hex-escape-run',
    'dynamic-code',
    'high',
    'Long run of hex escapes — likely obfuscated code',
    'raw',
    /(?:(?:\\x[0-9a-fA-F]{2}){4,}|(?:\\u[0-9a-fA-F]{4}){3,})/,
  ),
  rule(
    'string-fromcharcode',
    'dynamic-code',
    'high',
    'Builds strings from char codes — common obfuscation pattern',
    'code',
    /String\s*\.\s*fromCharCode\s*\(/,
  ),
  rule(
    'base64-buffer',
    'dynamic-code',
    'warning',
    'Decodes base64 payloads via Buffer.from()',
    'raw',
    /Buffer\s*\.\s*from\s*\(\s*[^)\n]*?\s*,\s*['"](?:base64|base64url)['"]\s*\)/,
    /Buffer\s*\.\s*from/,
  ),
  rule(
    'atob-btoa',
    'dynamic-code',
    'warning',
    'Encodes/decodes base64 strings (atob/btoa)',
    'code',
    /(?<![\w$.])(?:atob|btoa)\s*\(/,
  ),

  // ─── network — outbound communication (warning) ─────────────────────────
  rule(
    'fetch-call',
    'network',
    'warning',
    'Makes outbound requests via the global fetch()',
    'code',
    /(?<![\w$.])fetch\s*\(/,
  ),
  rule(
    'http-request',
    'network',
    'warning',
    'Makes HTTP(S) requests via http/https modules',
    'code',
    /(?:http|https)\s*\.\s*(?:get|request)\s*\(/,
  ),
  rule(
    'http-client-lib',
    'network',
    'warning',
    'Uses an HTTP client library (axios/got/superagent/…)',
    'code',
    /(?<![\w$.])(?:axios|got|superagent|needle|undici)\b/,
  ),
  rule(
    'websocket-client',
    'network',
    'warning',
    'Opens WebSocket connections',
    'code',
    /(?<![\w$.])(?:WebSocket|WebSocketClient)\s*\(/,
  ),
  rule(
    'dns-lookup',
    'network',
    'warning',
    'Performs DNS lookups/resolution',
    'code',
    /dns\s*\.\s*(?:lookup|resolve(?:4|6)?|reverse)\s*\(/,
  ),

  // ─── filesystem — writes / deletes (low→warning) ────────────────────────
  // Matched on the `raw` layer so `require('fs').writeFileSync(...)` aliases
  // are detected too (the string is stripped from the `code` layer).
  rule(
    'fs-write',
    'filesystem',
    'low',
    'Writes files via the fs module',
    'raw',
    /(?:fs\s*\.\s*|require\s*\(\s*['"]fs['"]\s*\)\s*\.\s*)(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream)\s*\(/,
    /\b(?:fs|require)\b/,
  ),
  rule(
    'fs-delete',
    'filesystem',
    'warning',
    'Deletes files via the fs module',
    'raw',
    /(?:fs\s*\.\s*|require\s*\(\s*['"]fs['"]\s*\)\s*\.\s*)(?:rm(?:Sync)?|unlink(?:Sync)?)\s*\(/,
    /\b(?:fs|require)\b/,
  ),

  // ─── env-secrets — environment access (low→warning) ─────────────────────
  rule(
    'env-access',
    'env-secrets',
    'low',
    'Reads environment variables (process.env)',
    'code',
    /process\s*\.\s*env\b/,
  ),
  rule(
    'env-secret-name',
    'env-secrets',
    'warning',
    'Reads an environment variable whose name suggests a secret (TOKEN/KEY/SECRET/…)',
    'raw',
    /process\s*\.\s*env\s*\[\s*['"][A-Za-z0-9_]*?(?:TOKEN|KEY|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_KEY|PRIVATE)[A-Za-z0-9_]*?['"]\s*\]/i,
    /process\s*\.\s*env/,
  ),
  rule(
    'env-secret-dot',
    'env-secrets',
    'warning',
    'Reads an environment variable whose name suggests a secret (TOKEN/KEY/SECRET/…)',
    'code',
    /process\s*\.\s*env\s*\.\s*[A-Za-z0-9_]*?(?:TOKEN|KEY|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_KEY|PRIVATE)[A-Za-z0-9_]*/i,
  ),
]

/**
 * Quick-reject gate: literal anchors for every rule, import rule and compound
 * pattern in this catalog. A line whose `raw` view contains none of these
 * anchors cannot produce any finding, so the scanner runs the full rule
 * catalog only when it matches. Must stay a *superset* of every possible
 * match — when adding a rule, add its anchor here (covered by a test).
 */
export const QUICK_REJECT_RE =
  /(?:child_process|exec|spawn|fork|shell|eval|Function|vm|fromCharCode|atob|btoa|Buffer|fetch|http|axios|got|superagent|needle|undici|WebSocket|dns|writeFile|appendFile|createWriteStream|\.rm|\.unlink|readFile|createReadStream|\.stat\(|\.lstat\(|\.access\(|\.realpath\(|statSync|lstatSync|realpathSync|process\.env|require|import|from|\\x|\\u|homedir|~[/'"`]|\/etc|\.ssh|\.aws|\.env|\.npmrc|\.git|USERPROFILE|APPDATA|\.\.\/)/

/**
 * Module specifier deny-list. Detected via a require/import/from pre-pass on
 * comment-stripped lines (strings kept), so `require('child_process')` is
 * caught even though the string is removed from the `code` layer.
 */
export const AUDIT_IMPORT_RULES: AuditImportRule[] = [
  {
    id: 'import-child-process',
    category: 'process',
    severity: 'high',
    description: 'Imports child_process — arbitrary command execution',
    modules: ['child_process'],
  },
  {
    id: 'import-vm',
    category: 'dynamic-code',
    severity: 'high',
    description: 'Imports the vm module — can execute arbitrary code',
    modules: ['vm'],
  },
  {
    id: 'import-net',
    category: 'network',
    severity: 'warning',
    description: 'Imports raw TCP/UDP networking (node:net/dgram)',
    modules: ['net', 'dgram'],
  },
  {
    id: 'import-dns',
    category: 'network',
    severity: 'warning',
    description: 'Imports DNS resolution (node:dns)',
    modules: ['dns'],
  },
  {
    id: 'import-http',
    category: 'network',
    severity: 'warning',
    description: 'Imports an HTTP(S) module (node:http/https/http2/tls)',
    modules: ['http', 'https', 'http2', 'tls', 'undici'],
  },
  {
    id: 'import-websocket',
    category: 'network',
    severity: 'warning',
    description: 'Imports a WebSocket client',
    modules: ['ws', 'socket.io-client', 'websocket'],
  },
  {
    id: 'import-http-client',
    category: 'network',
    severity: 'warning',
    description: 'Imports an HTTP client library',
    modules: ['axios', 'got', 'node-fetch', 'superagent', 'request', 'needle'],
  },
  {
    id: 'import-dotenv',
    category: 'env-secrets',
    severity: 'low',
    description: 'Loads environment variables from .env files',
    modules: ['dotenv'],
  },
  {
    id: 'import-fs',
    category: 'filesystem',
    severity: 'low',
    description:
      'Imports the fs module — can read/write files outside the package',
    modules: ['fs'],
  },
]

/**
 * Path hints that make an fs operation sensitive. Tested against the `raw`
 * layer of a line that already has an fs write/delete/read finding.
 */
export const SENSITIVE_PATH_RE =
  /(?:os\s*\.\s*homedir\s*\(|~\s*[/'"`]|\/etc(?:\/|\b)|\.ssh(?:\/|\b)|\.aws(?:\/|\b)|(?:^|[\s'"`(])\.env(?:\/|\b)|\.npmrc(?:\b)|\.git\s*\/\s*config|process\s*\.\s*env\s*\.\s*[A-Z_]*HOME|%USERPROFILE%|%APPDATA%|\.\.\s*\/)/i

const FS_ALIAS = /(?:fs\s*\.\s*|require\s*\(\s*['"]fs['"]\s*\)\s*\.\s*)/

export const FS_WRITE_RE = new RegExp(
  `${FS_ALIAS.source}(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|rm(?:Sync)?|unlink(?:Sync)?)\\s*\\(`,
)

export const FS_READ_RE = new RegExp(
  `${FS_ALIAS.source}(?:readFile(?:Sync)?|createReadStream|stat(?:Sync)?|lstat(?:Sync)?|access(?:Sync)?|realpath(?:Sync)?)\\s*\\(`,
)

/**
 * Compound findings — elevated severity when a sensitive path is involved.
 */
export const COMPOUND_RULES = {
  'fs-write-sensitive': {
    category: 'filesystem' as const,
    severity: 'high' as const,
    message: 'Writes to a sensitive location (home dir, .env, .ssh, /etc, …)',
  },
  'fs-read-sensitive': {
    category: 'filesystem' as const,
    severity: 'warning' as const,
    message: 'Reads from a sensitive location (.env, .ssh, .npmrc, /etc, …)',
  },
}

/** URL module specifiers loaded at runtime (dynamic code execution risk). */
export const REMOTE_IMPORT_RE = /^(?:https?:)?\/\//i
