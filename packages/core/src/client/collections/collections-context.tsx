import { createContext, use } from 'react'

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
}

export type CollectionsData = Record<string, CollectionPost[]>

export const CollectionsContext = createContext<CollectionsData>({})

export function useCollectionsData(): CollectionsData {
  return use(CollectionsContext)
}
