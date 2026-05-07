import React, { useState } from 'react'
import { PrimitiveButton as Button, cn } from 'boltdocs/client'
import { Copy, Check } from 'lucide-react'

export const CustomCopyMarkdown = ({ mdxRaw }: any) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!mdxRaw) return
    navigator.clipboard.writeText(mdxRaw)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      onPress={handleCopy}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300',
        'bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] hover:border-white/20',
        copied ? 'text-emerald-400' : 'text-white/60 hover:text-white',
      )}
    >
      {copied ? (
        <>
          <Check size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">
            Copied
          </span>
        </>
      ) : (
        <>
          <Copy size={14} />
          <span className="text-xs font-bold uppercase tracking-wider">
            Copy MDX
          </span>
        </>
      )}
    </Button>
  )
}
