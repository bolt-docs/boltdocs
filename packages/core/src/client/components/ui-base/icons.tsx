export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
}

function createIcon(
  displayName: string,
  paths: React.ReactNode,
  viewBox = '0 0 24 24',
) {
  const Component = ({ size = 24, className, ...props }: IconProps) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        <title>{displayName}</title>
        {paths}
      </svg>
    )
  }
  Component.displayName = displayName
  return Component
}

export const Info = createIcon(
  'Info',
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </>,
)

export const Lightbulb = createIcon(
  'Lightbulb',
  <>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </>,
)

export const AlertTriangle = createIcon(
  'AlertTriangle',
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>,
)

export const AlertCircle = createIcon(
  'AlertCircle',
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </>,
)

export const Copy = createIcon(
  'Copy',
  <>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </>,
)

export const Check = createIcon('Check', <path d="M20 6 9 17l-5-5" />)

export const File = createIcon(
  'File',
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </>,
)

export const ArrowLeft = createIcon(
  'ArrowLeft',
  <>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </>,
)

export const Pencil = createIcon(
  'Pencil',
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </>,
)

export const CircleHelp = createIcon(
  'CircleHelp',
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </>,
)

export const TextAlignStart = createIcon(
  'TextAlignStart',
  <>
    <line x1="21" x2="3" y1="6" y2="6" />
    <line x1="15" x2="3" y1="12" y2="12" />
    <line x1="17" x2="3" y1="18" y2="18" />
  </>,
)

export const ExternalLink = createIcon(
  'ExternalLink',
  <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </>,
)

export const ChevronDown = createIcon('ChevronDown', <path d="m6 9 6 6 6-6" />)

export const Home = createIcon(
  'Home',
  <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </>,
)

export const Search = createIcon(
  'Search',
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>,
)

export const Sun = createIcon(
  'Sun',
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </>,
)

export const Moon = createIcon(
  'Moon',
  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
)

export const Monitor = createIcon(
  'Monitor',
  <>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <line x1="8" x2="16" y1="21" y2="21" />
    <line x1="12" x2="12" y1="17" y2="21" />
  </>,
)

export const Languages = createIcon(
  'Languages',
  <>
    <path d="m5 8 6 6" />
    <path d="m4 14 6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" />
    <path d="M14 18h6" />
  </>,
)

export const Menu = createIcon(
  'Menu',
  <>
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </>,
)

export const X = createIcon(
  'X',
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
)

export const Link = createIcon(
  'Link',
  <>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </>,
)

export const ChevronRight = createIcon(
  'ChevronRight',
  <path d="m9 18 6-6-6-6" />,
)

export const MoreVertical = createIcon(
  'MoreVertical',
  <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </>,
)

export const ChevronLeft = createIcon(
  'ChevronLeft',
  <path d="m15 18-6-6 6-6" />,
)

export const Hash = createIcon(
  'Hash',
  <>
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </>,
)

export const FileText = createIcon(
  'FileText',
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </>,
)

export const CornerDownLeft = createIcon(
  'CornerDownLeft',
  <>
    <polyline points="9 10 4 15 9 20" />
    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
  </>,
)
