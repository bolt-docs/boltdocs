import { useCallback, useRef, type ReactNode, type RefObject } from 'react'
import { defaultNavigate, useNavigate } from '@bdocs/runtime'
import {
  getItemId,
  ScrollSpyProvider,
  useActiveAnchors,
  useActiveIndicator,
  useAnchorNavigation,
  useAnchorScroll,
  useScrollSpyItems,
} from '@bdocs/primitives'
import { cn } from '../utils/cn'
import type { ComponentBase } from './types'

/**
 * The table of contents as a thin theming layer.
 *
 * Scroll-spy, active-item selection, indicator geometry and anchor navigation
 * all live in `@bdocs/primitives`. This file contributes the `bdocs-toc__*`
 * classes, the accessible label and the provider wiring to the runtime router.
 */

export type TOCItemType = {
  title: ReactNode
  url: string
  depth: number
  _step?: number
}
export type TableOfContents = TOCItemType[]
export type TOCItemInfo = {
  id: string
  active: boolean
  fallback: boolean
  t: number
  original?: TOCItemType
}

export interface AnchorProviderProps {
  toc: TOCItemType[]
  single?: boolean
  observerOptions?: IntersectionObserverInit
  children?: ReactNode
}

export interface ScrollProviderProps {
  containerRef: RefObject<HTMLElement | null>
  children?: ReactNode
}

export interface OnThisPageContentProps extends ComponentBase {
  ref?: React.Ref<HTMLDivElement>
  scrollRef?: RefObject<HTMLElement | null>
  fadeClassName?: string
  innerClassName?: string
}

export interface OnThisPageItemProps extends ComponentBase {
  level?: number
}

export interface OnThisPageLinkProps extends ComponentBase {
  href?: string
  active?: boolean
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
}

export interface OnThisPageIndicatorProps extends ComponentBase {
  style?: React.CSSProperties
}

/** Backwards-compatible alias: the hook now comes from the primitive. */
export const useItems = useScrollSpyItems
export { useActiveAnchor, useActiveAnchors } from '@bdocs/primitives'

/**
 * Kept for API compatibility. The scroll container is passed directly to the
 * primitive hooks now, so this provider is intentionally a passthrough.
 */
export function ScrollProvider({ children }: ScrollProviderProps) {
  return <>{children}</>
}

export function AnchorProvider({
  toc,
  single = false,
  observerOptions,
  children,
}: AnchorProviderProps) {
  return (
    <ScrollSpyProvider
      items={toc}
      single={single}
      observerOptions={observerOptions}
    >
      {children}
    </ScrollSpyProvider>
  )
}

export function OnThisPage({
  children,
  className,
  label = 'On this page',
}: ComponentBase & { label?: string }) {
  return (
    <nav
      data-otp-root
      aria-label={label}
      className={cn('bdocs-toc__root', className)}
    >
      {children}
    </nav>
  )
}

function OnThisPageHeader({ children, className, ...props }: ComponentBase) {
  return (
    <div className={cn('bdocs-toc__header', className)} {...props}>
      {children}
    </div>
  )
}

function OnThisPageContent({
  children,
  className,
  ref,
  fadeClassName,
  innerClassName,
  ...props
}: OnThisPageContentProps) {
  const internalRef = useRef<HTMLDivElement>(null)
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  return (
    <div
      ref={setRefs}
      data-otp-content
      className={cn('bdocs-toc', className)}
      {...props}
    >
      <div className={cn('bdocs-toc__inner', innerClassName)}>{children}</div>
      <div
        aria-hidden="true"
        data-otp-fade
        className={cn('bdocs-toc__fade', fadeClassName)}
      />
    </div>
  )
}

OnThisPageContent.displayName = 'OnThisPageContent'

function OnThisPageList({ children, className }: ComponentBase) {
  return (
    <ul data-otp-list className={cn('bdocs-toc__list', className)}>
      {children}
    </ul>
  )
}

function OnThisPageItem({ level, children, className }: OnThisPageItemProps) {
  return (
    <li
      data-level={level || undefined}
      className={cn('bdocs-toc__item', className)}
    >
      {children}
    </li>
  )
}

