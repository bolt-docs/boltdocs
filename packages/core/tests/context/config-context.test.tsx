import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  useConfig,
  ConfigProvider,
  ConfigContext,
} from '../../src/client/app/config-context'
import * as React from 'react'

const TestComponent = () => {
  const config = useConfig()
  return <div data-testid="config-title">{config.theme?.title}</div>
}

describe('ConfigContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should provide config to child components', () => {
    const config = { theme: { title: 'Test Site' } }
    render(
      <ConfigProvider config={config as any}>
        <TestComponent />
      </ConfigProvider>,
    )
    expect(screen.getByTestId('config-title').textContent).toBe('Test Site')
  })

  it('should handle missing provider gracefully with fallback', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestComponent />)).not.toThrow()
    consoleError.mockRestore()
  })

  it('should merge theme options correctly', () => {
    const config = {
      theme: {
        title: 'My Docs',
        logo: '/logo.png',
        navbar: { display: true },
      },
    }
    render(
      <ConfigProvider config={config as any}>
        <TestComponent />
      </ConfigProvider>,
    )
    expect(screen.getByTestId('config-title').textContent).toBe('My Docs')
  })

  it('should handle empty config', () => {
    const config = {}
    render(
      <ConfigProvider config={config as any}>
        <TestComponent />
      </ConfigProvider>,
    )
    expect(screen.getByTestId('config-title').textContent).toBe('')
  })

  it('should handle i18n config', () => {
    const config = {
      theme: { title: 'i18n Site' },
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
    }
    render(
      <ConfigProvider config={config as any}>
        <TestComponent />
      </ConfigProvider>,
    )
    expect(screen.getByTestId('config-title').textContent).toBe('i18n Site')
  })

  it('should handle versions config', () => {
    const config = {
      theme: { title: 'Versioned Site' },
      versions: {
        defaultVersion: 'v1',
        versions: [{ label: 'v1', path: '/v1' }],
      },
    }
    render(
      <ConfigProvider config={config as any}>
        <TestComponent />
      </ConfigProvider>,
    )
    expect(screen.getByTestId('config-title').textContent).toBe(
      'Versioned Site',
    )
  })
})
