import { useEffect, useState } from 'react'
import type { ComponentRoute } from '../types'
import { MdxPage } from './mdx-page'
import { NotFound } from '../components/ui-base'
import { useMdxComponents } from '../app/mdx-components-context'

const Loading = () => <div className="text-muted text-sm py-4">Loading...</div>

function resolveModuleLoader(loader: any): Promise<any> {
  return typeof loader === 'function' ? loader() : Promise.resolve(loader)
}

const LazyMdxElement = ({
  getModule,
  moduleKey,
  route,
  components,
  collectionPostComponent,
}: {
  getModule: (() => Promise<any>) | null
  moduleKey: string | undefined
  route: ComponentRoute
  components: any
  collectionPostComponent?: React.ComponentType<any>
}) => {
  const [mod, setMod] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    if (getModule) {
      resolveModuleLoader(getModule).then((m: any) => {
        if (!cancelled) setMod(m)
      })
    }
    return () => {
      cancelled = true
    }
  }, [getModule])

  useEffect(() => {
    if (!import.meta.hot || !moduleKey) return
    const handler = (data: { relPath: string }) => {
      const incoming = data.relPath.replace(/\\/g, '/').replace(/^\//, '')
      const routeFile = route.filePath.replace(/\\/g, '/').replace(/^\//, '')
      if (incoming !== routeFile) return
      const cacheBustUrl = moduleKey + '?t=' + Date.now()
      import(/* @vite-ignore */ cacheBustUrl).then((m: any) => {
        setMod(m)
      })
    }
    import.meta.hot.on('boltdocs:mdx-update', handler)
    return () => import.meta.hot?.off('boltdocs:mdx-update', handler)
  }, [moduleKey, route.filePath])

  if (!mod) return <Loading />
  const MDXComponent = mod.default ?? mod
  return (
    <MdxPage
      MDXComponent={MDXComponent}
      mdxComponents={components}
      collectionPostComponent={collectionPostComponent}
    />
  )
}

const EagerMdxElement = ({
  moduleLoader,
  moduleKey,
  route,
  components,
  collectionPostComponent,
}: {
  moduleLoader: any
  moduleKey: string | undefined
  route: ComponentRoute
  components: any
  collectionPostComponent?: React.ComponentType<any>
}) => {
  const [mod, setMod] = useState<any>(moduleLoader)

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
      import(/* @vite-ignore */ cacheBustUrl).then((m: any) => {
        setMod(m)
      })
    }
    import.meta.hot.on('boltdocs:mdx-update', handler)
    return () => import.meta.hot?.off('boltdocs:mdx-update', handler)
  }, [moduleKey, route.filePath])

  const MDXComponent = mod?.default ?? mod ?? null
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
  const ActiveNotFound = components.NotFound || components['404'] || NotFound
  return <ActiveNotFound />
}

export { LazyMdxElement, EagerMdxElement, NotFoundWrapper, resolveModuleLoader }
