/**
 * Globals the SSG injects into the page and reads back at hydration.
 *
 * Both are written by a `<script>` this package emits — `window.__INITIAL_STATE__`
 * carries the server-rendered data, and `window.__VITE_REACT_SSG_CONTEXT__` is the
 * handoff between the server bundle and the browser one.
 *
 * They were previously reached through `@ts-expect-error` comments, one per use.
 * That is the worst of both worlds: the directive suppresses the error without
 * saying what the value is, so the first person to rename one of these gets a
 * runtime `undefined` instead of a type error, and TypeScript flags the
 * now-unnecessary directives as errors of their own — which is exactly what it
 * did, twice, on a clean checkout.
 *
 * Declaring them here means a rename is a compile error at the declaration and
 * at every use, which is the point of declaring anything.
 */
import type { ViteReactSSGContext } from './types'

declare global {
  interface Window {
    /**
     * Server-rendered state, written by `node/html.ts`.
     *
     * A **string**, not the object it will parse back to: the server emits
     * `JSON.stringify(JSON.stringify(state))` — double-encoded, so the inline
     * `<script>` cannot be closed early by a `</script>` inside the data — and
     * `deserializeState` is what turns it back into an object in the browser.
     * Declaring it as the object type would have been the more natural reading
     * and the wrong one.
     */
    __INITIAL_STATE__?: string
    /** The server's SSG context, handed to the browser bundle on boot. */
    __VITE_REACT_SSG_CONTEXT__?: ViteReactSSGContext<false>
  }
}
