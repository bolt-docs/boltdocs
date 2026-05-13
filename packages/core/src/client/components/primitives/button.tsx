import * as RAC from 'react-aria-components'
export interface ButtonProps extends RAC.ButtonProps {}

export const Button = ({ ...props }: ButtonProps) => {
  return <RAC.Button {...props} />
}
