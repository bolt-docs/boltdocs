/**
 * Types for `boltdocs migrate`.
 *
 * The command is a report first and an editor second. Every finding carries the
 * evidence that produced it (file, line, the exact text) so a reviewer can
 * disagree with it, and so a dry run prints something a human can act on rather
 * than a count.
 */

/** How much of a finding the command can resolve on its own. */
export type MigrationAction =
  /** A codemod rewrites this. `--apply` does it. */
  | 'fixable'
  /** Genuinely undecidable by a tool. Always a human decision. */
  | 'manual'

/**
 * Severity drives the exit code and the report ordering.
 *
 * `blocking` means the project does not build or run correctly on 4.0 without
 * it. `warning` means it runs but produces different output. `info` is a
 * recommended change with no behavioral consequence.
 */
export type MigrationSeverity = 'blocking' | 'warning' | 'info'

export interface MigrationFinding {
  /** Stable identifier, e.g. `react-aria/import`. Used in tests and docs. */
  id: string
  severity: MigrationSeverity
  action: MigrationAction
  /** One line: what is wrong and what to do about it. */
  title: string
  /** Why it matters, and what breaks if it is ignored. */
  detail: string
  /** Project-relative path, or `package.json`. */
  file: string
  /** 1-based. Absent for whole-file findings. */
  line?: number
  /** The offending text, verbatim. */
  snippet?: string
  /** What the fix looks like, for `fixable` findings. */
  remediation?: string
}

export interface MigrationPlan {
  findings: MigrationFinding[]
  /** Findings `--apply` resolved. Empty in a dry run. */
  applied: MigrationFinding[]
}

/** A codemod: inspects one file, returns what it would change. */
export interface Transform {
  id: string
  /** Files this transform reads. Kept narrow so the scan stays cheap. */
  appliesTo(file: string): boolean
  /**
   * Returns the findings for this file. Pure: it must not write anything, so a
   * dry run and an apply run agree on what is wrong.
   */
  inspect(
    file: string,
    source: string,
    ctx: TransformContext,
  ): MigrationFinding[]
  /**
   * Returns the rewritten source, or the original when there is nothing to do.
   * Only called when `--apply` is set.
   */
  apply?(source: string, ctx: TransformContext): string
}

export interface TransformContext {
  root: string
}
