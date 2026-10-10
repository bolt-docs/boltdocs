import { type ReactNode, useState, useEffect } from 'react'
import {
  Button as ButtonRAC,
  ModalOverlay,
  Modal,
  Dialog,
  Separator,
  ToggleButton,
} from '@bdocs/primitives'
import { Link } from './link'
import { cn } from '../../utils/cn'
import { resolvePublicAssetUrl } from '../../utils/path'
import { useConfig } from '@bdocs/runtime'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import { useLocation } from '@bdocs/runtime'
import { Sun, Moon, ExternalLink, MoreVertical, X } from '../ui-base/icons'
import * as IconsSocials from '../icons-prod'
import type { ComponentBase } from './types'
import type { NavbarLink as NavbarLinkType } from '@bdocs/runtime'
import type {
  BoltdocsSocialLink,
  BoltdocsRoutePathWithFallback,
} from '@bdocs/runtime'

export interface NavbarLinkProps extends Omit<ComponentBase, 'children'> {
  label: ReactNode
  href: BoltdocsRoutePathWithFallback
  to?: 'internal' | 'external'
}

export interface NavbarLogoProps extends Omit<ComponentBase, 'children'> {
  src: string
  /** Source used while the `dark` class is absent from `<html>`. */
  srcLight?: string
  /** Source used while the `dark` class is present on `<html>`. */
  srcDark?: string | null
  alt: string
  width?: number
  height?: number
  href?: BoltdocsRoutePathWithFallback
  /** Class name for the logo `<img>` element. */
  logoClassName?: string
  /** Class name for the light-theme logo `<img>`, when two are rendered. */
  logoLightClassName?: string
  /** Class name for the dark-theme logo `<img>`, when two are rendered. */
  logoDarkClassName?: string
}

export interface NavbarSearchTriggerProps extends ComponentBase {
  onPress: () => void
  'aria-label'?: string
  'aria-keyshortcuts'?: string
}

export interface NavbarThemeProps {
  className?: string
  theme: 'dark' | 'light'
  onThemeChange: (isSelected: boolean) => void
}

export interface NavbarSocialsProps extends ComponentBase {
  icon: string
  link: string
}

export function Navbar({ children, className, ...props }: ComponentBase) {
  return (
    <header
      className={cn('boltdocs-navbar bdocs-navbar', className)}
      {...props}
    >
      {children}
    </header>
  )
}

function NavbarContent({ children, className }: ComponentBase) {
  return (
    <div className={cn('bdocs-navbar__content', className)}>{children}</div>
  )
}

function NavbarLeft({ children, className }: ComponentBase) {
  return <div className={cn('bdocs-navbar__left', className)}>{children}</div>
}

function NavbarRight({ children, className }: ComponentBase) {
  return <div className={cn('bdocs-navbar__right', className)}>{children}</div>
}

function NavbarCenter({ children, className }: ComponentBase) {
  return <div className={cn('bdocs-navbar__center', className)}>{children}</div>
}

function NavbarLogo({
  src,
  srcLight,
  srcDark,
  alt,
  width = 24,
  height = 24,
  className,
  logoClassName,
  logoLightClassName,
  logoDarkClassName,
  href = '/',
}: NavbarLogoProps) {
  const config = useConfig()

  const light = srcLight ?? src
  const hasPair = Boolean(srcDark) && srcDark !== light
  const resolve = (value: string) => resolvePublicAssetUrl(value, config.base)

  return (
    <Link href={href} className={cn('bdocs-navbar__logo', className)}>
      {hasPair ? (
        /**
         * Both variants are always in the DOM and CSS picks the visible one.
         *
         * Rendering only the active source would make the markup depend on the
         * resolved theme, which the server cannot know: it would render one
         * `src` while the browser renders the other, the hoisted preload `href`
         * would no longer match, and React would throw away the server HTML
         * with a hydration mismatch. Two elements that are identical on both
         * sides cost one extra request-free `<img>` and remove the whole class
         * of bug.
         */
        <>
          <img
            src={resolve(light)}
            alt={alt}
            width={width}
            height={height}
            fetchPriority="high"
            data-logo-theme="light"
            className={cn(
              'bdocs-navbar__logo-image bdocs-navbar__logo-image--light',
              logoClassName,
              logoLightClassName,
            )}
          />
          <img
            src={resolve(srcDark as string)}
            alt={alt}
            width={width}
            height={height}
            data-logo-theme="dark"
            aria-hidden="true"
            className={cn(
              'bdocs-navbar__logo-image bdocs-navbar__logo-image--dark',
              logoClassName,
              logoDarkClassName,
            )}
          />
        </>
      ) : src ? (
        <img
          src={resolve(src)}
          alt={alt}
          width={width}
          height={height}
          fetchPriority="high"
          className={cn('bdocs-navbar__logo-image', logoClassName)}
        />
      ) : null}
    </Link>
  )
}

