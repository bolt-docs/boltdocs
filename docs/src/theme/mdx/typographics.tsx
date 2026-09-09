import { Link } from 'boltdocs/primitives'
import { cn } from 'boltdocs/client'
import { Heading as HeadingPrimitive } from 'boltdocs/primitives'

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
        'font-medium text-primary-400 underline-offset-3 transition-colors duration-150 hover:text-primary-300 hover:underline',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  )
}

const HEADING_CLASSES: Record<number, string> = {
  1: 'text-(--text-h1) leading-(--text-h1--line-height) font-bold tracking-tight text-body mt-8 mb-6 scroll-mt-[calc(var(--spacing-navbar)+1.5rem)]',
  2: 'text-(--text-h2) leading-(--text-h2--line-height) font-semibold tracking-tight text-body mt-14 mb-5 pb-2.5 border-b border-subtle scroll-mt-[calc(var(--spacing-navbar)+1.5rem)]',
  3: 'text-(--text-h3) leading-(--text-h3--line-height) font-semibold tracking-tight text-body mt-11 mb-4 scroll-mt-[calc(var(--spacing-navbar)+1.5rem)]',
  4: 'text-(--text-h4) leading-(--text-h4--line-height) font-semibold tracking-tight text-body mt-8 mb-3 scroll-mt-[calc(var(--spacing-navbar)+1.5rem)]',
  5: 'text-base font-semibold tracking-tight text-body mt-6 mb-2 scroll-mt-[calc(var(--spacing-navbar)+1.5rem)]',
  6: 'text-base font-semibold tracking-tight text-body mt-6 mb-2 scroll-mt-[calc(var(--spacing-navbar)+1.5rem)]',
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
      className={cn('text-paragraph leading-[1.75] mb-[4.5', className)}
      {...props}
    />
  ),
  strong: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className={cn('font-semibold text-body', className)} {...props} />
  ),
  em: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em className={cn('italic', className)} {...props} />
  ),
  mark: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <mark
      className={cn(
        'font-semibold bg-primary-500/10 text-primary-400 px-1.5 py-0.5 rounded-md',
        className,
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code
      className={cn(
        'font-mono text-[0.85em] whitespace-nowrap bg-soft text-body border border-subtle rounded-sm px-1.5 py-0.5',
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
        'my-8 px-5 py-3 border-l-2 border-primary-500 bg-primary-500/6 rounded-r-md text-body [&_p]:mb-0 [&_p+p]:mt-3',
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className={cn('my-12 border-t border-subtle', className)} {...props} />
  ),
  ul: ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className={cn(
        'my-4 mb-6 pl-6 grid gap-1.5 list-none prose-ul-dot',
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className={cn(
        'my-4 mb-6 pl-6 grid gap-1.5 list-decimal [&>li::marker]:text-muted [&>li::marker]:font-medium',
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li
      className={cn(
        '[&>ul]:mt-1.5 [&>ul]:mb-2 [&>ol]:mt-1.5 [&>ol]:mb-2',
        className,
      )}
      {...props}
    />
  ),
  img: ({
    className,
    alt = '',
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img className={cn('rounded-lg', className)} alt={alt} {...props} />
  ),
  figure: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <figure className={cn('my-10', className)} {...props} />
  ),
  figcaption: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <figcaption
      className={cn('mt-3 text-center text-caption-s text-muted', className)}
      {...props}
    />
  ),
}
