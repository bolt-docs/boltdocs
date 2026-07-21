import html from '@shikijs/langs/html'
import js from '@shikijs/langs/js'
import ts from '@shikijs/langs/ts'
import tsx from '@shikijs/langs/tsx'
import css from '@shikijs/langs/css'
import json from '@shikijs/langs/json'
import jsonc from '@shikijs/langs/jsonc'
import bash from '@shikijs/langs/bash'
import ini from '@shikijs/langs/ini'
import markdown from '@shikijs/langs/markdown'
import mdx from '@shikijs/langs/mdx'
import yaml from '@shikijs/langs/yaml'
import rust from '@shikijs/langs/rust'
import toml from '@shikijs/langs/toml'
import csv from '@shikijs/langs/csv'

/**
 * Collection of bundled Shiki languages.
 *
 * Tuned for documentation sites — covers the common fenced-block languages
 * that appear in Markdown/MDX content (config files, dotenv, JSON5, etc.).
 */
export const LANG_BUILD: any[] = [
  html,
  js,
  ts,
  tsx,
  css,
  json,
  jsonc,
  bash,
  ini,
  markdown,
  mdx,
  yaml,
  rust,
  toml,
  csv,
]

export type Languages =
  | 'html'
  | 'js'
  | 'ts'
  | 'tsx'
  | 'css'
  | 'bash'
  | 'json'
  | 'jsonc'
  | 'ini'
  | 'markdown'
  | 'mdx'
  | 'yaml'
  | 'rust'
  | 'toml'
  | 'csv'
