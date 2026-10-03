/**
 * Plain-text extraction from author-supplied strings.
 *
 * Frontmatter `title`, `description`, `badge` and `excerpt` are plain text, not
 * HTML. They reach React as text children, which escape automatically, and as
 * `<meta content>` and `<title>` values, which React also escapes. None of them
 * is an HTML sink.
 *
 * They were nonetheless being run through DOMPurify, which is an HTML sanitizer.
 * That was wrong in three ways at once:
 *
 * - It cost `isomorphic-dompurify`, and therefore jsdom: 9.2 MB and 63 packages
 *   to escape strings that were never interpreted as HTML.
 * - It double-escaped. A title of `A < B` came back as `A &lt; B`, and React
 *   then escaped the `&`, so the rendered heading read literally `A &lt; B`.
 * - It encoded entities in text that was already encoded.
 *
 * Stripping tags is the correct operation here, and it is strictly safer than
 * what came before for the case that matters: markup in frontmatter can no
 * longer survive at all, rather than surviving as allowed-but-inert HTML.
 */

/** Elements whose content is code, not prose, and must not become visible text. */
const RAWTEXT_ELEMENTS = ['script', 'style', 'noscript', 'template', 'iframe']

/**
 * Elements that legitimately introduce a line break in prose. `<br>` and the
 * block-level tags below become a single space rather than nothing, so
 * `<p>a</p><p>b</p>` reads "a b" instead of "ab".
 */
const BLOCK_BOUNDARY =
  /<\/?(?:p|div|br|hr|li|tr|td|th|h[1-6]|section|article|blockquote|pre)\b[^>]*>/gi

/**
 * Reduces a string to plain text: no tags, no entities, no raw-text content.
 *
 * This is deliberately not an HTML sanitizer. It does not parse HTML and makes
 * no claim about what a browser would do with markup — it removes markup, so
 * there is nothing left for a browser to interpret. Anything that genuinely
 * needs to *render* author HTML must be handled at the HTML layer instead, with
 * a real parser.
 */
export function stripTags(input: string): string {
  if (!input) return ''

  // Drop the contents of elements that are code or embedded documents. Without
  // this, `<script>alert(1)</script>` would leave `alert(1)` as visible text.
  let text = input
  for (const tag of RAWTEXT_ELEMENTS) {
    text = text.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'),
      ' ',
    )
    // Self-closing or unterminated forms still have to go.
    text = text.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), ' ')
  }

  text = text.replace(BLOCK_BOUNDARY, ' ')
  // Anything left that looks like a tag. Two requirements, both about not
  // corrupting author text:
  //
  // - A letter (or `/`, `!`, `?`) must follow `<`. `<` is legal in plain text,
  //   so `A < B and C > D` has to survive; `<[^>]*>` would match from the `<` to
  //   the next `>` and swallow the rest of the title.
  // - A `>` must close it. `if (a<b)` is a comparison, not an unterminated
  //   `<b>` tag. Elements that actually matter here — script, style, iframe —
  //   are already handled by the raw-text pass above, unterminated or not, so
  //   requiring the terminator costs nothing.
  text = text.replace(/<[/!?]?[a-zA-Z][^>]*>|<!--[\s\S]*?-->/g, '')

  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Collapses a description to a single line, for meta descriptions and excerpts.
 *
 * A newline inside a `<meta content>` is not a syntax problem but it is a
 * quality one: search engines and social cards render it as a space anyway, and
 * a raw newline in an attribute is a trap for whatever formats it later.
 */
export function toSingleLine(input: string): string {
  return stripTags(input).replace(/\s+/g, ' ').trim()
}
