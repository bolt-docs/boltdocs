import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  getIconRegistry,
  IconRenderer,
  normalizeIconExports,
  resolveIcon,
} from '../../src/client/components/ui-base/icon-renderer'

function BrandIcon({ size, ...props }: { size?: number | string }) {
  return <svg data-testid="brand-icon" width={size} {...props} />
}

describe('icon renderer', () => {
  it('resolves built-in icons by name', () => {
    expect(resolveIcon('Check', getIconRegistry())).toBeTypeOf('function')
  })

  it('resolves custom icons from a wrapped module export', () => {
    const registry = {
      ...getIconRegistry(),
      ...normalizeIconExports({ default: { Brand: BrandIcon } }),
    }

    expect(resolveIcon('Brand', registry)).toBe(BrandIcon)
    render(<IconRenderer icon={resolveIcon('Brand', registry)} size={18} />)

    expect(screen.getByTestId('brand-icon')).toHaveAttribute('width', '18')
    expect(screen.getByTestId('brand-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  it('renders sanitized SVG strings as decorative icons', () => {
    const { container } = render(
      <IconRenderer
        icon='<svg viewBox="0 0 1 1"><script>alert(1)</script><path /></svg>'
        size={16}
      />,
    )

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('renders image URLs without treating them as component names', () => {
    render(<IconRenderer icon="/icons/brand.svg" size={20} label="Brand" />)

    expect(screen.getByRole('img', { name: 'Brand' })).toHaveAttribute(
      'src',
      '/icons/brand.svg',
    )
    expect(screen.getByRole('img', { name: 'Brand' })).toHaveAttribute(
      'width',
      '20',
    )
  })
})
