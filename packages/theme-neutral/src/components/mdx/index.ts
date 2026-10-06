import { Field } from './field'
import { Typographics } from './typographics'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from './table'
import { Callout } from './callout'
import { CodeBlock } from './code-block'
import { ImageComponents } from './image'
import { Card } from './card'
import { Cards } from './cards'

export const mdx_components_default = {
  ...Typographics,
  table: Table,
  thead: TableHead,
  tbody: TableBody,
  tr: TableRow,
  th: TableHeader,
  td: TableCell,
  ...ImageComponents,
  pre: CodeBlock,
  Field,
  Callout,
  Card,
  Cards,
}
