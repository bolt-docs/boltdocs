/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createElement, Fragment, type ReactNode } from 'react'
import * as ReactDomServer from 'react-dom/server'

type StaticRenderer = (
  app: ReactNode,
) => Promise<{ prelude: AsyncIterable<Uint8Array | string> }>

const staticRendererPromise = loadStaticRenderer()

async function loadStaticRenderer(): Promise<StaticRenderer | undefined> {
  try {
    // React 19 exposes the static renderer from this subpath. Keep the
    // dynamic import so older React installations can use the fallback below.
    // @ts-expect-error `react-dom/static` is not declared by older @types/react-dom.
    const staticServer = await import('react-dom/static')
    const renderer = (staticServer as { prerenderToNodeStream?: unknown })
      .prerenderToNodeStream
    return typeof renderer === 'function'
      ? (renderer as StaticRenderer)
      : undefined
  } catch {
    return undefined
  }
}

export async function renderStaticApp(app: ReactNode): Promise<string> {
  // Resolve the optional React 19 renderer once per module/worker instead of
  // repeating the dynamic import negotiation for every generated page.
  const prerenderToNodeStream = await staticRendererPromise

  if (!prerenderToNodeStream) {
    return ReactDomServer.renderToString(createElement(Fragment, null, app))
  }

  const { prelude } = await prerenderToNodeStream(
    createElement(Fragment, null, app),
  )
  // React's static renderer may yield strings or byte chunks. Keep string
  // chunks as strings and decode binary chunks incrementally; the previous
  // implementation encoded every string, copied all chunks into a second
  // buffer, and decoded the complete document again for every page.
  // Keep the decoder local because main-thread fallback renders can overlap.
  const textDecoder = new TextDecoder()
  let html = ''
  for await (const chunk of prelude) {
    if (typeof chunk === 'string') {
      // Flush a possible split UTF-8 sequence before appending a string chunk
      // so decoded bytes always remain in their original order.
      html += textDecoder.decode()
      html += chunk
    } else {
      html += textDecoder.decode(new Uint8Array(chunk), { stream: true })
    }
  }
  return html + textDecoder.decode()
}
