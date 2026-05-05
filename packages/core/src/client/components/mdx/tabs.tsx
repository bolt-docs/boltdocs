import { Children, isValidElement, useMemo } from 'react'
import * as RAC from 'react-aria-components'
import { useTabs } from './hooks/useTabs'
import { cn } from '../../utils/cn'
import { CodeBlock } from './code-block'
import { cva } from 'class-variance-authority'

const tabListVariants = cva(
  'relative flex items-center border-b border-subtle gap-1 overflow-x-auto no-scrollbar',
  {
    variants: {
      size: {
        default: 'px-0',
        compact: 'px-2',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

const tabItemVariants = cva(
  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium outline-none transition-all duration-200 cursor-pointer bg-transparent border-none select-none whitespace-nowrap',
  {
    variants: {
      isActive: {
        true: 'text-primary-500',
        false: 'text-muted hover:text-body',
      },
      isDisabled: {
        true: 'opacity-40 pointer-events-none',
        false: '',
      },
    },
    defaultVariants: {
      isActive: false,
      isDisabled: false,
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

export interface TabsProps {
  defaultIndex?: number
  children: React.ReactNode
}

export function Tabs({ defaultIndex = 0, children }: TabsProps) {
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
          className={cn(tabListVariants())}
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
                  cn(tabItemVariants({ isActive: isSelected, isDisabled }))
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

          <div
            className="absolute bottom-0 h-0.5 bg-primary-500 transition-all duration-300 ease-in-out pointer-events-none"
            style={indicatorStyle}
            aria-hidden="true"
          />
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
