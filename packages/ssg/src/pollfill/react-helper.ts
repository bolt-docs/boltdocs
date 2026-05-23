import type { ReactElement } from 'react'
import * as ReactDOM from 'react-dom'
import * as React from 'react'
import { createRoot as reactCreateRoot, hydrateRoot as reactHydrateRoot } from 'react-dom/client'

export interface RootType {
  render: (container: ReactElement) => void
  _unmount: () => void
}
export interface RootTypeReact extends RootType {
  unmount?: () => void
}
export type CreateRootFnType = (
  container: Element | DocumentFragment,
) => RootTypeReact

export type HydrateRootFnType = (
  container: Element | DocumentFragment,
  initialChildren: React.ReactNode,
) => RootTypeReact

const CopyReactDOM = {
  ...ReactDOM,
} as typeof ReactDOM & {
  createRoot: CreateRootFnType
  hydrateRoot: HydrateRootFnType
} & {
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
    usingClientEntryPoint?: boolean
  }
}

// @ts-expect-error react19 has no render
const { version, render: reactRender, hydrate: reactHydrate } = CopyReactDOM

const isReact18 = Number((version || '').split('.')[0]) > 17

interface RenderOptions {
  useLegacyRender?: boolean
}

export function render(
  app: React.ReactElement,
  container: Element | DocumentFragment,
  renderOptions: RenderOptions = {},
) {
  const { useLegacyRender } = renderOptions

  if (useLegacyRender || !isReact18) {
    reactRender(app, container)
  } else {
    const root = reactCreateRoot(container)
    root.render(app)
  }
}

export function hydrate(
  app: React.ReactElement,
  container: Element | DocumentFragment,
  renderOptions: RenderOptions = {},
) {
  const { useLegacyRender } = renderOptions

  if (useLegacyRender || !isReact18) {
    reactHydrate(app, container)
  } else {
    reactHydrateRoot(container, app)
  }
}

