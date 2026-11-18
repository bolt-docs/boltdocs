import { describe, expect, it } from 'vitest'
import { cn, composeRenderProps, filterDOMProps } from '../src/utils'

describe('cn', () => {
  it('drops falsy values and flattens arrays and maps', () => {
    expect(
      cn('a', false, null, undefined, ['b', ['c', false]], {
        d: true,
        e: false,
      }),
    ).toBe('a b c d')
  })

  it('handles no arguments', () => {
    expect(cn()).toBe('')
  })
})

describe('filterDOMProps', () => {
  it('keeps DOM attributes and removes library-only props', () => {
    const { domProps, propTypes } = filterDOMProps({
      'aria-label': 'Open',
      'data-state': 'on',
      isDisabled: true,
      onPress: () => {},
      children: 'x',
    })

    expect(domProps).toEqual({
      'aria-label': 'Open',
      'data-state': 'on',
    })
    expect(propTypes).toHaveProperty('isDisabled')
    expect(propTypes).toHaveProperty('onPress')
  })
})

describe('composeRenderProps', () => {
  it('resolves className, style and children from render state', () => {
    const resolved = composeRenderProps(
      {
        className: (on: boolean) => (on ? 'on' : 'off'),
        style: (on: boolean) => ({ opacity: on ? 1 : 0 }),
        children: (on: boolean) => (on ? 'yes' : 'no'),
      },
      true,
    )

    expect(resolved).toEqual({
      className: 'on',
      style: { opacity: 1 },
      children: 'yes',
    })
  })
})
