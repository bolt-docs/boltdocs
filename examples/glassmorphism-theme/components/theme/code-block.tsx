import React, { useState } from 'react'
import { 
  PrimitiveCodeBlock as CodeBlockRoot, 
  CodeBlockHeader, 
  CodeBlockContent, 
  PrimitiveButton as Button,
  cn 
} from 'boltdocs/client'
import { Copy, Check, Terminal } from 'lucide-react'

export const CodeBlock = ({ children, ...props }: any) => {
  const [copied, setCopied] = useState(false)
  const highlightedHtml = props.highlightedHtml || props['data-highlighted-html']

  const getRawCode = (node: any): string => {
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(getRawCode).join('')
    if (node?.props?.children) return getRawCode(node.props.children)
    return ''
  }
  const rawCode = getRawCode(children)

  const handleCopy = () => {
    if (!rawCode && !highlightedHtml) return
    navigator.clipboard.writeText(rawCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <CodeBlockRoot className="!my-8 overflow-hidden rounded-2xl border border-white/10 bg-black/20 backdrop-blur-2xl">
      <CodeBlockHeader className="!bg-white/5 !border-b !border-white/10 !h-11 !px-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-primary-400" />
            <span className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase">Terminal</span>
          </div>
          <Button
            variant="ghost"
            isIconOnly
            onPress={handleCopy}
            className={cn(
              "!h-7 !w-7 !rounded-lg transition-all",
              copied ? "text-emerald-400" : "text-white/30 hover:text-white hover:bg-white/10"
            )}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </Button>
        </div>
      </CodeBlockHeader>
      <CodeBlockContent>
        {highlightedHtml ? (
          <div 
            className="boltdocs-shiki !p-6 !m-0 overflow-x-auto [&>pre]:!m-0 [&>pre]:!p-0 [&>pre]:!bg-transparent"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre {...props} className={cn("!m-0 !p-6 !bg-transparent overflow-x-auto", props.className)}>
            {children}
          </pre>
        )}
      </CodeBlockContent>
    </CodeBlockRoot>
  )
}
