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
import { Menu } from './menu'
import { Popover } from './popover'
import { cn } from '../../utils/cn'
import { Sun, Moon, ExternalLink, MoreVertical, X } from '../ui-base/icons'
import * as IconsSocials from '../icons-dev'
import type { ComponentBase } from './types'
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
      className={cn('boltdocs-navbar sticky top-0 z-50 w-full', className)}
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
        'mx-auto flex lg:h-navbar max-w-(--breakpoint-3xl) items-center justify-between px-4 md:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

function NavbarLeft({ children, className }: ComponentBase) {
  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-start gap-4 min-w-0',
        className,
      )}
    >
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
        'hidden lg:flex flex-1 justify-center items-center gap-4 px-4 min-w-0 w-full',
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
  href = '/',
}: NavbarLogoProps) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2 shrink-0 outline-none', className)}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          fetchPriority="high"
          className="h-6 w-6 object-contain"
        />
      ) : null}
    </Link>
  )
}

function NavbarTitle({
  children,
  className,
  href = '/',
}: { href?: BoltdocsRoutePathWithFallback } & ComponentBase) {
  return (
    <Link href={href}>
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

function NavbarLink({ label, href, to, className }: NavbarLinkProps) {
  return (
    <Link
      href={href}
      target={to === 'external' ? '_blank' : undefined}
      className={cn('transition-all outline-none', className)}
    >
      {label as any}
      {to === 'external' && (
        <span className="ml-1 inline-block">
          <ExternalLink size={12} />
        </span>
      )}
    </Link>
  )
}

function NavbarDropdown({
  label,
  className,
  children,
}: {
  label: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={() => {
        setIsOpen(true)
      }}
      onMouseLeave={() => {
        setIsOpen(false)
      }}
    >
      <div
        className={cn(
          'flex items-center gap-1 outline-none cursor-pointer select-none font-medium text-muted hover:text-body transition-colors',
        )}
      >
        {label}
        <svg
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 pt-1 z-[9999]">
          <div className="min-w-[180px] p-1 bg-surface border border-subtle rounded-md shadow-lg">
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

function NavbarSearchTriggerKbd({ className }: ComponentBase) {
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
      <kbd className="flex items-center justify-center font-mono text-[10px]">
        {isMac ? '⌘' : 'Ctrl'}
      </kbd>
      <kbd className="flex items-center justify-center font-mono text-[10px]">
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
}

function NavbarMobileMenu({
  isOpen,
  onClose,
  children,
  className,
}: NavbarMobileMenuProps) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      isDismissable={true}
      className={cn(
        'fixed inset-0 z-60 md:hidden transition-all duration-100',
        className,
      )}
    >
      <Modal className="fixed inset-0 outline-none">
        <Dialog className="relative h-full outline-none flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] px-[calc(1.5rem+env(safe-area-inset-left,0px))]">
          <div className="flex items-center justify-between mb-6">
            <span></span>
            <ButtonRAC
              onPress={onClose}
              className="flex items-center justify-center outline-none cursor-pointer text-muted hover:text-body transition-colors"
              aria-label="Close menu"
            >
              <X size={24} />
            </ButtonRAC>
          </div>
          <nav className="flex-1 overflow-y-auto flex flex-col gap-4">
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

export default Navbar
