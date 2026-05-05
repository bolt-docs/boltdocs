import React from 'react'
import { Note as DefaultNote, Tip as DefaultTip, Warning as DefaultWarning, Important as DefaultImportant } from 'boltdocs/client'

export const Note = (props: any) => (
  <DefaultNote {...props} className="glass-callout !border-blue-500/30 !bg-blue-500/5" />
)

export const Tip = (props: any) => (
  <DefaultTip {...props} className="glass-callout !border-emerald-500/30 !bg-emerald-500/5" />
)

export const Warning = (props: any) => (
  <DefaultWarning {...props} className="glass-callout !border-amber-500/30 !bg-amber-500/5" />
)

export const Important = (props: any) => (
  <DefaultImportant {...props} className="glass-callout !border-purple-500/30 !bg-purple-500/5" />
)
