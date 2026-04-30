import { CheckCircle2, Copy, Terminal as TerminalIcon } from 'lucide-react'
import { useState, useEffect } from 'react'

export const Terminal = () => {
  const [copied, setCopied] = useState(false)
  const [text2, setText2] = useState('')
  const [text3, setText3] = useState('')
  const [show3, setShow3] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const line2Full = '⠿ Initializing Boltdocs template...'
  const line3Full = '✔ Project created successfully'
  const command = 'pnpx create-boltdocs@latest'

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      let i = 0
      const interval = setInterval(() => {
        setText2(line2Full.slice(0, i + 1))
        i++
        if (i >= line2Full.length) {
          clearInterval(interval)
          setTimeout(() => setShow3(true), 300)
        }
      }, 25)
    }, 500)

    return () => clearTimeout(startTimeout)
  }, [])

  useEffect(() => {
    if (!show3) return

    let i = 0
    const interval = setInterval(() => {
      setText3(line3Full.slice(0, i + 1))
      i++
      if (i >= line3Full.length) {
        clearInterval(interval)
        setIsComplete(true)
      }
    }, 25)

    return () => clearInterval(interval)
  }, [show3])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-2xl mx-auto relative group">
      <div className="relative bg-[#0D1117] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#161B22] border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <div className="flex items-center gap-2 ml-3">
              <TerminalIcon className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[11px] font-medium text-white/50 tracking-wide">
                bash
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={copyToClipboard}
            className="p-1.5 rounded-md hover:bg-white/5 transition-colors group/copy"
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4 text-white/30 group-hover/copy:text-white/60 transition-colors" />
            )}
          </button>
        </div>

        <div className="p-5 font-mono text-sm text-left min-h-[130px]">
          <div className="flex items-center gap-3">
            <span className="text-white/25 select-none text-xs">$</span>
            <span className="text-primary-300 font-medium">{command}</span>
          </div>

          <div className="flex items-center gap-3 mt-2.5">
            <span className="text-purple-400 select-none text-xs">›</span>
            <div className="flex-1 text-purple-400 text-sm">
              {text2}
              {text2 !== line2Full && text2 !== '' && (
                <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-primary-400 animate-pulse" />
              )}
            </div>
          </div>

          {show3 && (
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-green-400 select-none text-xs">›</span>
              <div className="flex-1 text-green-400 text-sm flex items-center">
                {text3}
                {isComplete ? (
                  <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-green-400/60 bg-green-400/10 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    Done
                  </span>
                ) : (
                  <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-primary-400 animate-pulse" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
