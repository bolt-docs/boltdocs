import { Field } from './field'
import { Typographics } from './typographics'
import { TableComponents } from './table'
import { Callout } from './callout'
import { CodeBlock } from './code-block'
import { ImageComponents } from './image'
import { Card } from './card'
import { Cards } from './cards'

export const mdx_components_default = {
  ...Typographics,
  ...TableComponents,
  ...ImageComponents,
  pre: CodeBlock,
  Field,
  Callout,
  Card,
  Cards,
}
