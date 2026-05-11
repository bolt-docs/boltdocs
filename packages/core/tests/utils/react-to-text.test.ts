import { describe, it, expect } from 'vitest'
import { reactToText } from '../../src/client/utils/react-to-text'
import * as React from 'react'
import * as ReactDOM from 'react-dom'

describe('reactToText', () => {
  it('should return empty string for null', () => {
    expect(reactToText(null)).toBe('')
  })

  it('should return empty string for undefined', () => {
    expect(reactToText(undefined)).toBe('')
  })

  it('should return empty string for boolean', () => {
    expect(reactToText(true)).toBe('')
    expect(reactToText(false)).toBe('')
  })

  it('should return string as-is', () => {
    expect(reactToText('Hello World')).toBe('Hello World')
  })

  it('should convert number to string', () => {
    expect(reactToText(42)).toBe('42')
    expect(reactToText(3.14)).toBe('3.14')
  })

  it('should extract text from React element', () => {
    const element = React.createElement('div', null, 'Hello')
    expect(reactToText(element)).toBe('Hello')
  })

  it('should extract text from nested elements', () => {
    const element = React.createElement('div', null, 
      React.createElement('span', null, 'Hello'),
      ' ',
      React.createElement('strong', null, 'World')
    )
    expect(reactToText(element)).toBe('Hello World')
  })

  it('should handle arrays of elements', () => {
    const elements = [
      React.createElement('span', { key: '1' }, 'One'),
      React.createElement('span', { key: '2' }, 'Two'),
    ]
    expect(reactToText(elements)).toBe('OneTwo')
  })

  it('should use custom resolver for elements', () => {
    const CustomComponent = (props: { value: string }) => React.createElement('span', null, props.value)
    const resolverMap = new Map()
    resolverMap.set(CustomComponent, (props: { value: string }) => `[${props.value}]`)
    
    const element = React.createElement(CustomComponent, { value: 'test' })
    expect(reactToText(element, resolverMap)).toBe('[test]')
  })

  it('should handle deeply nested elements', () => {
    const element = React.createElement('div', null,
      React.createElement('div', null,
        React.createElement('div', null,
          React.createElement('span', null, 'Deep')
        )
      )
    )
    expect(reactToText(element)).toBe('Deep')
  })

  it('should handle elements with multiple children', () => {
    const element = React.createElement('div', null, 
      'Start - ',
      React.createElement('b', null, 'Bold'),
      ' - End'
    )
    expect(reactToText(element)).toBe('Start - Bold - End')
  })

  it('should return empty string for element without children', () => {
    const element = React.createElement('div', { id: 'test' })
    expect(reactToText(element)).toBe('')
  })

  it('should handle mixed content array', () => {
    const mixed = ['text1', React.createElement('span', null, 'text2'), 123]
    expect(reactToText(mixed)).toBe('text1text2123')
  })
})