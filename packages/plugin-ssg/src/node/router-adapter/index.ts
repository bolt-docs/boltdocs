import type { ViteReactSSGContext } from '~/types'
import { RemixAdapter } from './remix'

export function getAdapter(context: ViteReactSSGContext) {
  // We only support the React Router (Remix-style) adapter now to keep it agnostic and simple
  return new RemixAdapter(context)
}