function NavbarTitle({
  children,
  className,
  linkClassName,
  href = '/',
}: { href?: BoltdocsRoutePathWithFallback } & ComponentBase & {
    /** Class name for the wrapping link element. */
    linkClassName?: string
  }) {
  const titleText =
    typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : undefined

  return (
    <Link
      href={href}
      className={cn(linkClassName)}
      aria-label={
        // The visible title hides below `sm`; without a label the home link
        // has no accessible name on mobile (axe `link-name`).
        titleText ? `Go to ${titleText} home` : undefined
      }
    >
      <span className={cn('bdocs-navbar__title', className)}>{children}</span>
    </Link>
  )
}

function NavbarLinks({
  children,
  className,
  label,
}: ComponentBase & {
  /**
   * Accessible name for the nav landmark. Required when the page renders
   * multiple navs (e.g. a docs navbar plus a sidebar) so landmarks stay
   * distinguishable.
   */
  label?: string
}) {
  return (
    <nav aria-label={label} className={cn('bdocs-navbar__links', className)}>
      {children}
    </nav>
  )
}

function NavbarLink({
  label,
  href,
  to,
  className,
  iconClassName,
}: NavbarLinkProps & { iconClassName?: string }) {
  return (
    <Link
      href={href}
      target={to === 'external' ? '_blank' : undefined}
      // A handful of always-visible top-level destinations, so warming them on
      // visibility is nearly free and makes the first click of a visit instant.
      prefetch={to === 'external' ? 'none' : 'viewport'}
      className={cn('bdocs-navbar__link', className)}
    >
      {label as any}
      {to === 'external' && (
        <span className={cn('bdocs-navbar__link-icon', iconClassName)}>
          <ExternalLink size={12} />
        </span>
      )}
    </Link>
  )
}

