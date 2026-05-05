import React from 'react'
import { Link, Card as DefaultCard, cn } from 'boltdocs/client'

export const GlassCard = ({ title, icon, children, href, className }: any) => {
  const content = (
    <div className={cn(
      "p-6 rounded-2xl transition-all duration-300 border border-white/10 h-full",
      "bg-white/[0.03] backdrop-blur-xl hover:bg-white/[0.08] hover:border-white/20 hover:scale-[1.02]",
      className
    )}>
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4 text-primary-400">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold mb-2 text-white/90">{title}</h3>
      <div className="text-white/60 leading-relaxed">{children}</div>
    </div>
  )

  if (href) {
    return <Link href={href} className="no-underline block h-full">{content}</Link>
  }

  return content
}
