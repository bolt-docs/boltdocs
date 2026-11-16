import { migrate } from '../migrate'
import type { MigrationFinding, MigrationSource } from '../migrate'
import { setProjectRoot } from '../security/fs-patch'

/**
 * `boltdocs migrate` — upgrade a Boltdocs 3.x project to 4.0, or migrate a
 * Docusaurus/Starlight documentation site into Boltdocs.
 *
 * Deliberately dui-free, like `audit`. A migration command runs against
 * projects that may not build, and paying to load a UI module graph to print a
 * report is the wrong trade for the one command a user reaches for when things
 * are already broken.
 */
const COLOR_SUPPORTED =
  !('NO_COLOR' in process.env) && (process.stdout?.isTTY ?? false)

function colorize(code: number | string, s: string): string {
  return COLOR_SUPPORTED ? `\u001b[${code}m${s}\u001b[0m` : s
}

const colors = {
  red: (s: string) => colorize(31, s),
  yellow: (s: string) => colorize(33, s),
  green: (s: string) => colorize(32, s),
  gray: (s: string) => colorize(90, s),
  bold: (s: string) => colorize(1, s),
  dim: (s: string) => colorize(2, s),
}

const PREFIX = 'boltdocs'

function log(
  stream: 'stdout' | 'stderr',
  color: (s: string) => string,
  msg: string,
): void {
  const leading = msg.match(/^\n+/)?.[0] ?? ''
  const rest = msg.slice(leading.length)
  const line = `${colors.bold(`[${PREFIX}]`)} ${rest}`
  const out = stream === 'stderr' ? console.error : console.log
  if (leading) out(leading)
  out(color(line))
}

const info = (msg: string) => log('stdout', colors.gray, msg)
const warn = (msg: string) => log('stdout', colors.yellow, msg)
const success = (msg: string) => log('stdout', colors.green, msg)
const error = (msg: string) => log('stderr', colors.red, msg)

const SEVERITY_TAG: Record<MigrationFinding['severity'], string> = {
  blocking: colors.red('blocking'),
  warning: colors.yellow('warning '),
  info: colors.dim('info    '),
}

function location(finding: MigrationFinding): string {
  const file = finding.file
  return finding.line ? `${file}:${finding.line}` : file
}

export interface MigrateCliOptions {
  apply?: boolean
  from?: string
}

export async function migrateAction(
  root: string = process.cwd(),
  options: MigrateCliOptions = {},
): Promise<void> {
  const apply = options.apply === true
  const from = (options.from ?? 'auto') as MigrationSource | 'auto'

  const allowedSources: ReadonlySet<string> = new Set([
    'auto',
    'boltdocs',
    'docusaurus',
    'starlight',
  ])
  if (!allowedSources.has(from)) {
    error(
      `Unknown migration source '${from}'. Expected one of: ${[...allowedSources].join(', ')}.`,
    )
    process.exitCode = 1
    return
  }

  // The filesystem guard resolves paths against a project root captured from
  // `process.cwd()` when the patch was installed. `boltdocs migrate ./other-site`
  // targets a different root, and without this every write is rejected as being
  // outside it — with a security error that reads like an attack rather than a
  // wrong argument.
  setProjectRoot(root)

  info(
    apply
      ? `Scanning project (${from}) and applying safe fixes...`
      : `Scanning project (${from})... (dry run — nothing will be written)`,
  )

  let plan: ReturnType<typeof migrate>
  try {
    plan = migrate({ root, apply, from })
  } catch (err) {
    error(
      `Migration scan failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    process.exitCode = 1
    return
  }

  const { findings, applied } = plan

  if (findings.length === 0) {
    success(
      '\n✓ Nothing to migrate. No supported migration changes were detected.',
    )
    return
  }

  let lastFile = ''
  let lastSeverity = ''
  for (const finding of findings) {
    // Re-print the file header only when the file changes, and the severity
    // tag only when the severity does — a run with five findings in two files
    // should read as two blocks, not seven unrelated lines.
    if (finding.file !== lastFile) {
      console.log(`\n${colors.bold(colors.gray(finding.file))}`)
      lastFile = finding.file
      lastSeverity = ''
    }
    const tag =
      finding.severity === lastSeverity
        ? ' '.repeat(9)
        : SEVERITY_TAG[finding.severity]
    lastSeverity = finding.severity
    console.log(`  ${tag} ${colors.dim(location(finding))}  ${finding.title}`)
    if (finding.snippet) {
      console.log(`            ${colors.dim(`→ ${finding.snippet}`)}`)
    }
    // A failed write carries the reason in `detail` and nowhere else. Without
    // this line the report says a write failed and not why, which is the one
    // thing the reader needs.
    if (finding.remediation) {
      console.log(`            ${colors.dim(finding.remediation)}`)
    } else if (finding.id === 'write/failed') {
      console.log(`            ${colors.dim(finding.detail)}`)
    }
  }

  // Findings that `--apply` already resolved must not fail the command: the
  // report lists what was found, but the exit code reflects what remains.
  const remaining = apply
    ? findings.filter((f) => !applied.includes(f))
    : findings
  const blocking = remaining.filter((f) => f.severity === 'blocking')
  const manual = remaining.filter((f) => f.action === 'manual')

  console.log('')
  if (apply) {
    success(
      `Applied ${applied.length} fix${applied.length === 1 ? '' : 'es'}. Review the diff before committing.`,
    )
  } else {
    const fixable = findings.filter((f) => f.action === 'fixable').length
    if (fixable > 0) {
      warn(
        `${fixable} of these can be fixed automatically. Re-run with --apply.`,
      )
    }
  }

  if (manual.length > 0) {
    warn(
      `${manual.length} change${manual.length === 1 ? '' : 's'} need${manual.length === 1 ? 's' : ''} a human decision and ` +
        'cannot be automated. See the 4.0 upgrade guide for each one.',
    )
  }

  // Exit non-zero on blocking findings so CI can gate on it. `exitCode` rather
  // than `exit()` so stdout flushes first.
  if (blocking.length > 0) process.exitCode = 1
}
