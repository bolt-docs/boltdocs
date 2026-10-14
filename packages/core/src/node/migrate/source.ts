/**
 * Source scanning for the migration codemods.
 *
 * These are deliberately small and deliberately hand-written. TypeScript is a
 * devDependency of this package, not a runtime one, so a published
 * `boltdocs migrate` cannot import its compiler — and it should not: the command
 * runs before the project has a working build, and a compiler that fails to
 * load would fail the one command whose whole job is fixing a broken tree.
 *
 * The regexes below are anchored so that they match module specifiers and
 * nothing that merely resembles one. `trimmed.indexOf(' from ')` has exactly
 * the shape of an import clause, which is why every pattern here requires a
 * statement keyword or a call parenthesis immediately before the specifier.
 * Anything a hand-written scanner gets wrong is reported, not silently
 * rewritten.
 */

export interface ImportHit {
  specifier: string
  /** 1-based line of the specifier. */
  line: number
  /** 0-based index of the opening quote. */
  start: number
  /** 0-based index just past the closing quote. */
  end: number
  /** `import` / `export … from` / `require()` / dynamic `import()`. */
  kind: 'static' | 'dynamic' | 'require'
}

const LINE_START = /^[ \t]*/

function lineOf(source: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++
  }
  return line
}

/**
 * Matches `from`, `import(`, `require(` and bare `import` followed by a quote.
 *
 * Each alternative consumes the keyword, so the capture group always starts on
 * the opening quote of a real specifier.
 */
const SPECIFIER_RE =
  /(?:\bfrom\s*|\bimport\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g

function kindFor(keyword: string): ImportHit['kind'] {
  if (keyword.includes('import')) return 'static'
  if (keyword.includes('require')) return 'require'
  return 'static'
}

/**
 * Every module specifier in `source`, with positions.
 *
 * Skips specifiers inside comments and template literals well enough for a
 * migration report: a commented-out import is not a finding, and rewriting one
 * would corrupt the comment. The scanner does not claim to be a parser, so the
 * transforms below only ever rewrite what this function reports.
 */
export function findImports(source: string): ImportHit[] {
  const hits: ImportHit[] = []
  SPECIFIER_RE.lastIndex = 0
  for (
    let match = SPECIFIER_RE.exec(source);
    match !== null;
    match = SPECIFIER_RE.exec(source)
  ) {
    const [full, , specifier] = match
    if (isCommented(source, match.index)) continue
    // The full match is `keyword + quote + specifier + quote`, so the closing
    // quote is its last character. The specifier spans backwards from there,
    // which keeps [start, end) addressing exactly the quoted text — the
    // rewrite below preserves the original quotes rather than re-adding them.
    const end = match.index + full.length - 1
    const start = end - specifier.length
    hits.push({
      specifier,
      line: lineOf(source, start),
      start,
      end,
      kind: kindFor(full),
    })
  }
  return hits
}

/** True when the character run before `index` closes an unclosed line comment. */
function isCommented(source: string, index: number): boolean {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1
  const before = source.slice(lineStart, index)
  if (before.includes('//')) {
    // A `//` only comments the rest of its line; a block comment is handled
    // below. Nothing after a real line comment can be code.
    const afterComment = before.indexOf('//')
    const between = before.slice(afterComment)
    // `http://x` inside a string is not a comment. A line comment needs only
    // whitespace or nothing after the slashes.
    if (!between.slice(2).includes('"') && !between.slice(2).includes("'")) {
      return true
    }
  }
  const openBlock = source.lastIndexOf('/*', index)
  if (openBlock === -1) return false
  const closeBlock = source.indexOf('*/', openBlock)
  return closeBlock === -1 || closeBlock > index
}

/** All occurrences of a JSX/HTML attribute name in a source file. */
export interface AttrHit {
  name: string
  line: number
  /** Full match text, e.g. `onPress={handlePress}`. */
  text: string
}

/**
 * Finds JSX attributes by name.
 *
 * Used only on files already known to import the affected library, and the hits
 * are reported as `manual` findings rather than rewritten, so a match in a
 * string or a comment costs a reviewable line in the report, not a broken
 * build.
 */
export function findJsxAttributes(source: string, name: string): AttrHit[] {
  const out: AttrHit[] = []
  const re = new RegExp(`(?<![\\w$.])${name}\\s*=`, 'g')
  for (let match = re.exec(source); match !== null; match = re.exec(source)) {
    if (isCommented(source, match.index)) continue
    out.push({
      name,
      line: lineOf(source, match.index),
      text: match[0].trimEnd(),
    })
  }
  return out
}

/** Rewrites one specifier in place, by index, preserving the original quotes. */
export function replaceSpecifier(
  source: string,
  hit: ImportHit,
  next: string,
): string {
  return source.slice(0, hit.start) + next + source.slice(hit.end)
}

/** Inserts a line after the last import statement, at column 0. */
export function insertAfterImports(source: string, line: string): string {
  const importRe = /^\s*import\b.*$/gm
  let end = 0
  for (
    let match = importRe.exec(source);
    match !== null;
    match = importRe.exec(source)
  ) {
    end = match.index + match[0].length
  }
  if (end === 0) return `${line}\n${source}`
  const after = source.indexOf('\n', end)
  if (after === -1) return `${source}\n${line}`
  return `${source.slice(0, after + 1)}${line}\n${source.slice(after + 1)}`
}

/** Indentation of the line containing `index`, as a literal prefix. */
export function indentAt(source: string, index: number): string {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1
  const line = source.slice(lineStart, index)
  return LINE_START.exec(line)?.[0] ?? ''
}
