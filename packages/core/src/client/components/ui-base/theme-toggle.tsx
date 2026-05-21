import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from './icons'
import { useTheme } from '../../app/theme-context'
import { Button } from 'react-aria-components'
import { Menu } from '../primitives/menu'
import { cn } from '../../utils/cn'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="h-9 w-9" />
  }

  const Icon = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun

  return (
    <Menu.Trigger placement="bottom right">
      <Button
        className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-body outline-none border-none bg-transparent cursor-pointer"
        aria-label="Selection theme"
      >
        <Icon size={20} className="animate-in fade-in zoom-in duration-300" />
      </Button>
      <Menu.Root
        selectionMode="single"
        selectedKeys={[theme]}
        onSelectionChange={(keys) => {
          const newTheme = Array.from(keys)[0] as 'light' | 'dark' | 'system'
          setTheme(newTheme)
        }}
        className="w-36 bg-main border border-subtle rounded-xl p-1.5 shadow-md outline-none flex flex-col gap-0.5 animate-fade-in z-100"
      >
        <Menu.Item
          id="light"
          className="group flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-body dark:hover:bg-primary-300/50 hover:bg-primary-200/50 transition-colors duration-100 cursor-pointer select-none outline-none group data-selected:text-primary-500 data-selected:bg-primary-500/5"
        >
          <Sun
            className="group-hover:text-primary-500 dark:group-hover:text-primary-200"
            size={16}
          />
          <span className="ml-2">Light</span>
        </Menu.Item>
        <Menu.Item
          id="dark"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-body dark:hover:bg-primary-300/50 hover:bg-primary-200/50 transition-colors duration-100 cursor-pointer select-none outline-none group data-selected:text-primary-500 data-selected:bg-primary-500/5"
        >
          <Moon
            className="group-hover:text-primary-500 dark:group-hover:text-primary-200"
            size={16}
          />
          <span className="ml-2">Dark</span>
        </Menu.Item>
        <Menu.Item
          id="system"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-body dark:hover:bg-primary-300/50 hover:bg-primary-200/50 transition-colors duration-100 cursor-pointer select-none outline-none group data-selected:text-primary-500 data-selected:bg-primary-500/5"
        >
          <Monitor
            className="group-hover:text-primary-500 dark:group-hover:text-primary-200"
            size={16}
          />
          <span className="ml-2">System</span>
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
    return (
      <div
        className={cn(
          'h-10 w-full bg-surface rounded-xl animate-pulse',
          className,
        )}
      />
    )
  }

  const isDark = theme === 'dark'

  return (
    <div
      className={cn(
        'flex p-1 bg-surface border border-subtle rounded-xl relative w-full h-11',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-y-1 w-[calc(50%-4px)] bg-main border border-subtle rounded-lg transition-all duration-300 ease-out shadow-xs',
          isDark ? 'translate-x-full' : 'translate-x-0',
        )}
      />
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'flex-1 flex items-center justify-center rounded-lg z-10 transition-colors outline-none cursor-pointer border-none bg-transparent',
          !isDark ? 'text-body font-semibold' : 'text-muted hover:text-body',
        )}
        aria-label="Light mode"
      >
        <Sun size={18} />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'flex-1 flex items-center justify-center rounded-lg z-10 transition-colors outline-none cursor-pointer border-none bg-transparent',
          isDark ? 'text-body font-semibold' : 'text-muted hover:text-body',
        )}
        aria-label="Dark mode"
      >
        <Moon size={18} />
      </button>
    </div>
  )
}
