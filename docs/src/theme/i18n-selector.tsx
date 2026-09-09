import { useI18n } from 'boltdocs/client'
import { Button } from '@/theme/button'
import { Menu } from 'boltdocs/primitives'
import { ChevronDown, Languages } from 'lucide-react'
import { cn } from 'boltdocs/client'

export function I18nSelector({ className }: { className?: string }) {
  const { currentLocale, availableLocales, handleLocaleChange } = useI18n()

  if (availableLocales.length === 0) return null

  return (
    <Menu.Trigger>
      <Button
        variant="ghost"
        size="md"
        className={cn(
          'justify-between rounded-md text-xs font-semibold hover:bg-surface',
          className,
        )}
      >
        <div className="flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 text-muted" />
          <span className="font-bold text-[0.75rem] uppercase opacity-90">
            {currentLocale || 'en'}
          </span>
        </div>
        <ChevronDown className="size-5 transition-transform group-hover:rotate-180 text-muted" />
      </Button>
      <Menu.Root className="w-auto bg-subtle rounded-lg py-2 px-2 shadow-md outline-none flex flex-col gap-0.5 z-100">
        <Menu.Section items={availableLocales}>
          {(locale) => (
            <Menu.Item
              key={locale.value}
              onPress={() => handleLocaleChange(locale.value as 'en' | 'es')}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-body hover:bg-surface/50 transition-colors cursor-pointer select-none outline-none group data-selected:text-primary-500 data-selected:bg-primary-500/10"
            >
              <span>{locale.label}</span>
            </Menu.Item>
          )}
        </Menu.Section>
      </Menu.Root>
    </Menu.Trigger>
  )
}
