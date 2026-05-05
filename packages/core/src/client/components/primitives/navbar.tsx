import { type ReactNode, useState, useEffect } from 'react'
import { Separator, ToggleButton, Link, cn } from './index'
import { Button as ButtonRAC, ModalOverlay, Modal, Dialog } from 'react-aria-components'
import { Search, Sun, Moon, ExternalLink, MoreVertical, X, ChevronRight } from 'lucide-react'
import * as IconsSocials from '../icons-dev'
import type { ComponentBase } from './types'
import type { BoltdocsSocialLink } from '../../../shared/types'

export interface NavbarLinkProps extends Omit<ComponentBase, 'children'> {
  label: ReactNode
  href: string
  active?: boolean
  to?: 'internal' | 'external'
}

export interface NavbarLogoProps extends Omit<ComponentBase, 'children'> {
  src: string
  alt: string
  width?: number
  height?: number
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

export const Navbar = ({ children, className, ...props }: ComponentBase) => {
  return (
    <header
      className={cn(
        'boltdocs-navbar sticky top-0 z-50 w-full border-b border-subtle bg-main/80 backdrop-blur-md',
        className,
      )}
      {...props}
    >
      {children}
    </header>
  )
}

const NavbarContent = ({ children, className }: ComponentBase) => {
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

const NavbarLeft = ({ children, className }: ComponentBase) => {
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

const NavbarRight = ({ children, className }: ComponentBase) => {
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

const NavbarCenter = ({ children, className }: ComponentBase) => {
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

const NavbarLogo = ({
  src,
  alt,
  width = 24,
  height = 24,
  className,
  href = '/',
}: NavbarLogoProps) => {
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
          className="h-6 w-6 object-contain"
        />
      ) : null}
    </Link>
  )
}

const NavbarTitle = ({ children, className, href = '/' }: { href?: string } & ComponentBase) => {
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

const NavbarLinks = ({ children, className }: ComponentBase) => {
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

const NavbarLink = ({
  label,
  href,
  active,
  to,
  className,
}: NavbarLinkProps) => {
  return (
    <Link
      href={href}
      target={to === 'external' ? '_blank' : undefined}
      className={cn(
        'transition-colors outline-none font-medium focus-visible:ring-2 focus-visible:ring-primary-500/30 rounded-sm',
        {
          'text-primary-500': active,
          'text-muted hover:text-body': !active,
        },
        className,
      )}
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

const NavbarSearchTrigger = ({
  className,
  onPress,
}: NavbarSearchTriggerProps) => {
  const [mounted, setMounted] = useState(false)
  const isMac = mounted && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      <ButtonRAC
        onPress={onPress}
        className={cn(
          'hidden lg:flex items-center gap-2 rounded-full border border-subtle bg-surface px-3 py-2 text-sm text-muted outline-none cursor-pointer',
          'transition-all duration-200 hover:border-strong hover:text-body hover:bg-soft hover:shadow-sm active:scale-[0.98]',
          'focus-visible:ring-2 focus-visible:ring-primary-500/30',
          'w-full max-w-[720px] justify-between',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <Search size={16} />
          <span className="hidden sm:inline-block">Search docs...</span>
        </div>
        <div className="hidden sm:flex items-center gap-1 pointer-events-none select-none">
          <kbd className="flex h-5 items-center justify-center rounded border border-subtle bg-main px-1.5 font-mono text-[10px] font-medium">
            {isMac ? '⌘' : 'Ctrl'}
          </kbd>
          <kbd className="flex h-5 w-5 items-center justify-center rounded border border-subtle bg-main font-mono text-[10px] font-medium">
            K
          </kbd>
        </div>
      </ButtonRAC>

      <ButtonRAC
        onPress={onPress}
        className={cn(
          'lg:hidden flex h-10 w-10 items-center justify-center rounded-lg text-muted outline-none cursor-pointer',
          'transition-all duration-200 hover:text-body active:scale-90',
          'focus-visible:ring-2 focus-visible:ring-primary-500/30',
          className,
        )}
        aria-label="Search"
      >
        <Search size={20} />
      </ButtonRAC>
    </>
  )
}

const NavbarTheme = ({ className, theme, onThemeChange }: NavbarThemeProps) => {
  return (
    <ToggleButton
      isSelected={theme === 'dark'}
      onChange={onThemeChange}
      className={cn(
        'rounded-md p-2 text-muted outline-none cursor-pointer',
        'transition-all duration-300 hover:bg-surface hover:text-body hover:rotate-12 active:scale-90',
        'focus-visible:ring-2 focus-visible:ring-primary-500/30',
        className,
      )}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </ToggleButton>
  )
}

const Icon = ({ name }: { name: BoltdocsSocialLink['icon'] }) => {
  if (name === 'github') return <IconsSocials.Github />
  if (name === 'discord') return <IconsSocials.Discord />
  if (name === 'x') return <IconsSocials.XSocial />
  if (name === 'bluesky') return <IconsSocials.Bluesky />
}

const NavbarSocials = ({ icon, link, className }: NavbarSocialsProps) => {
  return (
    <Link
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'rounded-md p-2 text-muted outline-none transition-colors',
        'hover:bg-surface hover:text-body',
        'focus-visible:ring-2 focus-visible:ring-primary-500/30',
        className,
      )}
    >
      <Icon name={icon} />
    </Link>
  )
}

const NavbarSplit = ({ className }: ComponentBase) => {
  return (
    <Separator
      orientation="vertical"
      className={cn('h-6 w-px bg-subtle mx-1', className)}
    />
  )
}

export interface NavbarMoreProps extends ComponentBase {
  onPress?: () => void
}

const NavbarMore = ({ onPress, className }: NavbarMoreProps) => {
  return (
    <ButtonRAC
      onPress={onPress}
      className={cn(
        'md:hidden flex h-10 w-10 items-center justify-center rounded-lg text-muted outline-none cursor-pointer',
        'transition-all duration-200 hover:text-body active:scale-90',
        'focus-visible:ring-2 focus-visible:ring-primary-500/30',
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
  title?: string
}

const NavbarMobileMenu = ({
  isOpen,
  onClose,
  children,
  className,
}: NavbarMobileMenuProps) => {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      isDismissable={true}
      className={cn(
        'fixed inset-0 z-[60] bg-main/95 backdrop-blur-xl md:hidden',
        'entering:animate-in entering:fade-in exiting:animate-out exiting:fade-out duration-300',
      )}
    >
      <Modal
        className={cn(
          'fixed inset-0 overflow-y-auto outline-none',
          'entering:animate-in entering:zoom-in-95 exiting:animate-out exiting:zoom-out-95 duration-300',
          className,
        )}
      >
        <Dialog className="relative h-full outline-none p-8 flex flex-col bg-main/98 backdrop-blur-xl">
          <div className="flex justify-end mb-4">
            <ButtonRAC
              onPress={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-body outline-none cursor-pointer transition-all active:scale-90"
              aria-label="Close menu"
            >
              <X size={28} />
            </ButtonRAC>
          </div>

          <nav className="flex flex-col gap-4">
            {children}
          </nav>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

const NavbarMobileLink = ({
  label,
  href,
  active,
  to,
  onPress,
  className,
}: NavbarLinkProps & { onPress?: () => void }) => {
  return (
    <Link
      href={href}
      target={to === 'external' ? '_blank' : undefined}
      onClick={onPress}
      className={cn(
        'group flex items-center py-2 text-[22px] font-medium transition-all outline-none',
        {
          'text-body': active,
          'text-muted/80 hover:text-body': !active,
        },
        className,
      )}
    >
      <span className="relative">
        {label as any}
        <span className={cn(
          "absolute -bottom-1 left-0 h-0.5 bg-primary-500 transition-all duration-300",
          active ? "w-full" : "w-0 group-hover:w-full"
        )} />
      </span>
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
Navbar.SearchTrigger = NavbarSearchTrigger
Navbar.Theme = NavbarTheme
Navbar.Socials = NavbarSocials
Navbar.Split = NavbarSplit
Navbar.Content = NavbarContent
Navbar.More = NavbarMore
Navbar.MobileMenu = NavbarMobileMenu
Navbar.MobileLink = NavbarMobileLink

export default Navbar
