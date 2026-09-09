import type { ViteReactSSGContext } from '../../types'
import type { RouterEntryModule } from './interface'
import { RemixAdapter } from './remix'

export function getAdapter(
  context: ViteReactSSGContext,
  entryMod?: RouterEntryModule,
) {
  // We only support the React Router (Remix-style) adapter now to keep it agnostic and simple
  return new RemixAdapter(context, entryMod)
}
