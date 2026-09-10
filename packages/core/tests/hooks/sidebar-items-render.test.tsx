import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type React from 'react'
import { SidebarItems } from '../../src/client/components/primitives/sidebar'
import { useConfig } from '../../src/client/app/config-context'
import { useLocation } from '../../src/client/router'
import { useRoutesContext } from '../../src/client/app/routes-context'
import { useBoltdocsContext } from '../../src/client/store/boltdocs-context'
import { SidebarMobile } from '../../src/client/components/primitives/sidebar'
import { useUI } from '../../src/client/app/ui-context'
import type { ComponentRoute } from '../../src/client/types'

vi.mock('react-aria-components', () => ({
  ModalOverlay: ({
    children,
    className,
    isOpen,
    ...props
  }: {
    children?: React.ReactNode
    className?: string
    isOpen?: boolean
  }) =>
    isOpen ? (
      <div data-testid="modal-overlay" className={className} {...props}>
        {children}
      </div>
    ) : null,
  Modal: ({
    children,
    className,
    ...props
  }: {
    children?: React.ReactNode
    className?: string
  }) => (
    <div data-testid="modal" className={className} {...props}>
      {children}
    </div>
  ),
  Dialog: ({
    children,
    className,
    ...props
  }: {
    children?: React.ReactNode
    className?: string
  }) => (
    <div data-testid="dialog" className={className} {...props}>
      {children}
    </div>
  ),
}))

vi.mock('../../src/client/router', () => ({
  useLocation: vi.fn(),
  useNavigate: vi.fn(() => vi.fn()),
  usePrefetch: vi.fn(() => vi.fn()),
  hasUriScheme: (to: string) => /^[a-z][a-z0-9+.-]*:/i.test(to),
  hasUrlBase: (to: string, base: string) => to.startsWith(base),
  parseUrlReference: (pathname: string) => ({
    routePath: pathname === '/docs' ? '/' : pathname,
    pathname,
    locale: undefined,
    version: undefined,
  }),
  resolveUrlReference: (to: string) => to,
}))

vi.mock('../../src/client/app/config-context', () => ({
  useConfig: vi.fn(),
  useOptionalConfig: vi.fn(),
}))

vi.mock('../../src/client/app/routes-context', () => ({
  useRoutesContext: vi.fn(),
}))

vi.mock('../../src/client/store/boltdocs-context', () => ({
  useBoltdocsContext: vi.fn(),
}))

vi.mock('../../src/client/app/ui-context', () => ({
  useUI: vi.fn(),
}))

vi.mock('../../src/client/components/ui-base/icon-renderer', () => ({
  IconRenderer: () => null,
  resolveIcon: (icon: unknown) => icon,
}))

vi.mock('../../src/client/view-transitions', () => ({
  useViewTransition: () => () => null,
}))

const nestedRoutes: ComponentRoute[] = [
  {
    path: '/docs/guides',
    filePath: 'guides/index.md',
    title: 'Guides',
    slugParts: ['guides'],
    componentPath: 'guides/index.md',
  },
  {
    path: '/docs/guides/getting-started',
    filePath: 'guides/getting-started/index.md',
    title: 'Getting Started',
    slugParts: ['guides', 'getting-started'],
    componentPath: 'guides/getting-started/index.md',
  },
  {
    path: '/docs/guides/getting-started/install',
    filePath: 'guides/getting-started/install.md',
    title: 'Install',
    slugParts: ['guides', 'getting-started'],
    componentPath: 'guides/getting-started/install.md',
  },
]

