import { useVersion } from '../../hooks/use-version'
import { useI18n } from '../../hooks/use-i18n'
import { Menu } from '../primitives/menu'
import { Button } from '../primitives/button'
import { ChevronDown, Languages } from 'lucide-react'
import { cn } from '../../utils/cn'

export function VersionSelector({ className }: { className?: string }) {
  const { currentVersionLabel, availableVersions, handleVersionChange } =
    useVersion()

  if (availableVersions.length === 0) return null

  return (
    <Menu.Trigger>
      <Button
        className={cn(
          'flex h-9 items-center justify-between gap-2 border border-subtle bg-surface px-4 py-1.5 rounded-xl text-xs font-semibold text-body hover:bg-primary-50/20 hover:border-primary-500/50 transition-all duration-300 outline-none select-none cursor-pointer',
          className,
        )}
      >
        <span className="font-semibold text-[0.8125rem]">
          {currentVersionLabel}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted/60" />
      </Button>
      <Menu.Root className="w-40 bg-main border border-subtle rounded-xl p-1.5 shadow-md outline-none flex flex-col gap-0.5 animate-fade-in z-100">
        <Menu.Section items={availableVersions}>
          {(version) => (
            <Menu.Item
              key={`${version.value ?? ''}`}
              onPress={() => handleVersionChange(version.value)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-body hover:bg-primary-50/50 cursor-pointer select-none outline-none group data-selected:text-primary-500 data-selected:bg-primary-500/5"
            >
              {version.label as string}
            </Menu.Item>
          )}
        </Menu.Section>
      </Menu.Root>
    </Menu.Trigger>
  )
}

export function I18nSelector({ className }: { className?: string }) {
  const { currentLocale, availableLocales, handleLocaleChange } = useI18n()

  if (availableLocales.length === 0) return null

  return (
    <Menu.Trigger>
      <Button
        className={cn(
          'flex h-9 items-center justify-between gap-2 border border-subtle bg-surface px-4 py-1.5 rounded-xl text-xs font-semibold text-body hover:bg-primary-50/20 hover:border-primary-500/50 transition-all duration-300 outline-none select-none cursor-pointer',
          className,
        )}
      >
        <div className="flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 text-primary-500" />
          <span className="font-bold text-[0.75rem] uppercase opacity-90">
            {currentLocale || 'en'}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-muted/60" />
      </Button>
      <Menu.Root className="w-40 bg-main border border-subtle rounded-xl p-1.5 shadow-md outline-none flex flex-col gap-0.5 animate-fade-in z-100">
        <Menu.Section items={availableLocales}>
          {(locale) => (
            <Menu.Item
              key={`${locale.value ?? ''}`}
              onPress={() => handleLocaleChange(locale.value)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-body dark:hover:bg-primary-300/50 hover:bg-primary-200/50 transition-colors duration-100 cursor-pointer select-none outline-none group data-selected:text-primary-500 data-selected:bg-primary-500/5"
            >
              <span>{locale.label as string}</span>
            </Menu.Item>
          )}
        </Menu.Section>
      </Menu.Root>
    </Menu.Trigger>
  )
}
