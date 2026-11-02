import { NotFound } from './components/ui-base/not-found'
import { mdx_components_default } from './components/mdx/index'

export const mdxComponentsDefault = {
  ...mdx_components_default,
  NotFound,
  '404': NotFound,
}
