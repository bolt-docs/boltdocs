import { Field } from './field'
import { Typographics } from './typographics'
import { TableComponents } from './table'
import { Callout } from './callout'
import { CodeBlock } from './code-block'
import { ImageComponents } from './image'
import { Card } from './card'
import { Cards } from './cards'
import { LastUpdated } from './last-updated'
import { Timeline } from './timeline'

export const mdx_components_default = {
  ...Typographics,
  ...TableComponents,
  ...ImageComponents,
  LastUpdated,
  pre: CodeBlock,
  Field,
  Callout,
  Card,
  Cards,
  Timeline,
}
