import { cn } from '../../utils/cn'

export interface CardsProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4
}

export function Cards({ children, className, cols = 2, ...props }: CardsProps) {
  return (
    <div
      className={cn(
        'grid gap-4 my-6',
        {
          'grid-cols-1': cols === 1,
          'grid-cols-1 sm:grid-cols-2': cols === 2,
          'grid-cols-1 sm:grid-cols-2 md:grid-cols-3': cols === 3,
          'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4': cols === 4,
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default Cards
