const searchData: any[] = [
  {
    id: '/docs/intro',
    title: 'Introduction',
    content: 'This is the introduction content and setup.',
    url: '/docs/intro',
    display: 'Getting Started > Introduction',
    locale: 'en',
  },
  {
    id: '/docs/advanced',
    title: 'Advanced Config',
    content: 'This details configuration options.',
    url: '/docs/advanced',
    display: 'Guides > Advanced Config',
    locale: 'en',
  },
]

export default async function fetchSearchData() {
  return searchData
}
