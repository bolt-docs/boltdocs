import { useVersion } from '../../hooks/use-version'
import { Menu } from '../primitives/menu'
import { Button } from '../primitives/button'
import { ChevronDown } from './icons'
import { cn } from '../../utils/cn'

export function VersionSelector({ className }: { className?: string }) {
  const { currentVersionLabel, availableVersions, handleVersionChange } =
    useVersion()

  if (availableVersions.length === 0) return null

  return (
    <Menu.Trigger>
      <Button
        className={cn('bdocs-selector bdocs-selector--version', className)}
      >
        <span className="bdocs-selector__version">{currentVersionLabel}</span>
        <ChevronDown className="bdocs-selector__icon bdocs-selector__icon--chevron" />
      </Button>
      <Menu.Root className="bdocs-selector__menu">
        <Menu.Section items={availableVersions}>
          {(version) => (
            <Menu.Item
              key={version.value}
              onAction={() => handleVersionChange(version.value)}
              className="bdocs-selector__option"
            >
              {version.label}
            </Menu.Item>
          )}
        </Menu.Section>
      </Menu.Root>
    </Menu.Trigger>
  )
}
