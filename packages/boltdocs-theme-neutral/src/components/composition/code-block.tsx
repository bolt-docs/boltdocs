import type { ComponentProps, HTMLAttributes, ReactNode, Ref } from 'react'
import { Button } from '@bdocs/primitives'
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
        'bdocs-code boltdocs-code-block',
        !plain && 'bdocs-code--framed',
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
    <div className={cn('bdocs-code__header', className)} {...props}>
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
    <div className={cn('bdocs-code__group', className)} {...props}>
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
    <div className={cn('bdocs-code__actions', className)} {...props}>
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
        'bdocs-code__content',
        shouldTruncate && 'bdocs-code__content--truncated',
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
        className={cn('bdocs-code__shiki', className)}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        {...props}
      />
    )
  }

  return (
    <pre
      ref={ref as Ref<HTMLPreElement>}
      className={cn(
        'bdocs-code__pre',
        isHighlighted
          ? 'bdocs-code__pre--highlighted'
          : 'bdocs-code__pre--plain',
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
        shouldTruncate
          ? 'bdocs-code__fade bdocs-code__fade--overlay'
          : 'bdocs-code__fade bdocs-code__fade--inline',
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
        className={cn('bdocs-code__expand', buttonClassName)}
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
