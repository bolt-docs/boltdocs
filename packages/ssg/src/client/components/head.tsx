import type { ReactNode } from 'react'
import type { ComponentType } from 'react'
import type { HelmetProps } from 'react-helmet-async'
import * as ReactHelmetAsync from 'react-helmet-async'

type HelmetModule = {
  Helmet?: ComponentType<HelmetProps>
  default?: { Helmet?: ComponentType<HelmetProps> }
}
const helmetModule = ReactHelmetAsync as unknown as HelmetModule
const Helmet =
  helmetModule.Helmet || helmetModule.default?.Helmet || (() => null)

export type Props = HelmetProps & { children: ReactNode }

export default function Head(props: Props): React.ReactNode {
  return <Helmet {...props} />
}
