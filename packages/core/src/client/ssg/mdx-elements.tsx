/// <reference types="vite/client" />
import { useEffect, useState } from 'react'
import type { ComponentRoute } from '../types'
import { MdxPage } from './mdx-page'
import { NotFound } from '../components/ui-base'
import { useMdxComponents } from '../app/mdx-components-context'
import { matchesMdxUpdatePath } from '../../shared/mdx-path'

const Loading = () => <div className="text-muted text-sm py-4">Loading...</div>

export interface MdxModule {
  default: React.ComponentType<any>
  [key: string]: any
}

export type MdxModuleLoader =
  | (() => Promise<MdxModule>)
  | Promise<MdxModule>
  | MdxModule

async function resolveModuleLoader(
  loader: MdxModuleLoader,
): Promise<MdxModule> {
  if (typeof loader !== 'function') {
    return Promise.resolve(loader as MdxModule)
  }
  try {
    const res = (loader as Function)()
    if (res && typeof res.then === 'function') {
      return await res
    }
    return { default: loader as unknown as React.ComponentType<any> }
  } catch {
    return { default: loader as unknown as React.ComponentType<any> }
  }
}

function extractMdxComponent(
  mod: MdxModule | undefined,
  moduleKey: string | undefined,
  pathKey: string,
): React.ComponentType<{ children?: React.ReactNode }> | null {
  if (!mod) return null

  let target: any = mod

  // If the module has a default export, prefer it.
  if (mod.default !== undefined) {
    target = mod.default
  }

  // Case 1: the resolved module is already a component (function or string).
  if (typeof target === 'function' || typeof target === 'string') {
    return target as React.ComponentType<{ children?: React.ReactNode }>
  }

  // Case 2: a combined/pages object keyed by moduleKey / pathKey.
  if (target && typeof target === 'object') {
    const possibleKeys = [moduleKey, pathKey].filter(Boolean) as string[]
    for (const key of possibleKeys) {
      const value = (target as Record<string, any>)[key]
      if (value) {
        if (typeof value === 'function' || typeof value === 'string') {
          return value as React.ComponentType<{ children?: React.ReactNode }>
        }
        if (typeof value === 'object' && value.default) {
          return value.default as React.ComponentType<{
            children?: React.ReactNode
          }>
        }
      }
    }

    // Fall back to a default export inside the object.
    if (target.default !== undefined) {
      return extractMdxComponent(
        { default: target.default } as MdxModule,
        moduleKey,
        pathKey,
      )
    }
  }

  return null
}

const EagerMdxElement = ({
  moduleLoader,
  moduleKey,
  route,
  components,
  collectionPostComponent,
}: {
  moduleLoader: MdxModule
  moduleKey: string | undefined
  route: ComponentRoute
  components: Record<
    string,
    React.ComponentType<{ children?: React.ReactNode }>
  >
  collectionPostComponent?: React.ComponentType<{ children?: React.ReactNode }>
}) => {
  const [mod, setMod] = useState<MdxModule>(moduleLoader)

  useEffect(() => {
    setMod(moduleLoader)
  }, [moduleLoader])

  useEffect(() => {
    if (!import.meta.hot || !moduleKey) return
    const handler = (data: { relPath: string }) => {
      if (!matchesMdxUpdatePath(route.filePath, data.relPath)) return
      const cacheBustUrl = moduleKey + '?t=' + Date.now()
      import(/* @vite-ignore */ cacheBustUrl).then((m) => {
        setMod(m as unknown as MdxModule)
      })
    }
    const hot = import.meta.hot
    hot.on('boltdocs:mdx-update', handler)
    return () => hot.off?.('boltdocs:mdx-update', handler)
  }, [moduleKey, route.filePath])

  const pathKey = route.path || '/'
  const MDXComponent = extractMdxComponent(mod, moduleKey, pathKey)

  if (!MDXComponent) {
    return (
      <div className="prose dark:prose-invert py-8">
        <h1>{route.title}</h1>
        {route.description && <p>{route.description}</p>}
      </div>
    )
  }
  return (
    <MdxPage
      MDXComponent={MDXComponent}
      mdxComponents={
        (components ?? {}) as unknown as Record<
          string,
          React.ComponentType<HTMLElement>
        >
      }
      collectionPostComponent={collectionPostComponent}
    />
  )
}

const NotFoundWrapper = () => {
  const components = useMdxComponents()
  const ActiveNotFound =
    (components.NotFound as React.ComponentType | undefined) ||
    (components['404'] as React.ComponentType | undefined) ||
    NotFound
  return <ActiveNotFound />
}

export { EagerMdxElement, NotFoundWrapper, resolveModuleLoader }
