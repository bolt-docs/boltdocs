import type { ImgHTMLAttributes } from 'react'
import { useTheme } from '../../app/theme-context'
import { cn } from '../../utils/cn'

export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  theme?: 'light' | 'dark'
}

/**
 * A responsive image component that automatically supports dark and light theme variations
 * via the `theme` prop.
 */
export function Image({ theme, className, ...props }: ImageProps) {
  const { resolvedTheme } = useTheme()

  if (theme && theme !== resolvedTheme) {
    return null
  }

  return (
    <img
      className={cn('max-w-full h-auto rounded-lg my-8', className)}
      {...props}
    />
  )
}