describe('SidebarItems', () => {
  beforeEach(() => {
    vi.mocked(useUI).mockReturnValue({
      isSidebarOpen: true,
      toggleSidebar: vi.fn(),
      closeSidebar: vi.fn(),
    } as ReturnType<typeof useUI>)
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      directoryMeta: {},
      theme: {},
    } as ReturnType<typeof useConfig>)
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/guides/getting-started/install',
      search: '',
      hash: '',
    } as ReturnType<typeof useLocation>)
    vi.mocked(useRoutesContext).mockReturnValue({
      routes: [],
      index: {
        byPath: new Map(),
        hintsByPath: new Map(),
        collectionNames: [],
      },
    } as ReturnType<typeof useRoutesContext>)
    vi.mocked(useBoltdocsContext).mockReturnValue({
      currentLocale: '',
      currentVersion: '',
    } as ReturnType<typeof useBoltdocsContext>)
  })

  it('replaces each route node via componentItem render prop', () => {
    render(
      <SidebarItems
        routes={nestedRoutes}
        componentItem={({ route, isActive, depth }) => (
          <div
            data-testid="custom-item"
            data-active={isActive}
            data-depth={depth}
          >
            {route.title}
          </div>
        )}
      />,
    )

    // componentItem fully replaces a route node (and its subtree), so the
    // top-level group child is the only custom-rendered node here.
    const items = screen.getAllByTestId('custom-item')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toBe('Getting Started')
    expect(items[0].dataset.active).toBe('true')
    expect(items[0].dataset.depth).toBe('1')
  })

  it('replaces the group wrapper via componentGroup render prop', () => {
    render(
      <SidebarItems
        routes={nestedRoutes}
        componentGroup={({ group, isGroupActive, children }) => (
          <section data-testid="custom-group" data-active={isGroupActive}>
            <h2>{group.title}</h2>
            {children}
          </section>
        )}
      />,
    )

    const group = screen.getByTestId('custom-group')
    expect(group.dataset.active).toBe('true')
    expect(group.querySelector('h2')?.textContent).toBe('Guides')

    const installLink = screen.getByText('Install').closest('a')
    expect(installLink).not.toBeNull()
    expect(installLink?.getAttribute('href')).toBe(
      '/docs/guides/getting-started/install',
    )
  })

  it('merges classNames slots over the default styles', () => {
    const { container } = render(
      <SidebarItems
        routes={nestedRoutes}
        classNames={{
          item: 'theme-item',
          groupHeader: 'theme-group-header',
          toggle: 'theme-toggle',
          subgroupContent: 'theme-subgroup-content',
        }}
      />,
    )

    const heading = container.querySelector('h4')
    expect(heading?.textContent).toContain('Guides')
    expect(heading?.className).toContain('theme-group-header')

    const installLink = screen.getByText('Install').closest('a')
    expect(installLink).not.toBeNull()
    if (!installLink) {
      throw new Error('Install link not found')
    }
    expect(installLink.className).toContain('theme-item')
    expect(installLink.className).not.toContain('bg-primary-500/10')
    expect(installLink.dataset.active).toBe('true')

    const toggle = container.querySelector('button')
    expect(toggle).not.toBeNull()
    if (!toggle) {
      throw new Error('Sidebar toggle not found')
    }
    expect(toggle.className).toContain('theme-toggle')

    const subgroupContent = installLink.parentElement
    expect(subgroupContent).not.toBeNull()
    if (!subgroupContent) {
      throw new Error('Sidebar subgroup wrapper not found')
    }
    expect(subgroupContent.className).toContain('theme-subgroup-content')
  })

  it('hides the mobile sidebar on desktop layouts', () => {
    render(
      <SidebarMobile
        overlayClassName="fixed inset-0 z-50 bg-black/20"
        className="fixed left-0 top-0 h-full w-80 bg-main"
      >
        <div>Sidebar</div>
      </SidebarMobile>,
    )

    const overlay = screen.getByTestId('modal-overlay')
    const modal = screen.getByTestId('modal')

    expect(overlay.className).toContain('lg:hidden')
    expect(modal.className).toContain('lg:hidden')
  })

  it('exposes state via data-* attributes for CSS theming', () => {
    const { container } = render(<SidebarItems routes={nestedRoutes} />)

    // The active leaf link carries data-active + aria-current="page".
    const installLink = screen.getByText('Install').closest('a')
    expect(installLink).not.toBeNull()
    if (!installLink) {
      throw new Error('Install link not found')
    }
    expect(installLink.dataset.active).toBe('true')
    expect(installLink.getAttribute('aria-current')).toBe('page')
    expect(installLink.dataset.depth).toBe('2')

    // Non-active links must NOT carry data-active (presence = active).
    const gettingStarted = screen.getByText('Getting Started').closest('a')
    expect(gettingStarted).not.toBeNull()
    if (!gettingStarted) {
      throw new Error('Getting Started link not found')
    }
    expect(gettingStarted.dataset.active).toBeUndefined()

    // The group container exposes group state.
    const group = container.querySelector('[data-group]')
    expect(group).not.toBeNull()
    if (!group) {
      throw new Error('Sidebar group not found')
    }
    expect(group.getAttribute('data-active')).toBe('true')
    expect(group.getAttribute('data-collapsible')).toBeNull()

    // No framework color/design classes are baked into the tree.
    const all = container.querySelectorAll(
      '[class*="primary-500"], [class*="text-muted"]',
    )
    expect(all).toHaveLength(0)
  })
})
