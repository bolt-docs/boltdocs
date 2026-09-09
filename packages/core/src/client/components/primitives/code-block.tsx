import type { ComponentProps, HTMLAttributes, ReactNode, Ref } from 'react'
import { Button } from 'react-aria-components'
import { cn } from '../../utils/cn'

interface CodeBlockRootProps extends ComponentProps<'div'> {
  /**
   * Whether the code block is in plain mode (no borders/padding)
   * @default false
   */
  plain?: boolean
}

export interface CodeBlockHeaderProps extends ComponentProps<'div'> {}
export interface CodeBlockGroupProps extends ComponentProps<'div'> {}
export interface CodeBlockContentProps extends ComponentProps<'div'> {
  /**
   * Whether the code content should be truncated with an expand button
   * @default false
   */
  shouldTruncate?: boolean
}
export interface CodeBlockActionsProps extends ComponentProps<'div'> {}
export interface CodeBlockPreProps
  extends Omit<
    HTMLAttributes<HTMLElement>,
    'children' | 'className' | 'dangerouslySetInnerHTML'
  > {
  className?: string
  children?: ReactNode
  /**
   * Pre-rendered Shiki HTML. When provided, renders the Shiki wrapper div
   * instead of a raw `<pre>`.
   */
  highlightedHtml?: string
  /**
   * Whether the code is Shiki-highlighted (adjusts inner padding).
   */
  isHighlighted?: boolean
  ref?: Ref<HTMLElement>
}
export interface CodeBlockExpandProps extends ComponentProps<'div'> {
  isExpandable: boolean
  shouldTruncate: boolean
  isExpanded: boolean
  onToggle: () => void
  buttonClassName?: string
  /** Custom label when collapsed (defaults to "Expand code"). */
  expandLabel?: ReactNode
  /** Custom label when expanded (defaults to "Show less"). */
  collapseLabel?: ReactNode
  /** Custom leading icon for the toggle button. */
  expandIcon?: ReactNode
}

/**
 * Root component for code blocks.
 * Handles background, borders, and general layout.
 */
function CodeBlock({
  children,
  className,
  plain = false,
  ...props
}: CodeBlockRootProps) {
  return (
    <div
      className={cn(
        'not-prose boltdocs-code-block',
        'group relative overflow-hidden bg-(--color-code-bg)',
        'contain-layout contain-paint',
        {
          'my-6 rounded-xl border border-subtle': !plain,
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Header section of the code block.
 * Usually contains the title, language label, and action buttons.
 */
function CodeBlockHeader({
  children,
  className,
  ...props
}: CodeBlockHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-9 items-center justify-between px-4 py-1.5',
        'text-[13px] font-medium text-muted',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Horizontal group for organizing items within the header (e.g., logo + label).
 */
function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div className={cn('flex items-center space-x-2', className)} {...props}>
      {children}
    </div>
  )
}

/**
 * Trailing action area in the header (copy, feedback, custom actions).
 */
function CodeBlockActions({
  children,
  className,
  ...props
}: CodeBlockActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 bg-(--color-code-bg) pl-2 z-10',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Content area of the code block.
 * Wraps the `<pre>` or `<div>` containing the code.
 */
function CodeBlockContent({
  className,
  children,
  shouldTruncate = false,
  ...props
}: CodeBlockContentProps) {
  return (
    <div
      className={cn(
        'relative',
        {
          '[&>pre]:max-h-[300px] [&>pre]:overflow-hidden [&>div>pre]:max-h-[300px] [&>div>pre]:overflow-hidden':
            shouldTruncate,
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * The code area itself. Renders pre-rendered Shiki HTML when `highlightedHtml`
 * is provided, otherwise a plain `<pre>` with the default code styling.
 */
function CodeBlockPre({
  className,
  highlightedHtml,
  isHighlighted = false,
  ref,
  children,
  ...props
}: CodeBlockPreProps) {
  if (highlightedHtml) {
    return (
      <div
        ref={ref as Ref<HTMLDivElement>}
        className={cn('shiki-wrapper overflow-x-auto', className)}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        {...props}
      />
    )
  }

  return (
    <pre
      ref={ref as Ref<HTMLPreElement>}
      className={cn(
        'm-0 rounded-none border-none bg-transparent',
        'text-[0.875rem] leading-[1.6] overflow-x-auto',
        {
          'p-0 [&>code]:grid [&>code]:p-5 [&>code]:bg-transparent [&>code]:whitespace-pre':
            isHighlighted,
          'p-5': !isHighlighted,
        },
        className,
      )}
      {...props}
    >
      {children}
    </pre>
  )
}

/**
 * Expand / collapse region for long code blocks. Renders nothing when the
 * block is not expandable.
 */
function CodeBlockExpand({
  className,
  buttonClassName,
  isExpandable,
  shouldTruncate,
  isExpanded,
  onToggle,
  expandLabel = 'Expand code',
  collapseLabel = 'Show less',
  expandIcon,
  ...props
}: CodeBlockExpandProps) {
  if (!isExpandable) return null

  return (
    <div
      className={cn(
        {
          'absolute bottom-0 inset-x-0 h-32 flex items-end justify-center pb-4 z-10':
            shouldTruncate,
          'relative flex justify-center pb-4 pt-1 -mt-4': !shouldTruncate,
        },
        className,
      )}
      style={
        shouldTruncate
          ? {
              backgroundImage:
                'linear-gradient(to top, var(--color-code-bg) 10%, transparent)',
            }
          : undefined
      }
      {...props}
    >
      <Button
        onPress={onToggle}
        className={cn(
          'inline-flex items-center gap-2 rounded-full bg-surface border border-subtle px-5 py-2 text-[0.8125rem] font-medium text-body outline-none cursor-pointer transition-all hover:bg-soft hover:-translate-y-px backdrop-blur-md',
          buttonClassName,
        )}
      >
        {expandIcon}
        {isExpanded ? collapseLabel : expandLabel}
      </Button>
    </div>
  )
}

// Assign sub-components
CodeBlock.Header = CodeBlockHeader
CodeBlock.Group = CodeBlockGroup
CodeBlock.Actions = CodeBlockActions
CodeBlock.Content = CodeBlockContent
CodeBlock.Pre = CodeBlockPre
CodeBlock.Expand = CodeBlockExpand

export {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockGroup,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockPre,
  CodeBlockExpand,
}
