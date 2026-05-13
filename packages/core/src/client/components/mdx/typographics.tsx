import { Link } from '../primitives/link'
import { cn } from '../../utils/cn'
import { Heading as HeadingPrimitive } from '../primitives/heading'

const Anchor = ({
  href,
  children,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  return (
    <Link
      href={href || ''}
      className={cn(
        'text-primary-500 hover:text-primary-400 dark:text-primary-500 hover:underline font-medium transition-colors duration-200',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  )
}

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-3xl sm:text-[2.5rem] font-extrabold tracking-tight text-body mb-4 leading-tight',
  2: 'text-2xl sm:text-[1.75rem] font-bold tracking-tight text-body mt-14 mb-5 pb-2 border-b border-subtle scroll-mt-24',
  3: 'text-lg sm:text-[1.4rem] font-semibold tracking-tight text-body mt-10 mb-4 scroll-mt-24',
  4: 'text-base sm:text-[1.1rem] font-semibold tracking-tight text-body mt-8 mb-3 scroll-mt-24',
  5: 'text-sm sm:text-[0.9rem] font-semibold tracking-tight text-body mt-6 mb-2 scroll-mt-24',
  6: 'text-xs sm:text-[0.75rem] font-semibold tracking-tight text-body mt-6 mb-2 scroll-mt-24',
}

const Heading = ({
  level,
  className,
  ...props
}: React.ComponentProps<typeof HeadingPrimitive>) => {
  const headingClass = HEADING_CLASSES[level] || ''
  return (
    <HeadingPrimitive
      level={level}
      className={cn(headingClass, className)}
      {...props}
    />
  )
}

export const Typographics = {
  a: Anchor,
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <Heading level={1} {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <Heading level={2} {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <Heading level={3} {...props} />
  ),
  h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <Heading level={4} {...props} />
  ),
  h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <Heading level={5} {...props} />
  ),
  h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <Heading level={6} {...props} />
  ),
  p: ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p
      className={cn('text-paragraph leading-relaxed my-5', className)}
      {...props}
    />
  ),
  strong: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className={cn('font-semibold text-body', className)} {...props} />
  ),
  mark: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <mark
      className={cn(
        'bg-primary-500/10 text-primary-500 font-semibold px-1.5 py-0.5 rounded-md',
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className={cn(
        'border-l-4 border-primary-500 bg-soft/30 pl-4 py-2 my-6 italic text-muted rounded-r-lg',
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className={cn('my-8 border-t border-subtle', className)} {...props} />
  ),
  ul: ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className={cn('list-disc pl-6 my-5 space-y-2 text-paragraph', className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className={cn(
        'list-decimal pl-6 my-5 space-y-2 text-paragraph',
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className={cn('pl-1', className)} {...props} />
  ),
}
