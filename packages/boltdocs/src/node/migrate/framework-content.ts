/**
 * Markdown/MDX body conversions for framework imports.
 *
 * Two rules keep these converters safe enough to run unattended:
 *
 * 1. Fenced code blocks are never touched. A documentation site explaining its
 *    own admonition syntax will contain literal `:::` or `<Aside>` examples.
 * 2. Nested admonitions/components are converted inside-out, so a page that
 *    wraps a warning inside a note does not lose either one.
 */

interface Segment {
  text: string
  fenced: boolean
}

const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/

/** Split a body into fenced and non-fenced segments, preserving every character. */
export function splitCodeFences(source: string): Segment[] {
  const lines = source.split(/(?<=\n)/)
  const segments: Segment[] = []
  let buffer = ''
  let fenced = false
  let fenceChar = ''
  let fenceLen = 0

  const flush = () => {
    if (buffer) segments.push({ text: buffer, fenced })
    buffer = ''
  }

  for (const line of lines) {
    const m = FENCE_RE.exec(line.replace(/\r?\n$/, ''))
    if (!fenced && m) {
      flush()
      fenced = true
      fenceChar = m[2][0]
      fenceLen = m[2].length
      buffer = line
      continue
    }
    if (fenced) {
      buffer += line
      if (
        m &&
        m[2][0] === fenceChar &&
        m[2].length >= fenceLen &&
        m[3].trim() === ''
      ) {
        flush()
        fenced = false
      }
      continue
    }
    buffer += line
  }
  flush()
  return segments
}

const ADMONITION_TYPE: Record<string, string> = {
  note: 'info',
  info: 'info',
  tip: 'tip',
  warning: 'warning',
  caution: 'warning',
  danger: 'danger',
  important: 'info',
  success: 'tip',
}

function eolOf(source: string): string {
  return source.includes('\r\n') ? '\r\n' : '\n'
}

/**
 * Convert Docusaurus `:::kind [title] ... :::` admonitions to `<Callout>`.
 *
 * Supports both `:::note Title` and `:::note[Title]`, nested blocks and
 * arbitrary indentation. Unclosed blocks are left verbatim: a half-converted
 * page is worse than a finding the author can act on.
 */
export function convertDocusaurusAdmonitions(body: string): string {
  const segments = splitCodeFences(body)
  let changed = false

  const converted = segments
    .map((segment) => {
      if (segment.fenced) return segment.text

      const eol = eolOf(segment.text)
      const lines = segment.text.split(/\r?\n/)
      // A trailing newline produces an empty final element; keep it out of the
      // line stack and re-append it below.
      const trailingNewline = segment.text.endsWith('\n')
      if (trailingNewline) lines.pop()

      interface Frame {
        indent: string
        type: string
        title?: string
        lines: string[]
        original: string[]
      }
      const stack: Frame[] = []
      const out: string[] = []

      const openRe =
        /^(\s*):::([A-Za-z][\w-]*)(?:[ \t]+([^\n]*?)|\[([^\]]*)\])?[ \t]*$/
      const closeRe = /^(\s*):::[ \t]*$/

      const emitFrame = (frame: Frame) => {
        const title = frame.title?.trim()
          ? ` title=${JSON.stringify(frame.title.trim())}`
          : ''
        out.push(`${frame.indent}<Callout type="${frame.type}"${title}>`)
        for (const line of frame.lines) out.push(`${frame.indent}${line}`)
        out.push(`${frame.indent}</Callout>`)
      }

      for (const line of lines) {
        if (closeRe.test(line)) {
          const frame = stack.pop()
          if (frame) {
            emitFrame(frame)
            changed = true
            continue
          }
          out.push(line)
          continue
        }
        const open = openRe.exec(line)
        if (open) {
          const kind = open[2].toLowerCase()
          stack.push({
            indent: open[1],
            type: ADMONITION_TYPE[kind] ?? 'info',
            title: open[3] ?? open[4],
            lines: [],
            original: [],
          })
          changed = true
          continue
        }
        if (stack.length > 0) stack[stack.length - 1].lines.push(line)
        else out.push(line)
      }

      if (stack.length > 0) {
        // Unclosed block: restore the original text instead of guessing.
        return segment.text
      }
      const result = out.join(eol) + (trailingNewline ? eol : '')
      return result
    })
    .join('')

  return changed ? converted : body
}

const STARLIGHT_TYPE: Record<string, string> = {
  note: 'info',
  info: 'info',
  tip: 'tip',
  caution: 'warning',
  warning: 'warning',
  danger: 'danger',
}

/** Convert Starlight `<Aside>` components to Boltdocs `<Callout>`, inside-out. */
export function convertStarlightAsides(body: string): string {
  // Matches an Aside with no nested Aside inside it: repeated replacement
  // therefore converts the innermost one first and preserves nesting.
  const innermost = /<Aside\b([^>]*)>((?:(?!<Aside\b)[\s\S])*?)<\/Aside\s*>/g

  const convert = (text: string): string =>
    text.replace(innermost, (_m, attrs: string, inner: string) => {
      const typeMatch = attrs.match(/\btype\s*=\s*["'](\w+)["']/)
      const titleMatch = attrs.match(/\btitle\s*=\s*["']([^"']+)["']/)
      const stype = (typeMatch?.[1] || 'note').toLowerCase()
      const type = STARLIGHT_TYPE[stype] ?? 'info'
      const titleAttr = titleMatch
        ? ` title=${JSON.stringify(titleMatch[1])}`
        : ''
      return `<Callout type="${type}"${titleAttr}>${inner}</Callout>`
    })

  let out = body
  let changed = false
  // Each pass converts the innermost remaining Aside, so nested components
  // need as many passes as their depth. Code fences stay protected.
  for (let pass = 0; pass < 32; pass++) {
    let passChanged = false
    for (const segment of splitCodeFences(out)) {
      if (segment.fenced) continue
      const next = convert(segment.text)
      if (next !== segment.text) {
        passChanged = true
        out = out.replace(segment.text, next)
      }
    }
    if (!passChanged) break
    changed = true
  }
  return changed ? out : body
}

/** True when a Starlight-only component appears outside fenced code. */
export function hasStarlightComponents(body: string): boolean {
  const re =
    /<Aside[\s>]|<Steps[\s>]|<CardGrid[\s>]|<LinkCard[\s>]|<TabItem[\s>]|<Tabs[\s>]|from\s*['"]@astrojs\/starlight/
  return splitCodeFences(body).some((s) => !s.fenced && re.test(s.text))
}

/** True when a Docusaurus-only component/import appears outside fenced code. */
export function hasDocusaurusComponents(body: string): boolean {
  const re =
    /from\s*['"]@theme\/|from\s*['"]@docusaurus\/|<TabItem[\s>]|<Tabs[\s>]|<DocCardList[\s>]/
  return splitCodeFences(body).some((s) => !s.fenced && re.test(s.text))
}
