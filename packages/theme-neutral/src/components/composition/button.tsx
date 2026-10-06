import {
  Button as PrimitivesButton,
  type ButtonProps as PrimitivesButtonProps,
} from '@bdocs/primitives'

export interface ButtonProps extends PrimitivesButtonProps {}

/**
 * A button.
 *
 * `type` defaults to `button` rather than `submit`, so a button inside a form
 * cannot submit it by accident.
 */
export function Button(props: ButtonProps) {
  return <PrimitivesButton {...props} />
}
