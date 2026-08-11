import type { ImgHTMLAttributes } from 'react'
import { useTheme } from '../../app/theme-context'
import { cn } from '../../utils/cn'
import { resolvePublicAssetUrl } from '../../utils/path'
import { useConfig } from '../../app/config-context'

export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  theme?: 'light' | 'dark'
}

/**
 * A responsive image component that automatically supports dark and light theme variations
 * via the `theme` prop.
 */
export function Image({ theme, className, src, ...props }: ImageProps) {
  const { resolvedTheme } = useTheme()
  const config = useConfig()

  if (theme && theme !== resolvedTheme) {
    return null
  }

  return (
    <img
      className={cn('max-w-full h-auto rounded-lg my-8', className)}
      {...props}
      src={
        typeof src === 'string' ? resolvePublicAssetUrl(src, config.base) : src
      }
    />
  )
}
