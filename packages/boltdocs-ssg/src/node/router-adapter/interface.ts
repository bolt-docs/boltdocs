import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import type { ViteReactSSGContext } from '../../types'
import type { RouterContextData } from '../../router-contract'

export type {
  RouterContextData,
  RouterEntryModule,
  RouterRouteMatch,
  RouterRouteRecord,
  RouterRendererProps,
} from '../../router-contract'

export interface RouterRenderTimings {
  matchMs: number
  resolveMs: number
  loadersMs: number
  renderMs: number
  helmetMs: number
  totalMs: number
}

export interface RouterRenderResult {
  appHTML: string
  htmlAttributes: string
  bodyAttributes: string
  metaAttributes: string[]
  styleTag?: string
  routerContext?: RouterContextData
  timings?: RouterRenderTimings
}

export interface IRouterAdapter<
  Context extends ViteReactSSGContext<true> = ViteReactSSGContext<true>,
> {
  context: Context
  render(path: string): Promise<RouterRenderResult>
  handleLoader(
    req: Connect.IncomingMessage,
    res: ServerResponse<IncomingMessage>,
  ): Promise<void>
}
