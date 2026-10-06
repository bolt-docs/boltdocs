import { cn } from '../../utils/cn'

export interface CardsProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4
}

/**
 * A grid of cards.
 *
 * `data-cols` instead of a class per case. Four conditional utility strings
 * meant the responsive staircase lived in JSX, where a theme cannot restyle it
 * and a fifth column would need another branch. Here it is four rules.
 */
export function Cards({ children, className, cols = 2, ...props }: CardsProps) {
  return (
    <div className={cn('bdocs-cards', className)} data-cols={cols} {...props}>
      {children}
    </div>
  )
}
