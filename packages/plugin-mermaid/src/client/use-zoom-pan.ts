import { useCallback, useEffect, useRef, useState } from 'react'

const ZOOM_MIN = 0.25
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

function getTouchDistance(touches: TouchList) {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

export interface ZoomPanState {
  scale: number
  posX: number
  posY: number
  isDragging: boolean
  hasInteracted: boolean
}

interface UseZoomPanOptions {
  resetTrigger?: unknown
}

export function useZoomPan({ resetTrigger }: UseZoomPanOptions = {}) {
  const [scale, setScale] = useState(1)
  const [posX, setPosX] = useState(0)
  const [posY, setPosY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)

  // Container element stored in state so useEffect re-attaches listeners
  // when the element changes (e.g. fullscreen portal creates a new DOM node)
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)

  const dragStart = useRef({ x: 0, y: 0 })
  const posStart = useRef({ x: 0, y: 0 })
  // Track whether a single-touch has committed to dragging (moved past threshold)
  const touchCommitted = useRef(false)
  const pinchRef = useRef<{
    baseScale: number
    basePosX: number
    basePosY: number
    startDistance: number
  } | null>(null)

  // Stale-closure refs for native touch handlers
  const scaleRef = useRef(scale)
  const posXRef = useRef(posX)
  const posYRef = useRef(posY)
  const isDraggingRef = useRef(isDragging)
  scaleRef.current = scale
  posXRef.current = posX
  posYRef.current = posY
  isDraggingRef.current = isDragging

  // Reset zoom on trigger change (theme switch, diagram change)
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetTrigger sole dep
  useEffect(() => {
    setScale(1)
    setPosX(0)
    setPosY(0)
    setHasInteracted(false)
  }, [resetTrigger])

  const resetZoom = useCallback(() => {
    setScale(1)
    setPosX(0)
    setPosY(0)
    setHasInteracted(false)
  }, [])

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(s + ZOOM_STEP, ZOOM_MAX))
    setHasInteracted(true)
  }, [])

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(s - ZOOM_STEP, ZOOM_MIN))
    setHasInteracted(true)
  }, [])

  // ============================================================
  // Touch: native listeners with passive:false
  // ============================================================

  useEffect(() => {
    if (!containerEl) return

    const DRAG_THRESHOLD = 10

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch-zoom: always intercept
        e.preventDefault()
        touchCommitted.current = true
        setIsDragging(true)
        pinchRef.current = {
          baseScale: scaleRef.current,
          basePosX: posXRef.current,
          basePosY: posYRef.current,
          startDistance: getTouchDistance(e.touches),
        }
      } else if (e.touches.length === 1) {
        // Single touch: record start but do NOT preventDefault yet,
        // so the browser can still scroll the page if this turns out
        // to be a scroll gesture rather than a drag gesture.
        touchCommitted.current = false
        dragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
        posStart.current = {
          x: posXRef.current,
          y: posYRef.current,
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const { baseScale, basePosX, basePosY, startDistance } =
          pinchRef.current
        const newDistance = getTouchDistance(e.touches)
        const ratio = newDistance / startDistance
        const newScale = Math.min(
          Math.max(baseScale * ratio, ZOOM_MIN),
          ZOOM_MAX,
        )
        setScale(newScale)
        setPosX(basePosX)
        setPosY(basePosY)
        setHasInteracted(true)
      } else if (e.touches.length === 1) {
        // After a pinch-zoom ends (2→1 fingers), the remaining finger
        // is not a drag gesture — let the browser handle it as a scroll.
        if (pinchRef.current) {
          pinchRef.current = null
          touchCommitted.current = false
          setIsDragging(false)
          return
        }

        const dx = e.touches[0].clientX - dragStart.current.x
        const dy = e.touches[0].clientY - dragStart.current.y

        if (!touchCommitted.current) {
          // Check if movement exceeds threshold to commit to drag
          if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            touchCommitted.current = true
            setIsDragging(true)
          } else {
            return // Not committed yet — let the browser scroll
          }
        }

        e.preventDefault()
        setPosX(posStart.current.x + dx)
        setPosY(posStart.current.y + dy)
        setHasInteracted(true)
      }
    }

    const onTouchEnd = () => {
      pinchRef.current = null
      touchCommitted.current = false
      setIsDragging(false)
    }

    containerEl.addEventListener('touchstart', onTouchStart, { passive: false })
    containerEl.addEventListener('touchmove', onTouchMove, { passive: false })
    containerEl.addEventListener('touchend', onTouchEnd)
    containerEl.addEventListener('touchcancel', onTouchEnd)

    return () => {
      containerEl.removeEventListener('touchstart', onTouchStart)
      containerEl.removeEventListener('touchmove', onTouchMove)
      containerEl.removeEventListener('touchend', onTouchEnd)
      containerEl.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [containerEl])

  // ============================================================
  // Mouse: React synthetic events
  // ============================================================

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setScale((s) => Math.min(Math.max(s + delta, ZOOM_MIN), ZOOM_MAX))
      setHasInteracted(true)
    }
  }, [])

  const handleDoubleClick = useCallback(() => {
    setScale(1)
    setPosX(0)
    setPosY(0)
    setHasInteracted(false)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }
    posStart.current = { x: posXRef.current, y: posYRef.current }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      setPosX(posStart.current.x + (e.clientX - dragStart.current.x))
      setPosY(posStart.current.y + (e.clientY - dragStart.current.y))
    },
    [isDragging],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // ============================================================
  // Callback ref: stores element in state so useEffect re-runs
  // ============================================================

  const callbackRef = useCallback((el: HTMLDivElement | null) => {
    setContainerEl(el)
  }, [])

  const state: ZoomPanState = { scale, posX, posY, isDragging, hasInteracted }

  const interactiveProps = {
    ref: callbackRef,
    style: { touchAction: 'pan-y pinch-zoom' } as React.CSSProperties,
    onWheel: handleWheel,
    onDoubleClick: handleDoubleClick,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseUp,
  }

  return {
    state,
    resetZoom,
    zoomIn,
    zoomOut,
    interactiveProps,
  }
}
