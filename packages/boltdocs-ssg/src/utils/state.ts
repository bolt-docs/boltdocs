// https://github.com/yahoo/serialize-javascript
const UNSAFE_CHARS_REGEXP = /[<>/\u2028\u2029]/g
const ESCAPED_CHARS = {
  '<': '\\u003C',
  '>': '\\u003E',
  '/': '\\u002F',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

function escapeUnsafeChars(unsafeChar: string) {
  return ESCAPED_CHARS[unsafeChar as keyof typeof ESCAPED_CHARS]
}

export function serializeState(state: any): string | null {
  if (state == null || Object.keys(state).length === 0) return null
  try {
    return JSON.stringify(JSON.stringify(state || {})).replace(
      UNSAFE_CHARS_REGEXP,
      escapeUnsafeChars,
    )
  } catch (err) {
    console.error(
      `[SSG] On state serialization - ${err instanceof Error ? err.message : String(err)}`,
    )
    return null
  }
}

/**
 * Reads the double-encoded state `serializeState` wrote.
 *
 * `state` is optional because the server skips the `<script>` entirely when
 * there is nothing to serialise — `window.__INITIAL_STATE__` is then genuinely
 * absent rather than empty, and the `|| '{}'` below is what keeps that from
 * being a parse error.
 */
export function deserializeState(state?: string | null) {
  try {
    return JSON.parse(state || '{}')
  } catch (err) {
    console.error(
      `On state deserialization - ${err instanceof Error ? err.message : String(err)}`,
    )
    return {}
  }
}
