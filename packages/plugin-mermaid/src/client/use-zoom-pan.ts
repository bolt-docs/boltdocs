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

  const dragStart = useRef({ x: 0, y: 0 })
  const posStart = useRef({ x: 0, y: 0 })
  const touchCommitted = useRef(false)
  const pinchRef = useRef<{
    baseScale: number
    basePosX: number
    basePosY: number
    startDistance: number
  } | null>(null)

  // Stale-closure refs for native handlers
  const scaleRef = useRef(scale)
  const posXRef = useRef(posX)
  const posYRef = useRef(posY)
  const isDraggingRef = useRef(isDragging)
  scaleRef.current = scale
  posXRef.current = posX
  posYRef.current = posY
  isDraggingRef.current = isDragging

  // Store previous container element and its cleanup so we can tear down
  // listeners when the element reference changes (e.g. fullscreen portal).
  const cleanupRef = useRef<(() => void) | null>(null)
  const prevElRef = useRef<HTMLDivElement | null>(null)

  // Reset zoom on trigger change
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

  const attachListeners = useCallback((el: HTMLDivElement) => {
    const DRAG_THRESHOLD = 10

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setScale((s) => Math.min(Math.max(s + delta, ZOOM_MIN), ZOOM_MAX))
      setHasInteracted(true)
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
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
        if (pinchRef.current) {
          pinchRef.current = null
          touchCommitted.current = false
          setIsDragging(false)
          return
        }

        const dx = e.touches[0].clientX - dragStart.current.x
        const dy = e.touches[0].clientY - dragStart.current.y

        if (!touchCommitted.current) {
          if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            touchCommitted.current = true
            setIsDragging(true)
          } else {
            return
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

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)

    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  // ============================================================
  // Mouse: React synthetic events
  // ============================================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY }
    posStart.current = { x: posXRef.current, y: posYRef.current }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current) return
    setPosX(posStart.current.x + (e.clientX - dragStart.current.x))
    setPosY(posStart.current.y + (e.clientY - dragStart.current.y))
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const callbackRef = useCallback(
    (el: HTMLDivElement | null) => {
      // Clean up listeners from the previous element
      if (prevElRef.current && prevElRef.current !== el) {
        cleanupRef.current?.()
        cleanupRef.current = null
      }
      if (el) {
        cleanupRef.current = attachListeners(el)
        prevElRef.current = el
      } else {
        cleanupRef.current = null
        prevElRef.current = null
      }
    },
    [attachListeners],
  )

  const state: ZoomPanState = { scale, posX, posY, isDragging, hasInteracted }

  const interactiveProps = {
    ref: callbackRef,
    style: {
      touchAction: 'pan-y pinch-zoom',
      cursor: isDragging ? 'grabbing' : 'grab',
    } as React.CSSProperties,
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
