import type { RouterContextData } from '../router-contract'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** Encode large worker responses as transferable UTF-8 bytes. */
export function encodeSsgText(value: string): ArrayBuffer {
  return textEncoder.encode(value).buffer
}

/** Decode both transferred ArrayBuffers and structured-cloned views. */
export function decodeSsgText(
  value: ArrayBuffer | ArrayBufferView<ArrayBufferLike>,
): string {
  if (value instanceof ArrayBuffer) return textDecoder.decode(value)

  return textDecoder.decode(
    new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
  )
}

/**
 * Convert router data to the JSON-compatible shape used by the hydration
 * script before it crosses a worker boundary. This mirrors JSON.stringify's
 * behavior for functions, symbols, cycles, and non-finite numbers while
 * preventing Piscina's structured-clone protocol from seeing unsafe values.
 */
function toJsonSafe<T>(value: T, fallback: unknown): unknown {
  try {
    const ancestors: object[] = []
    const serialized = JSON.stringify(value, function (_key, current: unknown) {
      if (typeof current === 'bigint') return null
      if (typeof current === 'function' || typeof current === 'symbol') {
        return undefined
      }
      if (typeof current === 'object' && current !== null) {
        while (
          ancestors.length > 0 &&
          ancestors[ancestors.length - 1] !== this
        ) {
          ancestors.pop()
        }
        if (ancestors.includes(current)) return undefined
        ancestors.push(current)
      }
      return current
    })
    return serialized === undefined ? fallback : JSON.parse(serialized)
  } catch {
    return fallback
  }
}

export function createSsgRouterContextPayload(
  routerContext: RouterContextData | undefined,
): RouterContextData | null {
  if (!routerContext) return null

  return {
    loaderData: toJsonSafe(routerContext.loaderData ?? {}, {}) as Record<
      string,
      unknown
    >,
    actionData: toJsonSafe(routerContext.actionData ?? null, null),
    errors: toJsonSafe(routerContext.errors ?? null, null),
  }
}

/**
 * Build the hydration assignment from an already normalized payload. Worker
 * and main-thread callers normalize before this point; doing so here again
 * would add a stringify/parse round trip to every rendered page.
 */
export function createSsgHydrationScript(
  routerContext: RouterContextData | null | undefined,
): string {
  if (!routerContext) return ''
  const safeJson = JSON.stringify(routerContext).replace(/</g, '\\u003c')
  return `window.__staticRouterHydrationData = ${safeJson};`
}
