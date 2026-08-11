import type { StructuredData as StructuredDataValue } from '../../shared/types'
export type {
  ArticleStructuredDataOptions,
  BreadcrumbStructuredDataItem,
  StructuredDataFactoryOptions,
  WebSiteStructuredDataOptions,
} from '../../shared/structured-data'

export {
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  createStructuredData,
  createWebSiteStructuredData,
  defineStructuredData,
} from '../../shared/structured-data'

export interface StructuredDataProps {
  data: StructuredDataValue
  id?: string
}

/**
 * Renders safe, valid JSON-LD. Escaping `<` prevents a JSON value from closing
 * the surrounding script tag when the document is rendered server-side.
 */
export function StructuredData({ data, id }: StructuredDataProps) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')

  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
