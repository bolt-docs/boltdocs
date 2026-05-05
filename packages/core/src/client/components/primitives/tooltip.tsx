import type { ReactNode } from 'react'
import * as RAC from 'react-aria-components'
import { cn } from '../../utils/cn'

export interface TooltipProps extends Omit<RAC.TooltipProps, 'children'> {
  /** The content to show inside the tooltip */
  content: ReactNode
  /** The trigger element (usually a button or link) */
  children: React.ReactElement
  /** Delay in milliseconds before showing the tooltip */
  delay?: number
  /** Delay in milliseconds before hiding the tooltip */
  closeDelay?: number
}

// Fixed type for TooltipContentProps to match RAC's internal expectations
export interface TooltipContentProps extends RAC.TooltipProps {}

/**
 * Modern, accessible Tooltip component built with React Aria Components.
 * Featuring glassmorphism, animations, and smart positioning.
 */
const TooltipContent = ({
  className,
  children,
  ...props
}: TooltipContentProps) => {
  return (
    <RAC.Tooltip
      {...props}
      offset={8}
      className={(values) =>
        cn(
          'group z-50 overflow-visible rounded-md bg-surface/90 px-2.5 py-1.5 text-xs font-medium text-body shadow-lg backdrop-blur-md ring-1 ring-subtle outline-hidden select-none',
          'data-entering:animate-in data-entering:fade-in data-entering:zoom-in-95 data-entering:duration-100',
          'data-exiting:animate-out data-exiting:fade-out data-exiting:zoom-out-95 data-exiting:duration-75',
          'data-[placement=top]:slide-in-from-bottom-1',
          'data-[placement=bottom]:slide-in-from-top-1',
          'data-[placement=left]:slide-in-from-right-1',
          'data-[placement=right]:slide-in-from-left-1',
          typeof className === 'function' ? className(values) : className,
        )
      }
    >
      {(values) => (
        <>
          <RAC.OverlayArrow>
            <svg
              width={8}
              height={8}
              viewBox="0 0 8 8"
              className="fill-bg-surface/90 stroke-border-subtle group-data-[placement=bottom]:rotate-180 group-data-[placement=left]:-rotate-90 group-data-[placement=right]:rotate-90"
            >
              <title>Arrow</title>
              <path d="M0 0 L4 4 L8 0" />
            </svg>
          </RAC.OverlayArrow>
          {typeof children === 'function' ? children(values) : children}
        </>
      )}
    </RAC.Tooltip>
  )
}

export const Tooltip = ({
  content,
  children,
  delay = 500,
  closeDelay = 0,
  ...props
}: TooltipProps) => {
  return (
    <RAC.TooltipTrigger delay={delay} closeDelay={closeDelay}>
      {children}
      <TooltipContent {...props}>{content}</TooltipContent>
    </RAC.TooltipTrigger>
  )
}

Tooltip.Root = Tooltip
Tooltip.Content = TooltipContent
