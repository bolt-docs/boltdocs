import { useI18n } from '../../hooks/index'
import { Button } from '../primitives/button'
import { Menu } from '../primitives/menu'
import { ChevronDown, Languages } from './icons'
import { cn } from '../../utils/cn'

export function I18nSelector({ className }: { className?: string }) {
  const { currentLocale, availableLocales, handleLocaleChange } = useI18n()

  if (availableLocales.length === 0) return null

  return (
    <Menu.Trigger>
      <Button
        className={cn('bdocs-selector bdocs-selector--locale', className)}
      >
        <div className="bdocs-selector__label">
          <Languages className="bdocs-selector__icon bdocs-selector__icon--brand" />
          <span className="bdocs-selector__code">{currentLocale || 'en'}</span>
        </div>
        <ChevronDown className="bdocs-selector__icon bdocs-selector__icon--chevron" />
      </Button>
      <Menu.Root className="bdocs-selector__menu">
        <Menu.Section items={availableLocales}>
          {(locale) => (
            <Menu.Item
              key={locale.value}
              onAction={() => handleLocaleChange(locale.value)}
              className="bdocs-selector__option"
            >
              <span>{locale.label}</span>
            </Menu.Item>
          )}
        </Menu.Section>
      </Menu.Root>
    </Menu.Trigger>
  )
}
