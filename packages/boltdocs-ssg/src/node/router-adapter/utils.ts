import type { HelmetServerState } from 'react-helmet-async'
import type { StyleCollector } from '../../types'

/**
 * The server-side Helmet context.
 *
 * This used to be `FilledContext`, imported from `react-helmet-async` — a type
 * that package has never exported. The import resolved because the names were
 * structurally compatible enough for the uses, and `tsc` rejected it only when
 * someone actually ran a typecheck on this package, which nothing did.
 *
 * `HelmetProvider` takes `{ context?: { helmet?: HelmetServerState } }`, so this
 * is that shape, written down. Declaring it here also means a Helmet upgrade
 * that reshapes its server state fails here, at the one place that reads it,
 * instead of at every `.toString()`.
 */
export interface FilledHelmetContext {
  helmet: HelmetServerState
}

export function extractHelmet(
  html: string,
  context: FilledHelmetContext,
  styleCollector: StyleCollector | null,
) {
  const { helmet } = context
  const htmlAttributes = helmet.htmlAttributes.toString()
  const bodyAttributes = helmet.bodyAttributes.toString()
  let titleString = helmet.title.toString()
  if (titleString.split('>')[1] === '</title') {
    titleString = ''
  }
  const metaStrings = [
    titleString,
    helmet.meta.toString(),
    helmet.link.toString(),
    helmet.script.toString(),
  ]
  const styleTag = styleCollector?.toString?.(html) ?? ''
  const metaAttributes = metaStrings.filter(Boolean)

  return { htmlAttributes, bodyAttributes, metaAttributes, styleTag }
}
