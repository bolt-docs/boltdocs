declare module 'virtual:boltdocs-page-source' {
  const fetchPageSource: (options?: {
    bustCache?: boolean
  }) => Promise<Record<string, string>>
  export default fetchPageSource
}
