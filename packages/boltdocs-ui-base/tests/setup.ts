import '@testing-library/jest-dom/vitest'

/**
 * jsdom does not implement `matchMedia`, and `ThemeProvider` reads
 * `prefers-color-scheme` to resolve the `system` theme. Without this stub every
 * test that mounts the theme provider throws `window.matchMedia is not a
 * function` — which is why this package shipped with no unit tests for its theme
 * context even though it is one of the two a user is most likely to mount.
 *
 * Defaults to light. A test that cares about the dark branch sets `prefersDark`
 * and re-mounts; the listener API is implemented because `ThemeProvider`
 * subscribes to changes, so a stub without `addEventListener` would fail later
 * and less clearly than this one.
 */
let prefersDark = false

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    get matches() {
      return query.includes('dark') ? prefersDark : !prefersDark
    },
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

/** Sets the value `prefers-color-scheme: dark` will report. */
export function setPrefersDark(value: boolean): void {
  prefersDark = value
}
