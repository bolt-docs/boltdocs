import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
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
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-body outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
      >
        <Menu.Item id="light">
          <Sun size={16} />
          <span>Light</span>
        </Menu.Item>
        <Menu.Item id="dark">
          <Moon size={16} />
          <span>Dark</span>
        </Menu.Item>
        <Menu.Item id="system">
          <Monitor size={16} />
          <span>System</span>
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
          'h-10 w-full bg-surface rounded-full animate-pulse',
          className,
        )}
      />
    )
  }

  const isDark = theme === 'dark'

  return (
    <div
      className={cn(
        'flex p-1 bg-surface border border-subtle rounded-full relative w-full h-11',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-y-1 w-[calc(50%-4px)] bg-main border border-subtle rounded-full transition-all duration-300 ease-out shadow-sm',
          isDark ? 'translate-x-full' : 'translate-x-0',
        )}
      />
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'flex-1 flex items-center justify-center rounded-full z-10 transition-colors outline-none cursor-pointer',
          !isDark ? 'text-body' : 'text-muted hover:text-body',
        )}
        aria-label="Light mode"
      >
        <Sun size={18} />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'flex-1 flex items-center justify-center rounded-full z-10 transition-colors outline-none cursor-pointer',
          isDark ? 'text-body' : 'text-muted hover:text-body',
        )}
        aria-label="Dark mode"
      >
        <Moon size={18} />
      </button>
    </div>
  )
}
