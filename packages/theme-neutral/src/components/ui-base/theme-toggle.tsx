import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from './icons'
import { useTheme } from '@bdocs/runtime'
import { Button } from '@bdocs/primitives'
import { Menu } from '../primitives/menu'
import { cn } from '../../utils/cn'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className={cn('bdocs-theme-toggle', className)} />
  }

  const Icon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun

  return (
    <Menu.Trigger className="bdocs-theme-toggle__menu-trigger">
      <Button
        className={cn('bdocs-theme-toggle__trigger', className)}
        aria-label="Selection theme"
      >
        <Icon size={20} className="bdocs-theme-toggle__icon" />
      </Button>
      <Menu.Root
        selectionMode="single"
        selectedKeys={[theme]}
        onSelectionChange={(keys: string[]) => {
          const newTheme = keys[0] as 'light' | 'dark' | 'system'
          if (newTheme) setTheme(newTheme)
        }}
        className="bdocs-theme-toggle__menu"
      >
        <Menu.Item id="light" className="bdocs-theme-toggle__option">
          <Sun className="bdocs-theme-toggle__option-icon" size={16} />
          <span className="bdocs-theme-toggle__option-label">Light</span>
        </Menu.Item>
        <Menu.Item id="dark" className="bdocs-theme-toggle__option">
          <Moon className="bdocs-theme-toggle__option-icon" size={16} />
          <span className="bdocs-theme-toggle__option-label">Dark</span>
        </Menu.Item>
        <Menu.Item id="system" className="bdocs-theme-toggle__option">
          <Monitor className="bdocs-theme-toggle__option-icon" size={16} />
          <span className="bdocs-theme-toggle__option-label">System</span>
        </Menu.Item>
      </Menu.Root>
    </Menu.Trigger>
  )
}

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className={cn('bdocs-theme-toggle__skeleton', className)} />
  }

  const isDark = theme === 'dark'

  return (
    <div className={cn('bdocs-theme-switch', className)} data-value={theme}>
      <div className="bdocs-theme-switch__indicator" />
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'bdocs-theme-switch__option',
          isDark && 'bdocs-theme-switch__option--inactive',
        )}
        aria-label="Light mode"
      >
        <Sun size={18} />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'bdocs-theme-switch__option',
          !isDark && 'bdocs-theme-switch__option--inactive',
        )}
        aria-label="Dark mode"
      >
        <Moon size={18} />
      </button>
    </div>
  )
}
