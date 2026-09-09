import type { ComponentType, ReactNode, SVGProps } from 'react'
import DOMPurify from 'isomorphic-dompurify'
import { useOptionalConfig } from '../../app/config-context'
import { resolvePublicAssetUrl } from '../../utils/path'
import * as DefaultIcons from './icons'
import virtualIcons from 'virtual:boltdocs-icons'

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string
}

export type IconValue = string | ComponentType<IconProps>

type IconRegistry = Record<string, ComponentType<IconProps>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function normalizeIconExports(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {}

  const directExports = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'default'),
  )
  const defaultExport = value.default

  if (!isRecord(defaultExport)) return directExports

  return {
    ...normalizeIconExports(defaultExport),
    ...directExports,
  }
}

export function getIconRegistry(): IconRegistry {
  return {
    ...(DefaultIcons as unknown as IconRegistry),
    ...(normalizeIconExports(virtualIcons) as IconRegistry),
  }
}

export function resolveIcon(
  icon: IconValue | undefined,
  registry: IconRegistry = getIconRegistry(),
): IconValue | undefined {
  if (!icon || typeof icon !== 'string') return icon
  if (icon.trim().startsWith('<svg')) return icon
  if (
    /^(?:https?:|data:image\/|\/|\.\.?(?:\/|$))/.test(icon) ||
    /\.(?:svg|png|jpe?g|gif|webp|avif)(?:\?.*)?$/i.test(icon)
  ) {
    return icon
  }

  return registry[icon] || registry[`${icon}Icon`]
}

function isImageSource(value: string): boolean {
  return (
    /^(?:https?:|data:image\/|\/|\.\.?(?:\/|$))/.test(value) ||
    /\.(?:svg|png|jpe?g|gif|webp|avif)(?:\?.*)?$/i.test(value)
  )
}

export function IconRenderer({
  icon,
  size = 16,
  className,
  label,
}: {
  icon?: IconValue
  size?: number | string
  className?: string
  label?: string
}): ReactNode {
  const config = useOptionalConfig()
  const resolved = resolveIcon(icon)
  if (!resolved) return null

  if (typeof resolved === 'function') {
    const Component = resolved
    return (
      <Component
        size={size}
        width={size}
        height={size}
        className={className}
        aria-hidden={label ? undefined : true}
        aria-label={label}
      />
    )
  }

  if (resolved.trim().startsWith('<svg')) {
    const clean = DOMPurify.sanitize(resolved, {
      USE_PROFILES: { svg: true },
    })
    if (label) {
      return (
        <span
          className={className}
          role="img"
          aria-label={label}
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      )
    }
    return (
      <span
        className={className}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    )
  }

  if (isImageSource(resolved)) {
    return (
      <img
        src={resolvePublicAssetUrl(resolved, config?.base)}
        alt={label || ''}
        aria-hidden={label ? undefined : true}
        className={className}
        width={size}
        height={size}
      />
    )
  }

  return null
}
