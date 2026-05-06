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
        variant={'outline'}
        size="sm"
        rounded="lg"
        iconPosition="right"
        icon={<ChevronDown className="w-3.5 h-3.5 text-muted/60" />}
        className={cn(
          'h-8 border-subtle/60 bg-surface/30 backdrop-blur-sm transition-all duration-200 hover:border-primary-500/50 hover:bg-primary-500/5',
          className,
        )}
      >
        <span className="font-semibold text-[0.8125rem]">
          {currentVersionLabel}
        </span>
      </Button>
      <Menu.Root>
        <Menu.Section items={availableVersions}>
          {(version) => (
            <Menu.Item
              key={`${version.value ?? ''}`}
              onPress={() => handleVersionChange(version.value)}
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
        variant={'outline'}
        size="sm"
        rounded="lg"
        iconPosition="right"
        icon={<ChevronDown className="w-3.5 h-3.5 text-muted/60" />}
        className={cn(
          'h-8 border-subtle/60 bg-surface/30 backdrop-blur-sm transition-all duration-200 hover:border-primary-500/50 hover:bg-primary-500/5 px-2.5',
          className,
        )}
      >
        <div className="flex items-center gap-1.5">
          <Languages className="w-3.5 h-3.5 text-primary-500" />
          <span className="font-bold text-[0.75rem] uppercase opacity-90">
            {currentLocale || 'en'}
          </span>
        </div>
      </Button>
      <Menu.Root>
        <Menu.Section items={availableLocales}>
          {(locale) => (
            <Menu.Item
              key={`${locale.value ?? ''}`}
              onPress={() => handleLocaleChange(locale.value)}
            >
              <span>{locale.label as string}</span>
            </Menu.Item>
          )}
        </Menu.Section>
      </Menu.Root>
    </Menu.Trigger>
  )
}
