/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReactNode } from 'react'
import * as ReactDomServer from 'react-dom/server'

export async function renderStaticApp(app: ReactNode): Promise<string> {
  return ReactDomServer.renderToString(<>{app}</>)
}
