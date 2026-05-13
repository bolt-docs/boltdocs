import {
  createContext,
  use,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import scrollIntoView from 'scroll-into-view-if-needed'
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
  }, [observer])

  return <ItemsContext.Provider value={items}>{children}</ItemsContext.Provider>
}

export const OnThisPage = ({ children, className }: ComponentBase) => {
  return (
    <nav
      className={cn(
        'sticky top-navbar hidden xl:flex flex-col shrink-0',
        'w-toc',
        'py-4 pl-6 pr-4',
        className,
      )}
    >
      {children}
    </nav>
  )
}

const OnThisPageHeader = ({ children, className, ...props }: ComponentBase) => {
  return (
    <div
      className={cn('mb-4 text-xs font-bold text-body', className)}
      {...props}
    >
      {children}
    </div>
  )
}

const OnThisPageContent = ({
  children,
  className,
  ref,
  ...props
}: OnThisPageContentProps) => {
  const internalRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => internalRef.current!)

  return (
    <div
      ref={internalRef}
      className={cn(
        'relative overflow-y-auto boltdocs-otp-content pb-12',
        'max-h-[70%]',
        className,
      )}
      style={{
        maskImage: 'linear-gradient(to bottom, black 90%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, black 90%, transparent 100%)',
      }}
      {...props}
    >
      {children}
    </div>
  )
}

OnThisPageContent.displayName = 'OnThisPageContent'

const OnThisPageList = ({ children, className }: ComponentBase) => {
  return (
    <ul
      className={cn(
        'relative space-y-0.5 text-sm border-l border-subtle',
        className,
      )}
    >
      {children}
    </ul>
  )
}

const OnThisPageItem = ({
  level,
  children,
  className,
}: OnThisPageItemProps) => {
  return <li className={cn(level === 3 && 'pl-3', className)}>{children}</li>
}

const OnThisPageLink = ({
  children,
  href,
  active,
  onClick,
  className,
}: OnThisPageLinkProps) => {
  const items = use(ItemsContext)
  const containerRef = use(ScrollContext)
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
        behavior: 'smooth',
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
    } else if (href && href.startsWith('#')) {
      e.preventDefault()
      const elementId = href.slice(1)
      const el = document.getElementById(elementId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        window.history.pushState(null, '', href)
      }
    }
  }

  return (
    <a
      ref={anchorRef}
      href={href}
      onClick={handleClick}
      data-active={computedActive}
      className={cn(
        'block py-0.5 pl-4 text-[13px] outline-none transition-colors',
        computedActive ? 'text-primary-500' : 'text-muted hover:text-body',
        className,
      )}
    >
      {children}
    </a>
  )
}

const OnThisPageIndicator = ({
  style,
  className,
}: OnThisPageIndicatorProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [internalStyle, setInternalStyle] = useState<React.CSSProperties>({
    opacity: 0,
    ...style,
  })

  const items = useItems()

  useEffect(() => {
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
      className={cn(
        'absolute -left-px w-0.5 rounded-full bg-primary-500',
        className,
      )}
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
}: {
  headings: { level: number; text: string; id: string }[]
} & ComponentBase) {
  const activeIds = useActiveAnchors()

  if (headings.length === 0) return null

  return (
    <OnThisPageList className={className}>
      <OnThisPageIndicator />
      {headings.map((h) => (
        <OnThisPageItem key={h.id} level={h.level}>
          <OnThisPageLink href={`#${h.id}`} active={activeIds.includes(h.id)}>
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
}: {
  headings: { level: number; text: string; id: string }[]
} & ComponentBase) {
  const toc = useMemo(
    () =>
      headings.map((h) => ({ title: h.text, url: `#${h.id}`, depth: h.level })),
    [headings],
  )

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  if (headings.length === 0) return null

  return (
    <AnchorProvider toc={toc} single={false}>
      <ScrollProvider containerRef={scrollContainerRef}>
        <OnThisPageContent ref={scrollContainerRef}>
          <OnThisPageItems headings={headings} className={className} />
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
