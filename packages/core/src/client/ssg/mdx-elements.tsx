import { useEffect, useState } from 'react'
import type { ComponentRoute } from '../types'
import { MdxPage } from './mdx-page'
import { NotFound } from '../components/ui-base'
import { useMdxComponents } from '../app/mdx-components-context'

const Loading = () => <div className="text-muted text-sm py-4">Loading...</div>

export interface MdxModule {
  default: React.ComponentType<any>
  [key: string]: any
}

export type MdxModuleLoader =
  | (() => Promise<MdxModule>)
  | Promise<MdxModule>
  | MdxModule

function resolveModuleLoader(loader: MdxModuleLoader): Promise<MdxModule> {
  return typeof loader === 'function' ? loader() : Promise.resolve(loader)
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
  components: Record<string, React.ComponentType<{ children?: React.ReactNode }>>
  collectionPostComponent?: React.ComponentType<{ children?: React.ReactNode }>
}) => {
  const [mod, setMod] = useState<MdxModule>(moduleLoader)

  useEffect(() => {
    setMod(moduleLoader)
  }, [moduleLoader])

  useEffect(() => {
    if (!import.meta.hot || !moduleKey) return
    const handler = (data: { relPath: string }) => {
      const incoming = data.relPath.replace(/\\/g, '/').replace(/^\//, '')
      const routeFile = route.filePath.replace(/\\/g, '/').replace(/^\//, '')
      if (incoming !== routeFile) return
      const cacheBustUrl = moduleKey + '?t=' + Date.now()
      import(/* @vite-ignore */ cacheBustUrl).then((m) => {
        setMod(m as unknown as MdxModule)
      })
    }
    import.meta.hot.on('boltdocs:mdx-update', handler)
    return () => import.meta.hot?.off('boltdocs:mdx-update', handler)
  }, [moduleKey, route.filePath])

  const MDXComponent = (mod?.default ?? mod ?? null) as React.ComponentType<{
    components?: Record<string, React.ComponentType<{ children?: React.ReactNode }>>
  }> | null
  if (!MDXComponent) return <Loading />
  return (
    <MdxPage
      MDXComponent={MDXComponent}
      mdxComponents={components}
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
