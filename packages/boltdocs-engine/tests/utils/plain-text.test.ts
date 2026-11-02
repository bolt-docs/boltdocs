import { describe, expect, it } from 'vitest'
import { stripTags, toSingleLine } from '../../src/node/utils/plain-text'

/**
 * `stripTags` replaced an HTML sanitizer on frontmatter text. The cases below are
 * the ones where a naive regex goes wrong, and where getting them wrong would
 * either corrupt a title or leave markup behind.
 */
describe('stripTags', () => {
  it('keeps a bare < that is not a tag', () => {
    // The reason the tag pattern requires a letter after `<`. `<[^>]*>` matched
    // from here to the next `>` and swallowed the rest of the title.
    expect(stripTags('A < B')).toBe('A < B')
    expect(stripTags('x < y > z')).toBe('x < y > z')
    expect(stripTags('if (a<b)')).toBe('if (a<b)')
  })

  it('does not double-escape plain text', () => {
    expect(stripTags('Tips & Tricks')).toBe('Tips & Tricks')
    expect(stripTags('Using "quotes"')).toBe('Using "quotes"')
    expect(stripTags("It's fine")).toBe("It's fine")
    expect(stripTags('100% > 50%')).toBe('100% > 50%')
  })

  it('removes markup and keeps the prose', () => {
    expect(stripTags('<b>bold</b> text')).toBe('bold text')
    expect(stripTags('<p>one</p><p>two</p>')).toBe('one two')
    expect(stripTags('<div class="x">content</div>')).toBe('content')
  })

  it('drops the contents of raw-text elements', () => {
    // Without this the body would survive as visible prose.
    expect(stripTags('<script>alert(1)</script>')).toBe('')
    expect(stripTags('before<script>alert(1)</script>after')).toBe(
      'before after',
    )
    expect(stripTags('<style>.a{color:red}</style>')).toBe('')
    expect(stripTags('<iframe src="x"></iframe>ok')).toBe('ok')
    expect(stripTags('<template><b>hidden</b></template>ok')).toBe('ok')
  })

  it('removes an unterminated raw-text tag', () => {
    // `<script src="x.js">` has a closing `>` but no `</script>`. It still goes,
    // because the body of a raw-text element is not prose.
    expect(stripTags('text <script src="x.js">')).toBe('text')
    // The tags go but the body stays as text. Swallowing the rest of the string
    // would be the browser's reading, and it loses author content; here the
    // result is plain text that React escapes either way.
    expect(stripTags('<style>.a{}')).toBe('.a{}')
  })

  it('leaves a bare angle-bracket fragment that is not a tag', () => {
    // No `>`, so no parser — including a browser's — would treat this as a tag.
    // Requiring the terminator is what keeps `if (a<b)` intact.
    expect(stripTags('<style')).toBe('<style')
    expect(stripTags('<b')).toBe('<b')
  })

  it('removes event handlers with the tag that carries them', () => {
    expect(stripTags('<div onclick="alert(1)">Content</div>')).toBe('Content')
  })

  it('cannot leave a protocol behind for a renderer to follow', () => {
    const plain = stripTags('<a href="javascript:alert(1)">Click me</a>')
    expect(plain).not.toContain('<')
    expect(plain).not.toContain('javascript:')
    expect(plain).toBe('Click me')
  })

  it('removes comments', () => {
    expect(stripTags('a<!-- note -->b')).toBe('ab')
  })

  it('handles a realistic title without corrupting it', () => {
    expect(stripTags('Using <T> generics & <S> state')).toBe(
      'Using generics & state',
    )
    expect(stripTags('Why <script> is dangerous')).toBe('Why is dangerous')
  })

  it('collapses whitespace introduced by removed tags', () => {
    expect(stripTags('<p>a</p>\n\n<p>b</p>')).toBe('a b')
  })

  it('returns an empty string for empty input', () => {
    expect(stripTags('')).toBe('')
    expect(stripTags('<div></div>')).toBe('')
  })
})

describe('toSingleLine', () => {
  it('flattens newlines that a meta description must not carry', () => {
    expect(toSingleLine('line one\nline two')).toBe('line one line two')
    expect(toSingleLine('<p>a</p>\n<p>b</p>')).toBe('a b')
  })

  it('leaves a comparison alone', () => {
    expect(toSingleLine('if x < y then')).toBe('if x < y then')
  })
})
