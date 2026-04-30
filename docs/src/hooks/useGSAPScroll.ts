import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

type AnimationType = 
  | 'fade-up' 
  | 'fade-down'
  | 'fade-in' 
  | 'scale-up'
  | 'scale-down'
  | 'slide-left'
  | 'slide-right'
  | 'rotate-up'
  | 'blur-in'
  | 'reveal-clip'

interface GSAPScrollOptions {
  animation?: AnimationType
  trigger?: string
  start?: string
  end?: string
  delay?: number
  duration?: number
  stagger?: number
  scrub?: boolean | number
  y?: number
  scale?: number
  intensity?: number
  clipDirection?: 'top' | 'bottom' | 'left' | 'right'
}

function getAnimationProps(type: AnimationType, intensity: number) {
  switch (type) {
    case 'fade-up':
      return { from: { opacity: 0, y: intensity }, to: { opacity: 1, y: 0 } }
    case 'fade-down':
      return { from: { opacity: 0, y: -intensity }, to: { opacity: 1, y: 0 } }
    case 'fade-in':
      return { from: { opacity: 0, scale: 0.9 }, to: { opacity: 1, scale: 1 } }
    case 'scale-up':
      return { from: { opacity: 0, scale: 0.8, rotate: -5 }, to: { opacity: 1, scale: 1, rotate: 0 } }
    case 'scale-down':
      return { from: { opacity: 0, scale: 1.2 }, to: { opacity: 1, scale: 1 } }
    case 'slide-left':
      return { from: { opacity: 0, x: intensity }, to: { opacity: 1, x: 0 } }
    case 'slide-right':
      return { from: { opacity: 0, x: -intensity }, to: { opacity: 1, x: 0 } }
    case 'rotate-up':
      return { from: { opacity: 0, rotate: 10, scale: 0.9 }, to: { opacity: 1, rotate: 0, scale: 1 } }
    case 'blur-in':
      return { from: { opacity: 0, filter: 'blur(20px)' }, to: { opacity: 1, filter: 'blur(0px)' } }
    case 'reveal-clip':
      return { from: { clipPath: 'inset(100% 0 0 0)' }, to: { clipPath: 'inset(0% 0 0 0)' } }
    default:
      return { from: { opacity: 0 }, to: { opacity: 1 } }
  }
}

export function useGSAPScroll(ref: React.RefObject<HTMLElement | null>, options: GSAPScrollOptions = {}) {
  const {
    animation = 'fade-up',
    start = 'top 90%',
    end = 'bottom 10%',
    delay = 0,
    duration = 1,
    scrub = false,
    y = 60,
    scale = 0.9,
    intensity = 60,
  } = options

  useEffect(() => {
    if (!ref.current) return

    const ctx = gsap.context(() => {
      const { from, to } = getAnimationProps(animation, intensity)
      
      gsap.fromTo(ref.current, from, {
        ...to,
        duration,
        delay,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: ref.current,
          start,
          end,
          scrub,
          toggleActions: 'play none none reverse',
        },
      })
    }, ref)

    return () => ctx.revert()
  }, [ref, animation, start, end, delay, duration, scrub, intensity])
}

export function useGSAPParallax(ref: React.RefObject<HTMLElement | null>, speed: number = 0.15) {
  useEffect(() => {
    if (!ref.current) return

    const ctx = gsap.context(() => {
      gsap.to(ref.current, {
        y: () => speed * 80,
        ease: 'none',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.5,
        },
      })
    }, ref)

    return () => ctx.revert()
  }, [ref, speed])
}

export function useGSAPSectionReveal(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!ref.current) return

    const ctx = gsap.context(() => {
      const element = ref.current!
      
      gsap.fromTo(element, 
        { opacity: 0, y: 60, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 85%',
            end: 'top 50%',
            scrub: false,
            toggleActions: 'play none none reverse',
          },
        }
      )
    }, ref)

    return () => ctx.revert()
  }, [ref])
}

export function useGSAPStaggerIn(ref: React.RefObject<HTMLElement | null>, options: GSAPScrollOptions = {}) {
  const {
    start = 'top 85%',
    end = 'bottom 15%',
    delay = 0,
    duration = 0.6,
    stagger = 0.1,
    y = 40,
    scale = 0.95,
  } = options

  useEffect(() => {
    if (!ref.current) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current!.children,
        { opacity: 0, y, scale, filter: 'blur(10px)' },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: 'blur(0px)',
          duration,
          delay,
          stagger,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: ref.current,
            start,
            end,
            toggleActions: 'play none none reverse',
          },
        }
      )
    }, ref)

    return () => ctx.revert()
  }, [ref, start, end, delay, duration, stagger, y, scale])
}

export function useGSAPExitAnimation(ref: React.RefObject<HTMLElement | null>, direction: 'up' | 'down' | 'left' | 'right' = 'up') {
  useEffect(() => {
    if (!ref.current) return

    const ctx = gsap.context(() => {
      const yValue = direction === 'up' ? -100 : direction === 'down' ? 100 : 0
      const xValue = direction === 'left' ? -100 : direction === 'right' ? 100 : 0

      gsap.to(ref.current, {
        opacity: 0,
        y: yValue,
        x: xValue,
        scale: 0.9,
        duration: 0.5,
        ease: 'power2.in',
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 100%',
          end: 'top 0%',
          scrub: 1,
        },
      })
    }, ref)

    return () => ctx.revert()
  }, [ref, direction])
}