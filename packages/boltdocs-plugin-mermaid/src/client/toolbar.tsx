import {
  CollapseIcon,
  ExpandIcon,
  MinusIcon,
  PlusIcon,
  ResetIcon,
} from './icons'

interface ToolbarProps {
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  hasInteracted: boolean
  toggleFullscreen?: () => void
  mode?: 'normal' | 'fullscreen'
}

export function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex size-7 p-2 items-center justify-center rounded-md border border-subtle bg-surface/60 text-secondary/70 backdrop-blur-sm transition-colors hover:bg-surface/90 hover:text-secondary shadow-sm"
    >
      {children}
    </button>
  )
}

export function Toolbar({
  zoomIn,
  zoomOut,
  resetZoom,
  toggleFullscreen,
  hasInteracted,
  mode = 'normal',
}: ToolbarProps) {
  return (
    <>
      {hasInteracted && (
        <ToolbarButton onClick={resetZoom} title="Reset zoom">
          <ResetIcon size={14} />
        </ToolbarButton>
      )}
      <ToolbarButton onClick={zoomIn} title="Zoom in">
        <PlusIcon size={14} />
      </ToolbarButton>
      <ToolbarButton onClick={zoomOut} title="Zoom out">
        <MinusIcon size={14} />
      </ToolbarButton>
      {toggleFullscreen && (
        <ToolbarButton
          onClick={toggleFullscreen}
          title={mode === 'fullscreen' ? 'Exit fullscreen' : 'Expand'}
        >
          {mode === 'fullscreen' ? (
            <CollapseIcon size={14} />
          ) : (
            <ExpandIcon size={14} />
          )}
        </ToolbarButton>
      )}
    </>
  )
}
