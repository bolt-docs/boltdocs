import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import scrollIntoView from 'scroll-into-view-if-needed'
import { defaultNavigate, useNavigate } from '../../router'
import { cn } from '../../utils/cn'
import type { ComponentBase } from './types'
import { getItemId, Observer } from './helpers/observer'

export interface TOCItemType {
  title: ReactNode
  url: string
  depth: number
  _step?: number
}

export type TableOfContents = TOCItemType[]

export interface TOCItemInfo {
  id: string
  active: boolean
  /** last time the item is updated */
  t: number
  /** currently active but not intersecting in viewport */
  fallback: boolean
  original?: TOCItemType
}

export interface AnchorProviderProps {
  toc: TOCItemType[]
  /**
   * Only accept one active item at most
   * @defaultValue false
   */
  single?: boolean
  /**
   * Custom IntersectionObserver options
   */
  observerOptions?: IntersectionObserverInit
  children?: ReactNode
}

export interface ScrollProviderProps {
  /**
   * Scroll into the view of container when active
   */
  containerRef: RefObject<HTMLElement | null>
  children?: ReactNode
}

export interface OnThisPageContentProps extends ComponentBase {
  ref?: React.Ref<HTMLDivElement>
  scrollRef?: RefObject<HTMLElement | null>
  /** Class applied to the bottom fade element (theme-owned). */
  fadeClassName?: string
  /** Class applied to the inner content wrapper (`relative z-10`). */
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

const ItemsContext = createContext<TOCItemInfo[] | null>(null)
const ScrollContext = createContext<RefObject<HTMLElement | null> | null>(null)

export function useItems() {
  const ctx = use(ItemsContext)
  if (!ctx)
    throw new Error(
      `Component must be used under the <AnchorProvider /> component.`,
    )
  return ctx
}

export function useActiveAnchor(): string | undefined {
  const items = useItems()
  return useMemo(() => {
    let out: TOCItemInfo | undefined
    for (const item of items) {
      if (!item.active) continue
      if (!out || item.t > out.t) {
        out = item
      }
    }
    return out?.id
  }, [items])
}

export function useActiveAnchors(): string[] {
  const items = useItems()
  return useMemo(() => {
    const out: string[] = []
    for (const item of items) {
      if (item.active) out.push(item.id)
    }
    return out
  }, [items])
}

/** Optional: add auto-scroll to TOC items. */
export function ScrollProvider({
  containerRef,
  children,
}: ScrollProviderProps) {
  return (
    <ScrollContext.Provider value={containerRef}>
      {children}
    </ScrollContext.Provider>
  )
}

export function AnchorProvider({
  toc,
  single = false,
  observerOptions,
  children,
}: AnchorProviderProps) {
  const observer = useMemo(() => new Observer(), [])
  const [items, setItems] = useState<TOCItemInfo[]>(observer.items)

  observer.single = single
  useEffect(() => {
    observer.setItems(toc)
  }, [observer, toc])

  useEffect(() => {
    // We use a rootMargin that acts as an activation "line" near the top.
    // headings are "intersecting" (active=true) when they are BELOW this line.
    // Default to a more permissive margin for detecting visible headings
    const defaultOptions = {
      rootMargin: '-80px 0% -60% 0%',
      threshold: 0,
    }
    const options = observerOptions
      ? { ...defaultOptions, ...observerOptions }
      : defaultOptions

    observer.watch(options)
    observer.onChange = () => setItems([...observer.items])

    return () => {
      observer.unwatch()
    }
  }, [observer, observerOptions])

  return <ItemsContext.Provider value={items}>{children}</ItemsContext.Provider>
}

export function OnThisPage({ children, className }: ComponentBase) {
  return (
    <nav data-otp-root className={className}>
      {children}
    </nav>
  )
}

function OnThisPageHeader({ children, className, ...props }: ComponentBase) {
  return (
    <div className={className} {...props}>
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
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref],
  )

  return (
    <div
      ref={setRefs}
      data-otp-content
      className={cn('relative isolate overflow-y-auto', className)}
      {...props}
    >
      <div className={cn('relative z-10', innerClassName)}>{children}</div>
      <div
        aria-hidden="true"
        data-otp-fade
        className={cn(
          'pointer-events-none sticky bottom-0 z-0 -mt-10 h-10 w-full',
          fadeClassName,
        )}
      />
    </div>
  )
}

