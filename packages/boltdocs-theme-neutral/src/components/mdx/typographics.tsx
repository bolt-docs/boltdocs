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

/*
 * A heading carries no class of its own here. Sizes, rhythm and the anchor glyph
 * belong to `heading.css`, which keys on the primitive's `data-level`, so a site
 * retunes headings in CSS instead of asking every MDX file to stop passing a
 * class list. The utility map that used to sit in this file was dead code — the
 * `Heading` below never read it — and it was the last place the theme's headings
 * depended on a Tailwind build.
 */
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
