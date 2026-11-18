import * as React from 'react'
import {
  cn,
  composeRenderProps,
  filterDOMProps,
  type RenderProps,
} from './utils'

/**
 * The disclosure pattern: a control that reveals and hides a region.
 *
 * This is the behaviour that a sidebar group, an accordion item and an
 * "advanced options" row all share. The primitive owns only the state and the
 * aria pairing; the theme owns every visible pixel and the panel markup.
 */

export interface DisclosureRenderProps {
  isOpen: boolean
  isDisabled: boolean
}

export interface DisclosureProps
  extends Omit<
      React.HTMLAttributes<HTMLDivElement>,
      'children' | 'className' | 'style'
    >,
    RenderProps<DisclosureRenderProps> {
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  isDisabled?: boolean
  children?:
    | React.ReactNode
    | ((props: DisclosureRenderProps) => React.ReactNode)
}

interface DisclosureContextValue {
  isOpen: boolean
  setOpen: (open: boolean) => void
  triggerId: string
  panelId: string
  isDisabled: boolean
}

const DisclosureContext = React.createContext<DisclosureContextValue | null>(
  null,
)

function useDisclosure(component: string): DisclosureContextValue {
  const ctx = React.useContext(DisclosureContext)
  if (!ctx)
    throw new Error(`<${component}> must be rendered inside <Disclosure>.`)
  return ctx
}

export function Disclosure(props: DisclosureProps): React.ReactElement {
  const {
    isOpen: controlledOpen,
    defaultOpen = false,
    onOpenChange,
    isDisabled = false,
    children,
    className,
    style,
    ...rest
  } = props

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isOpen = controlledOpen ?? uncontrolledOpen
  const setOpen = React.useCallback(
    (open: boolean) => {
      if (controlledOpen === undefined) setUncontrolledOpen(open)
      onOpenChange?.(open)
    },
    [controlledOpen, onOpenChange],
  )

  const baseId = `bdocs-disclosure-${React.useId()}`
  const ctx = React.useMemo<DisclosureContextValue>(
    () => ({
      isOpen,
      setOpen,
      triggerId: `${baseId}-trigger`,
      panelId: `${baseId}-panel`,
      isDisabled,
    }),
    [isOpen, setOpen, baseId, isDisabled],
  )

  const { domProps } = filterDOMProps(rest as Record<string, unknown>)
  const resolved = composeRenderProps<DisclosureRenderProps>(
    { className, style, children },
    { isOpen, isDisabled },
  )

  return (
    <DisclosureContext.Provider value={ctx}>
      <div
        data-bdocs-disclosure=""
        {...domProps}
        className={resolved.className}
        style={resolved.style}
      >
        {resolved.children}
      </div>
    </DisclosureContext.Provider>
  )
}

Disclosure.displayName = 'Disclosure'

const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea'])

export interface DisclosureTriggerProps {
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

/**
 * The control that toggles the panel.
 *
 * A component or a native control is cloned so an existing `<button>` from the
 * theme stays a button — wrapping it would nest buttons. Anything else gets a
 * real `<button>` around it, because a styled `<div>` is not keyboard reachable.
 */
export function DisclosureTrigger(
  props: DisclosureTriggerProps,
): React.ReactElement {
  const { children, className, disabled } = props
  const ctx = useDisclosure('DisclosureTrigger')
  const isDisabled = disabled ?? ctx.isDisabled

  const triggerProps = {
    id: ctx.triggerId,
    type: 'button' as const,
    'aria-expanded': ctx.isOpen,
    'aria-controls': ctx.panelId,
    'data-open': ctx.isOpen || undefined,
    disabled: isDisabled,
    onClick: (event: React.MouseEvent) => {
      if (isDisabled) {
        event.preventDefault()
        return
      }
      ctx.setOpen(!ctx.isOpen)
    },
  }

  const child = React.Children.toArray(children)[0]
  const isControl =
    React.isValidElement(child) &&
    (typeof child.type !== 'string' ||
      INTERACTIVE_TAGS.has(child.type as string))

  if (isControl) {
    const element = child as React.ReactElement<Record<string, unknown>>
    return React.cloneElement(element, {
      ...triggerProps,
      className: cn(className, element.props.className as string | undefined),
    })
  }

  return React.createElement('button', { ...triggerProps, className }, children)
}

DisclosureTrigger.displayName = 'DisclosureTrigger'

export interface DisclosurePanelProps
  extends Omit<
      React.HTMLAttributes<HTMLDivElement>,
      'children' | 'className' | 'style'
    >,
    RenderProps<DisclosureRenderProps> {
  children?:
    | React.ReactNode
    | ((props: DisclosureRenderProps) => React.ReactNode)
  /** Render the panel even when closed. Useful for CSS transitions. */
  forceMount?: boolean
}

export function DisclosurePanel(
  props: DisclosurePanelProps,
): React.ReactElement {
  const { children, className, style, forceMount = false, ...rest } = props
  const ctx = useDisclosure('DisclosurePanel')
  const resolved = composeRenderProps<DisclosureRenderProps>(
    { className, style, children },
    { isOpen: ctx.isOpen, isDisabled: ctx.isDisabled },
  )
  const { domProps } = filterDOMProps(rest as Record<string, unknown>)

  if (!ctx.isOpen && !forceMount) return <></>

  return (
    <div
      {...domProps}
      id={ctx.panelId}
      role="region"
      aria-labelledby={ctx.triggerId}
      data-open={ctx.isOpen || undefined}
      className={resolved.className}
      style={resolved.style}
    >
      {resolved.children}
    </div>
  )
}

DisclosurePanel.displayName = 'DisclosurePanel'
