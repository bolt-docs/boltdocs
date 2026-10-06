import { Link } from '../composition/link'
import { cn } from '../../utils/cn'
import { Heading as HeadingPrimitive } from '../composition/heading'

const Anchor = ({
  href,
  children,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  return (
    <Link
      href={href || ''}
      className={cn('bdocs-prose-link', className)}
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
  return <HeadingPrimitive level={level} className={className} {...props} />
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
    <p className={cn('bdocs-prose-p', className)} {...props} />
  ),
  strong: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className={cn('bdocs-prose-strong', className)} {...props} />
  ),
  mark: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <mark className={cn('bdocs-prose-mark', className)} {...props} />
  ),
  code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code className={cn('bdocs-prose-code', className)} {...props} />
  ),
  blockquote: ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className={cn('bdocs-prose-quote', className)} {...props} />
  ),
  hr: ({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className={cn('bdocs-prose-rule', className)} {...props} />
  ),
  ul: ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      className={cn('bdocs-prose-list bdocs-prose-list--disc', className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      className={cn('bdocs-prose-list bdocs-prose-list--decimal', className)}
      {...props}
    />
  ),
  li: ({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className={cn('bdocs-prose-item', className)} {...props} />
  ),
}
