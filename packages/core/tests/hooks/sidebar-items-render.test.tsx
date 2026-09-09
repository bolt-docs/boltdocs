import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { SidebarItems } from '../../src/client/components/primitives/sidebar'
import { useConfig } from '../../src/client/app/config-context'
import { useLocation } from '../../src/client/router'
import { useRoutesContext } from '../../src/client/app/routes-context'
import { useBoltdocsContext } from '../../src/client/store/boltdocs-context'

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

vi.mock('../../src/client/components/ui-base/icon-renderer', () => ({
  IconRenderer: () => null,
  resolveIcon: (icon: unknown) => icon,
}))

vi.mock('../../src/client/view-transitions', () => ({
  useViewTransition: () => () => null,
}))

const nestedRoutes = [
  {
    path: '/docs/guides',
    filePath: 'guides/index.md',
    title: 'Guides',
    slugParts: ['guides'],
  },
  {
    path: '/docs/guides/getting-started',
    filePath: 'guides/getting-started/index.md',
    title: 'Getting Started',
    slugParts: ['guides', 'getting-started'],
  },
  {
    path: '/docs/guides/getting-started/install',
    filePath: 'guides/getting-started/install.md',
    title: 'Install',
    slugParts: ['guides', 'getting-started'],
  },
]

describe('SidebarItems', () => {
  beforeEach(() => {
    vi.mocked(useConfig).mockReturnValue({
      base: '/docs',
      directoryMeta: {},
      theme: {},
    } as any)
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/docs/guides/getting-started/install',
      search: '',
      hash: '',
    })
    vi.mocked(useRoutesContext).mockReturnValue({
      routes: [],
      index: {
        byPath: new Map(),
        hintsByPath: new Map(),
        collectionNames: [],
      },
    } as any)
    vi.mocked(useBoltdocsContext).mockReturnValue({
      currentLocale: '',
      currentVersion: '',
    } as any)
  })

  it('replaces each route node via componentItem render prop', () => {
    render(
      <SidebarItems
        routes={nestedRoutes as any}
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
        routes={nestedRoutes as any}
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
        routes={nestedRoutes as any}
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

    const installLink = screen.getByText('Install').closest('a')!
    expect(installLink.className).toContain('theme-item')
    expect(installLink.className).not.toContain('bg-primary-500/10')
    expect(installLink.dataset.active).toBe('true')

    const toggle = container.querySelector('button')!
    expect(toggle.className).toContain('theme-toggle')

    const subgroupContent = installLink.parentElement!
    expect(subgroupContent.className).toContain('theme-subgroup-content')
  })

  it('exposes state via data-* attributes for CSS theming', () => {
    const { container } = render(<SidebarItems routes={nestedRoutes as any} />)

    // The active leaf link carries data-active + aria-current="page".
    const installLink = screen.getByText('Install').closest('a')!
    expect(installLink.dataset.active).toBe('true')
    expect(installLink.getAttribute('aria-current')).toBe('page')
    expect(installLink.dataset.depth).toBe('2')

    // Non-active links must NOT carry data-active (presence = active).
    const gettingStarted = screen.getByText('Getting Started').closest('a')!
    expect(gettingStarted.dataset.active).toBeUndefined()

    // The group container exposes group state.
    const group = container.querySelector('[data-group]')!
    expect(group.getAttribute('data-active')).toBe('true')
    expect(group.getAttribute('data-collapsible')).toBeNull()

    // No framework color/design classes are baked into the tree.
    const all = container.querySelectorAll(
      '[class*="primary-500"], [class*="text-muted"]',
    )
    expect(all).toHaveLength(0)
  })
})
