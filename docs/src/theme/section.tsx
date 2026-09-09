import type { ReactNode } from 'react'

interface SectionProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

const paddingClasses = {
  none: '',
  sm: 'py-16 md:py-20',
  md: 'py-24 md:py-28',
  lg: 'py-32 md:py-40',
  xl: 'py-40 md:py-48',
}

const maxWidthClasses = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
  '2xl': 'max-w-8xl',
  full: 'max-w-full',
}

export const Section = ({
  children,
  className = '',
  padding = 'sm',
  maxWidth = 'xl',
}: SectionProps) => {
  return (
    <section
      className={`px-6 md:px-12 ${paddingClasses[padding]} ${maxWidthClasses[maxWidth]} mx-auto ${className}`}
    >
      {children}
    </section>
  )
}
