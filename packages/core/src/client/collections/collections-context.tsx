import { createContext, useContext } from 'react'

export interface CollectionPost {
  path: string
  title: string
  date?: string | Date
  excerpt?: string
  tags?: string[]
  author?: string
  coverImage?: string
  filePath: string
  frontmatter?: Record<string, any>
}

export type CollectionsData = Record<string, CollectionPost[]>

export const CollectionsContext = createContext<CollectionsData>({})

export function useCollectionsData(): CollectionsData {
  return useContext(CollectionsContext)
}
