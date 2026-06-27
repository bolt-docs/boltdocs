import { createContext, use } from 'react'
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
}

export type CollectionsData = Record<string, CollectionPost[]>

export const CollectionsContext = createContext<CollectionsData>({})

export function useCollectionsData(): CollectionsData {
  return use(CollectionsContext)
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
