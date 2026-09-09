import { createContext, use, useEffect, useState } from 'react'
import type { ComponentRoute } from '../types'

export interface CollectionPost {
  path: string
  title: string
  date?: string | Date
  excerpt?: string
  tags?: string[]
  author?: string
  coverImage?: string
  filePath: string
  locale?: string
  version?: string
  frontmatter?: Record<string, any>
  lastUpdated?: string | number | Date
  headings?: { level: number; text: string; id: string }[]
  draft?: boolean
  /** Collection id this post belongs to (added by the server for HMR). */
  collection?: string
}

export type CollectionsData = Record<string, CollectionPost[]>

interface CollectionsDeltaPayload {
  collections: {
    updated: CollectionPost[]
    deleted: string[]
  }
}

export const CollectionsContext = createContext<CollectionsData>({})

export function useCollectionsData(): CollectionsData {
  return use(CollectionsContext)
}

export function CollectionsProvider({
  collectionsData,
  children,
}: {
  collectionsData: CollectionsData
  children: React.ReactNode
}) {
  const [data, setData] = useState(collectionsData)

  useEffect(() => {
    if (!import.meta.hot) return

    const handler = (payload: CollectionsDeltaPayload) => {
      setData((prev) => {
        const next = { ...prev }

        for (const post of payload.collections.updated) {
          const collection = post.collection
          if (!collection) continue
          const arr = next[collection] ? [...next[collection]] : []
          const idx = arr.findIndex((p) => p.filePath === post.filePath)
          if (idx >= 0) {
            arr[idx] = post
          } else {
            arr.push(post)
          }
          next[collection] = arr
        }

        for (const filePath of payload.collections.deleted) {
          for (const key of Object.keys(next)) {
            next[key] = next[key].filter((p) => p.filePath !== filePath)
          }
        }

        return next
      })
    }

    const hot = import.meta.hot
    hot.on('boltdocs:frontmatter-update', handler)
    return () => hot.off?.('boltdocs:frontmatter-update', handler)
  }, [])

  return (
    <CollectionsContext.Provider value={data}>
      {children}
    </CollectionsContext.Provider>
  )
}

interface CurrentPostContextValue {
  route: ComponentRoute
  headings: { level: number; text: string; id: string }[]
  collection: string
}

const CurrentPostContext = createContext<CurrentPostContextValue | null>(null)

export function CurrentPostProvider({
  value,
  children,
}: {
  value: CurrentPostContextValue
  children: React.ReactNode
}) {
  return (
    <CurrentPostContext.Provider value={value}>
      {children}
    </CurrentPostContext.Provider>
  )
}

export function useCurrentPostData(): CurrentPostContextValue | null {
  return use(CurrentPostContext)
}
