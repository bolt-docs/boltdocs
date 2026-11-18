import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Group } from '../src/group'

describe('Group', () => {
  it('is a labelled group with no appearance of its own', () => {
    const { container } = render(
      <Group aria-label="Rating">
        <button>One</button>
      </Group>,
    )
    const group = screen.getByRole('group', { name: 'Rating' })
    expect(group.tagName).toBe('DIV')
    expect(group).not.toHaveAttribute('aria-orientation')
    expect(group).toHaveAttribute('data-orientation', 'horizontal')
    expect(container.firstChild).toBe(group)
  })

  it('exposes vertical orientation and disabled state', () => {
    render(
      <Group orientation="vertical" isDisabled aria-label="Choices">
        <button>One</button>
      </Group>,
    )
    const group = screen.getByRole('group', { name: 'Choices' })
    expect(group).toHaveAttribute('aria-orientation', 'vertical')
    expect(group).toHaveAttribute('aria-disabled', 'true')
    expect(group).toHaveAttribute('data-disabled', 'true')
  })
})