function OnThisPageLink({
  children,
  href,
  active,
  onClick,
  className,
}: OnThisPageLinkProps) {
  const navigate = useNavigate()
  const id = href ? getItemId(href) : null
  const anchorRef = useRef<HTMLAnchorElement>(null)

  const activeIds = useActiveAnchors()
  const computedActive =
    active !== undefined ? active : id ? activeIds.includes(id) : false

  useAnchorScroll(anchorRef, computedActive)

  // Only a real SPA router should intercept a hash link; the default no-op
  // router must leave native hash navigation alone.
  const handleClick = useAnchorNavigation(
    href,
    navigate !== defaultNavigate ? navigate : undefined,
    onClick,
  )

  return (
    <a
      ref={anchorRef}
      href={href}
      onClick={handleClick}
      data-active={computedActive || undefined}
      aria-current={computedActive ? 'location' : undefined}
      className={cn('bdocs-toc__link', className)}
    >
      {children}
    </a>
  )
}

function OnThisPageIndicator({ style, className }: OnThisPageIndicatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const internalStyle = useActiveIndicator(containerRef, style)

  return (
    <div
      ref={containerRef}
      data-otp-indicator
      aria-hidden="true"
      className={cn('bdocs-toc__indicator', className)}
      style={{
        transition:
          'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), height 180ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 150ms',
        ...internalStyle,
      }}
    />
  )
}

export function OnThisPageItems({
  headings = [],
  className,
  itemClassName,
  linkClassName,
  indicatorClassName,
}: {
  headings: { level: number; text: string; id: string }[]
} & ComponentBase & {
    itemClassName?: string
    linkClassName?: string
    indicatorClassName?: string
  }) {
  const activeIds = useActiveAnchors()
  if (headings.length === 0) return null

  return (
    <>
      {/* Outside the <ul>: a list may only contain <li> children (axe `list`). */}
      <OnThisPageIndicator className={indicatorClassName} />
      <OnThisPageList className={className}>
        {headings.map((h) => (
          <OnThisPageItem key={h.id} level={h.level} className={itemClassName}>
            <OnThisPageLink
              href={`#${h.id}`}
              active={activeIds.includes(h.id)}
              className={linkClassName}
            >
              {h.text}
            </OnThisPageLink>
          </OnThisPageItem>
        ))}
      </OnThisPageList>
    </>
  )
}

export function OnThisPageTree({
  headings = [],
  className,
  itemClassName,
  linkClassName,
  indicatorClassName,
  fadeClassName,
  contentClassName,
}: {
  headings: { level: number; text: string; id: string }[]
} & ComponentBase & {
    itemClassName?: string
    linkClassName?: string
    indicatorClassName?: string
    fadeClassName?: string
    contentClassName?: string
  }) {
  const toc = Array.isArray(headings)
    ? headings.map((h) => ({ title: h.text, url: `#${h.id}`, depth: h.level }))
    : []
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  if (headings.length === 0) return null

  return (
    <AnchorProvider toc={toc} single>
      <ScrollProvider containerRef={scrollContainerRef}>
        <OnThisPageContent
          ref={scrollContainerRef}
          fadeClassName={fadeClassName}
          className={contentClassName}
        >
          <OnThisPageItems
            headings={headings}
            className={className}
            itemClassName={itemClassName}
            linkClassName={linkClassName}
            indicatorClassName={indicatorClassName}
          />
        </OnThisPageContent>
      </ScrollProvider>
    </AnchorProvider>
  )
}

OnThisPage.Root = OnThisPage
OnThisPage.Header = OnThisPageHeader
OnThisPage.Content = OnThisPageContent
OnThisPage.List = OnThisPageList
OnThisPage.Item = OnThisPageItem
OnThisPage.Link = OnThisPageLink
OnThisPage.Indicator = OnThisPageIndicator
OnThisPage.Items = OnThisPageItems
OnThisPage.Tree = OnThisPageTree

export default OnThisPage
