import { type ReactNode, useState, useEffect } from 'react'
import {
  Button as ButtonRAC,
  ModalOverlay,
  Modal,
  Dialog,
  Separator,
  ToggleButton,
} from 'react-aria-components'
import { Link } from './link'
import { cn } from '../../utils/cn'
import { resolvePublicAssetUrl } from '../../utils/path'
import { useConfig } from '../../app/config-context'
import { useLocalizedTo } from '../../hooks/use-localized-to'
import { useLocation } from '../../router'
import { Sun, Moon, ExternalLink, MoreVertical, X } from '../ui-base/icons'
import * as IconsSocials from '../icons-prod'
import type { ComponentBase } from './types'
import type { NavbarLink as NavbarLinkType } from '../../types'
import type {
  BoltdocsSocialLink,
  BoltdocsRoutePathWithFallback,
} from '../../../shared/types'

export interface NavbarLinkProps extends Omit<ComponentBase, 'children'> {
  label: ReactNode
  href: BoltdocsRoutePathWithFallback
  to?: 'internal' | 'external'
}

export interface NavbarLogoProps extends Omit<ComponentBase, 'children'> {
  src: string
  alt: string
  width?: number
  height?: number
  href?: BoltdocsRoutePathWithFallback
  /** Class name for the logo `<img>` element. */
  logoClassName?: string
}

export interface NavbarSearchTriggerProps extends ComponentBase {
  onPress: () => void
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
      className={cn('boltdocs-navbar sticky top-0 z-50', className)}
      {...props}
    >
      {children}
    </header>
  )
}

function NavbarContent({ children, className }: ComponentBase) {
  return (
    <div
      className={cn(
        'mx-auto flex lg:h-navbar max-w-(--breakpoint-3xl) items-center px-4 md:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

function NavbarLeft({ children, className }: ComponentBase) {
  return (
    <div className={cn('flex flex-1 items-center gap-4 min-w-0', className)}>
      {children}
    </div>
  )
}

function NavbarRight({ children, className }: ComponentBase) {
  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-end gap-2 md:gap-4 min-w-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

function NavbarCenter({ children, className }: ComponentBase) {
  return (
    <div
      className={cn(
        'hidden lg:flex flex-1 justify-center items-center gap-4 px-4 min-w-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

function NavbarLogo({
  src,
  alt,
  width = 24,
  height = 24,
  className,
  logoClassName,
  href = '/',
}: NavbarLogoProps) {
  const config = useConfig()

  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2 shrink-0 outline-none', className)}
    >
      {src ? (
        <img
          src={resolvePublicAssetUrl(src, config.base)}
          alt={alt}
          width={width}
          height={height}
          fetchPriority="high"
          className={cn('h-6 w-6 object-contain', logoClassName)}
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
  return (
    <Link href={href} className={cn(linkClassName)}>
      <span
        className={cn(
          'text-lg font-bold tracking-tight hidden sm:inline-block',
          className,
        )}
      >
        {children}
      </span>
    </Link>
  )
}

function NavbarLinks({ children, className }: ComponentBase) {
  return (
    <nav
      className={cn(
        'hidden md:flex items-center gap-6 text-sm font-medium',
        className,
      )}
    >
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
      className={cn('transition-all outline-none', className)}
    >
      {label as any}
      {to === 'external' && (
        <span className={cn('ml-1 inline-block', iconClassName)}>
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
      className={cn('relative', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={cn(
          'flex items-center gap-1 outline-none select-none cursor-pointer',
          triggerClassName,
        )}
      >
        {label}
        <span className={cn('shrink-0', iconClassName)}>
          {icon ?? (
            <svg
              className={cn(
                'size-6 transition-transform',
                isOpen && 'rotate-180',
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
        <div
          className={cn('absolute top-full left-0 pt-1 z-9999', panelClassName)}
        >
          <div
            className={cn(
              'min-w-[180px] p-1 bg-surface border border-subtle rounded-md shadow-lg',
              menuClassName,
            )}
          >
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
    <Link
      href={href}
      className={cn('block px-2 py-1.5 rounded hover:bg-surface', className)}
    >
      {label}
    </Link>
  )
}

function NavbarSearchTriggerDesktop({
  className,
  onPress,
  children,
}: NavbarSearchTriggerProps) {
  return (
    <ButtonRAC
      onPress={onPress}
      className={cn(
        'hidden lg:flex items-center justify-between gap-2 px-3 py-2 text-sm outline-none cursor-pointer w-full max-w-[720px]',
        className,
      )}
    >
      {children}
    </ButtonRAC>
  )
}

function NavbarSearchTriggerMobile({
  className,
  onPress,
  children,
}: NavbarSearchTriggerProps) {
  return (
    <ButtonRAC
      onPress={onPress}
      className={cn(
        'lg:hidden flex h-10 w-10 items-center justify-center outline-none cursor-pointer',
        className,
      )}
      aria-label="Search"
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
    <div
      className={cn(
        'hidden sm:flex items-center gap-1 pointer-events-none select-none',
        className,
      )}
    >
      <kbd
        className={cn(
          'flex items-center justify-center font-mono text-[10px]',
          kbdClassName,
        )}
      >
        {isMac ? '⌘' : 'Ctrl'}
      </kbd>
      <kbd
        className={cn(
          'flex items-center justify-center font-mono text-[10px]',
          kbdClassName,
        )}
      >
        K
      </kbd>
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
      className={cn('outline-none cursor-pointer', className)}
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
      className={cn('outline-none', className)}
    >
      <Icon name={icon} />
    </Link>
  )
}

function NavbarSplit({ className }: ComponentBase) {
  return (
    <Separator
      orientation="vertical"
      className={cn('h-full w-px', className)}
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
      className={cn(
        'md:hidden flex items-center justify-center outline-none cursor-pointer',
        className,
      )}
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
        'fixed inset-0 z-60 md:hidden transition-all duration-100',
        className,
        overlayClassName,
      )}
    >
      <Modal className={cn('fixed inset-0 outline-none', modalClassName)}>
        <Dialog
          className={cn(
            'relative h-full outline-none flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] px-[calc(1.5rem+env(safe-area-inset-left,0px))]',
            dialogClassName,
          )}
        >
          <div
            className={cn(
              'flex items-center justify-between mb-6',
              closeRowClassName,
            )}
          >
            <span></span>
            <ButtonRAC
              onPress={onClose}
              className={cn(
                'flex items-center justify-center outline-none cursor-pointer text-muted hover:text-body transition-colors',
                closeButtonClassName,
              )}
              aria-label="Close menu"
            >
              <X size={24} />
            </ButtonRAC>
          </div>
          <nav
            className={cn(
              'flex-1 overflow-y-auto flex flex-col gap-4',
              navClassName,
            )}
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
      className={cn('group flex items-center outline-none', className)}
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
      <div className={cn('flex flex-col gap-1', groupClassName, className)}>
        <div
          className={cn(
            'px-3 py-2 text-sm transition-all',
            active ? 'text-body' : 'text-muted/80 hover:text-body',
            labelClassName,
          )}
        >
          {link.label as string}
        </div>
        <div className={cn('flex flex-col gap-1 pl-4', listClassName)}>
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
        'transition-all',
        active ? 'text-body' : 'text-muted/80 hover:text-body',
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