OnThisPageContent.displayName = 'OnThisPageContent'

function OnThisPageList({ children, className }: ComponentBase) {
  return (
    <ul data-otp-list className={cn('relative', className)}>
      {children}
    </ul>
  )
}

function OnThisPageItem({ level, children, className }: OnThisPageItemProps) {
  return (
    <li data-level={level || undefined} className={className}>
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
  const items = use(ItemsContext)
  const containerRef = use(ScrollContext)
  const navigate = useNavigate()
  const id = href ? getItemId(href) : null
  const anchorRef = useRef<HTMLAnchorElement>(null)

  const computedActive =
    active !== undefined
      ? active
      : id && items
        ? !!items.find((i) => i.id === id)?.active
        : false

  useEffect(() => {
    if (computedActive && anchorRef.current && containerRef?.current) {
      scrollIntoView(anchorRef.current, {
        behavior: 'auto',
        block: 'center',
        inline: 'center',
        scrollMode: 'if-needed',
        boundary: containerRef.current,
      })
    }
  }, [computedActive, containerRef])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e)
      return
    }
    if (href) {
      const elementId = href.includes('#') ? href.split('#')[1] : null
      if (elementId && navigate !== defaultNavigate) {
        e.preventDefault()
        navigate(href)
      }
    }
  }

  return (
    <a
      ref={anchorRef}
      href={href}
      onClick={handleClick}
      data-active={computedActive || undefined}
      aria-current={computedActive ? 'true' : undefined}
      className={className}
    >
      {children}
    </a>
  )
}

function OnThisPageIndicator({ style, className }: OnThisPageIndicatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [internalStyle, setInternalStyle] = useState<React.CSSProperties>({
    opacity: 0,
    ...style,
  })

  const items = useItems()

  useEffect(() => {
    if (items.length === 0) return

    const parent = containerRef.current?.parentElement
    if (!parent) return

    const activeLinks = parent.querySelectorAll('a[data-active="true"]')

    if (activeLinks.length > 0) {
      const firstActiveLink = activeLinks[0] as HTMLElement
      const lastActiveLink = activeLinks[activeLinks.length - 1] as HTMLElement

      const firstRect = firstActiveLink.getBoundingClientRect()
      const lastRect = lastActiveLink.getBoundingClientRect()
      const parentRect = parent.getBoundingClientRect()

      const offsetTop = firstRect.top - parentRect.top
      const height = lastRect.bottom - firstRect.top

      setInternalStyle({
        transform: `translateY(${offsetTop}px)`,
        height: `${height}px`,
        opacity: 1,
        ...style,
      })
    } else {
      setInternalStyle({
        opacity: 0,
        ...style,
      })
    }
  }, [items, style])

  return (
    <div
      ref={containerRef}
      data-otp-indicator
      className={cn('absolute', className)}
      style={{
        transition:
          'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), height 180ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 150ms',
        ...internalStyle,
      }}
    />
  )
}

/**
 * High-level automated list of toc items
 */
export function OnThisPageItems({
  headings = [],
  className,
  itemClassName,
  linkClassName,
  indicatorClassName,
}: {
  headings: { level: number; text: string; id: string }[]
} & ComponentBase & {
    /** Class applied to each `<li>`. */
    itemClassName?: string
    /** Class applied to each `<a>`. Style states via `data-active`. */
    linkClassName?: string
    /** Class applied to the active-track indicator. */
    indicatorClassName?: string
  }) {
  const activeIds = useActiveAnchors()

  if (headings.length === 0) return null

  return (
    <OnThisPageList className={className}>
      <OnThisPageIndicator className={indicatorClassName} />
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
  )
}

/**
 * High-level automated Table of Contents tree
 */
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
    /** Class applied to each `<li>`. */
    itemClassName?: string
    /** Class applied to each `<a>`. Style states via `data-active`. */
    linkClassName?: string
    /** Class applied to the active-track indicator. */
    indicatorClassName?: string
    /** Class applied to the bottom fade element (theme-owned). */
    fadeClassName?: string
    /** Class applied to the scrollable content container. */
    contentClassName?: string
  }) {
  const toc = useMemo(
    () =>
      headings.map((h) => ({ title: h.text, url: `#${h.id}`, depth: h.level })),
    [headings],
  )

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  if (headings.length === 0) return null

  return (
    <AnchorProvider toc={toc} single={true}>
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