function NavbarDropdown({
  label,
  className,
  triggerClassName,
  iconClassName,
  panelClassName,
  menuClassName,
  icon,
  open,
  onOpenChange,
  children,
}: {
  label: React.ReactNode
  className?: string
  /** Class name for the dropdown trigger row. */
  triggerClassName?: string
  /** Class name for the chevron indicator when using the default icon. */
  iconClassName?: string
  /** Class name for the absolute-positioned popup wrapper. */
  panelClassName?: string
  /** Class name for the styled dropdown panel. */
  menuClassName?: string
  /** Custom indicator/chevron icon. Replaces the default down chevron. */
  icon?: React.ReactNode
  /** Controlled open state. When omitted the dropdown manages its own state. */
  open?: boolean
  /** Callback fired when the dropdown open state changes. */
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = open ?? internalOpen
  const setOpen = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <div
      className={cn('bdocs-navbar__dropdown', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className={cn('bdocs-navbar__dropdown-trigger', triggerClassName)}>
        {label}
        <span className={cn('bdocs-navbar__dropdown-indicator', iconClassName)}>
          {icon ?? (
            <svg
              className={cn(
                'bdocs-navbar__dropdown-chevron',
                isOpen && 'bdocs-navbar__dropdown-chevron--open',
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </span>
      </div>
      {isOpen && (
        <div className={cn('bdocs-navbar__dropdown-panel', panelClassName)}>
          <div className={cn('bdocs-navbar__dropdown-menu', menuClassName)}>
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

function NavbarDropdownItem({
  href,
  label,
  className,
}: {
  href: BoltdocsRoutePathWithFallback
  label: string
  className?: string
}) {
  return (
    <Link href={href} className={cn('bdocs-navbar__dropdown-item', className)}>
      {label}
    </Link>
  )
}

function NavbarSearchTriggerDesktop({
  className,
  onPress,
  children,
  ...props
}: NavbarSearchTriggerProps) {
  return (
    <ButtonRAC
      {...props}
      onPress={onPress}
      className={cn('bdocs-navbar__search-desktop', className)}
    >
      {children}
    </ButtonRAC>
  )
}

function NavbarSearchTriggerMobile({
  className,
  onPress,
  children,
  ...props
}: NavbarSearchTriggerProps) {
  return (
    <ButtonRAC
      {...props}
      onPress={onPress}
      className={cn('bdocs-navbar__search-mobile', className)}
      aria-label={props['aria-label'] || 'Search'}
    >
      {children}
    </ButtonRAC>
  )
}

function NavbarSearchTriggerKbd({
  className,
  kbdClassName,
}: ComponentBase & { kbdClassName?: string }) {
  const [mounted, setMounted] = useState(false)
  const isMac = mounted && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className={cn('bdocs-navbar__search-kbd', className)}>
      <kbd className={cn('bdocs-navbar__kbd', kbdClassName)}>
        {isMac ? '⌘' : 'Ctrl'}
      </kbd>
      <kbd className={cn('bdocs-navbar__kbd', kbdClassName)}>K</kbd>
    </div>
  )
}

const NavbarSearchTrigger = {
  Desktop: NavbarSearchTriggerDesktop,
  Mobile: NavbarSearchTriggerMobile,
  Kbd: NavbarSearchTriggerKbd,
}

function NavbarTheme({ className, theme, onThemeChange }: NavbarThemeProps) {
  return (
    <ToggleButton
      isSelected={theme === 'dark'}
      onChange={onThemeChange}
      className={cn('bdocs-navbar__theme', className)}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </ToggleButton>
  )
}

function Icon({ name }: { name: BoltdocsSocialLink['icon'] }) {
  if (name === 'github') return <IconsSocials.Github />
  if (name === 'discord') return <IconsSocials.Discord />
  if (name === 'x') return <IconsSocials.XSocial />
  if (name === 'bluesky') return <IconsSocials.Bluesky />
}

function NavbarSocials({ icon, link, className }: NavbarSocialsProps) {
  return (
    <Link
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('bdocs-navbar__social', className)}
    >
      <Icon name={icon} />
    </Link>
  )
}

function NavbarSplit({ className }: ComponentBase) {
  return (
    <Separator
      orientation="vertical"
      className={cn('bdocs-navbar__split', className)}
    />
  )
}

export interface NavbarMoreProps extends ComponentBase {
  onPress?: () => void
}

function NavbarMore({ onPress, className }: NavbarMoreProps) {
  return (
    <ButtonRAC
      onPress={onPress}
      className={cn('bdocs-navbar__more', className)}
      aria-label="More navigation"
    >
      <MoreVertical size={20} />
    </ButtonRAC>
  )
}

export interface NavbarMobileMenuProps extends ComponentBase {
  isOpen: boolean
  onClose: () => void
  /** Class name for the overlay. */
  overlayClassName?: string
  /** Class name for the modal backdrop wrapper. */
  modalClassName?: string
  /** Class name for the dialog panel. */
  dialogClassName?: string
  /** Class name for the close button row. */
  closeRowClassName?: string
  /** Class name for the close button. */
  closeButtonClassName?: string
  /** Class name for the navigation list. */
  navClassName?: string
}

function NavbarMobileMenu({
  isOpen,
  onClose,
  children,
  className,
  overlayClassName,
  modalClassName,
  dialogClassName,
  closeRowClassName,
  closeButtonClassName,
  navClassName,
}: NavbarMobileMenuProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      isDismissable={true}
      className={cn(
        'bdocs-navbar__mobile-overlay',
        className,
        overlayClassName,
      )}
    >
      <Modal className={cn('bdocs-navbar__mobile', modalClassName)}>
        <Dialog className={cn('bdocs-navbar__mobile-dialog', dialogClassName)}>
          <div className={cn('bdocs-navbar__mobile-row', closeRowClassName)}>
            <span />
            <ButtonRAC
              onPress={onClose}
              className={cn('bdocs-navbar__mobile-close', closeButtonClassName)}
              aria-label="Close menu"
            >
              <X size={24} />
            </ButtonRAC>
          </div>
          <nav
            aria-label="Mobile navigation"
            className={cn('bdocs-navbar__mobile-nav', navClassName)}
          >
            {children}
          </nav>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

function NavbarMobileLink({
  label,
  href,
  to,
  onPress,
  className,
}: NavbarLinkProps & { onPress?: () => void }) {
  return (
    <Link
      href={href}
      target={to === 'external' ? '_blank' : undefined}
      onClick={onPress}
      className={cn('bdocs-navbar__mobile-link', className)}
    >
      {label as any}
    </Link>
  )
}

export interface NavbarMobileLinkItemProps {
  link: NavbarLinkType
  /** Callback invoked when a leaf link is activated (closes the menu). */
  onClose: () => void
  /** Nesting depth used by recursive rendering and passed to `renderItem`. */
  depth?: number
  /** Class name for the root wrapper of every node. */
  className?: string
  /** Class name for the wrapper of a group node (a link with children). */
  groupClassName?: string
  /** Class name for a group node's collapsed label heading. */
  labelClassName?: string
  /** Class name for the nested list of a group node's children. */
  listClassName?: string
  /**
   * Full render replacement for a single node (leaf or group). When returned,
   * this replaces the default markup entirely. Return `null` to signal "no
   * custom node; use the default" behavior for that item.
   */
  renderItem?: (props: {
    link: NavbarLinkType
    active: boolean
    depth: number
    localizedHref: string
    onClose: () => void
  }) => React.ReactNode
}

function NavbarMobileLinkItem({
  link,
  onClose,
  depth = 0,
  className,
  groupClassName,
  labelClassName,
  listClassName,
  renderItem,
}: NavbarMobileLinkItemProps) {
  const localizedHref = useLocalizedTo(link.href || '')
  const { pathname } = useLocation()
  const active = pathname === localizedHref
  const hasItems = link.items && link.items.length > 0

  const custom = renderItem?.({
    link,
    active,
    depth,
    localizedHref,
    onClose,
  })
  if (custom !== undefined && custom !== null) return <>{custom}</>

  if (hasItems) {
    return (
      <div
        className={cn('bdocs-navbar__mobile-group', groupClassName, className)}
      >
        <div
          className={cn(
            'bdocs-navbar__mobile-label',
            active ? 'bdocs-navbar__mobile-label--active' : undefined,
            labelClassName,
          )}
        >
          {link.label as string}
        </div>
        <div className={cn('bdocs-navbar__mobile-list', listClassName)}>
          {link.items?.map((item) => (
            <NavbarMobileLinkItem
              key={item.href}
              link={item}
              onClose={onClose}
              depth={depth + 1}
              className={className}
              groupClassName={groupClassName}
              labelClassName={labelClassName}
              listClassName={listClassName}
              renderItem={renderItem}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <NavbarMobileLink
      label={link.label as any}
      href={localizedHref}
      onPress={onClose}
      className={cn(
        'bdocs-navbar__mobile-link',
        active ? 'bdocs-navbar__mobile-link--active' : undefined,
        className,
      )}
    />
  )
}

Navbar.Root = Navbar
Navbar.Left = NavbarLeft
Navbar.Right = NavbarRight
Navbar.Center = NavbarCenter
Navbar.Logo = NavbarLogo
Navbar.Title = NavbarTitle
Navbar.Links = NavbarLinks
Navbar.Link = NavbarLink
Navbar.Dropdown = NavbarDropdown
Navbar.DropdownItem = NavbarDropdownItem
Navbar.SearchTrigger = NavbarSearchTrigger
Navbar.Theme = NavbarTheme
Navbar.Socials = NavbarSocials
Navbar.Split = NavbarSplit
Navbar.Content = NavbarContent
Navbar.More = NavbarMore
Navbar.MobileMenu = NavbarMobileMenu
Navbar.MobileLink = NavbarMobileLink
Navbar.MobileLinkItem = NavbarMobileLinkItem

export default Navbar
