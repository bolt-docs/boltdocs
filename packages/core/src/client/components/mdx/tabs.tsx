import { Children, isValidElement, useMemo } from 'react'
import * as RAC from 'react-aria-components'
import { useTabs } from './hooks/useTabs'
import { cn } from '../../utils/cn'
import { CodeBlock } from './code-block'
import { cva, type VariantProps } from 'class-variance-authority'

const tabListVariants = cva(
  'relative flex items-center gap-1 overflow-x-auto no-scrollbar transition-all duration-300',
  {
    variants: {
      variant: {
        default: 'border-b border-subtle px-0 pb-px',
        bordered: 'border border-subtle bg-transparent p-1.5 rounded-xl',
        card: 'border border-subtle bg-surface p-1.5 rounded-xl shadow-xs',
        ghost: 'bg-soft/30 p-1.5 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'card',
    },
  },
)

export interface TabProps {
  label: string
  icon?: React.ReactNode
  disabled?: boolean
  children: React.ReactNode
}

export function Tab({ children }: TabProps) {
  const content =
    typeof children === 'string' ? (
      <CodeBlock className="language-bash">
        <code>{children.trim()}</code>
      </CodeBlock>
    ) : (
      children
    )

  return <div className="py-4">{content}</div>
}

export interface TabsProps extends VariantProps<typeof tabListVariants> {
  defaultIndex?: number
  children: React.ReactNode
}

export function Tabs({ defaultIndex = 0, children, variant }: TabsProps) {
  const tabs = useMemo(() => {
    return Children.toArray(children).filter(
      (child) =>
        isValidElement(child) &&
        (child as React.ReactElement<TabProps>).props?.label,
    ) as React.ReactElement<TabProps>[]
  }, [children])

  const { active, setActive, tabRefs, indicatorStyle } = useTabs({
    initialIndex: defaultIndex,
    tabs,
  })

  return (
    <div className="my-8 w-full group/tabs">
      <RAC.Tabs
        selectedKey={active.toString()}
        onSelectionChange={(key) => setActive(Number(key))}
        className="w-full"
      >
        <RAC.TabList
          aria-label="Content Tabs"
          className={tabListVariants({ variant })}
        >
          {tabs.map((child, i) => {
            const { label, icon, disabled } = child.props
            const key = i.toString()

            return (
              <RAC.Tab
                key={key}
                id={key}
                isDisabled={disabled}
                ref={(el: any) => {
                  tabRefs.current[i] = el
                }}
                className={({ isSelected, isDisabled }) =>
                  cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium outline-none transition-all duration-200 cursor-pointer select-none whitespace-nowrap rounded-lg',
                    isDisabled && 'opacity-40 pointer-events-none',
                    variant === 'default' && [
                      'rounded-none border-b-2 border-transparent bg-transparent py-2.5',
                      isSelected
                        ? 'text-primary-500 font-semibold'
                        : 'text-muted hover:text-body',
                    ],
                    variant === 'bordered' && [
                      'px-3.5 py-1.5',
                      isSelected
                        ? 'bg-primary-500 text-white shadow-xs'
                        : 'text-muted hover:text-body hover:bg-soft/50',
                    ],
                    variant === 'card' && [
                      'px-3.5 py-1.5',
                      isSelected
                        ? 'bg-surface text-primary-500 shadow-xs border border-subtle'
                        : 'text-muted hover:text-body hover:bg-soft/30',
                    ],
                    variant === 'ghost' && [
                      'px-3.5 py-1.5',
                      isSelected
                        ? 'bg-soft text-body shadow-3xs'
                        : 'text-muted hover:text-body hover:bg-soft/30',
                    ],
                  )
                }
              >
                {!!icon && (
                  <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">
                    {icon}
                  </span>
                )}
                <span>{label}</span>
              </RAC.Tab>
            )
          })}

          {variant === 'default' && (
            <div
              className="absolute bottom-0 h-0.5 bg-primary-500 transition-all duration-300 ease-in-out pointer-events-none"
              style={indicatorStyle}
              aria-hidden="true"
            />
          )}
        </RAC.TabList>

        {tabs.map((_tab, i) => (
          <RAC.TabPanel key={i} id={i.toString()}>
            {/* biome-ignore lint/suspicious/noExplicitAny: bypass version-specific ReactNode mismatch */}
            {tabs[i] as any}
          </RAC.TabPanel>
        ))}
      </RAC.Tabs>
    </div>
  )
}
