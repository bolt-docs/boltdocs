import { highlight } from './highlighter'
import { showLineNumbers } from './transformers/show-line-numbers'
import { showWordWrap } from './transformers/show-word-wrap'
import {
  addTitleProperty,
  addLanguageProperty,
} from './transformers/add-to-pre-element'
import type { BoltdocsConfig } from '../config'
import type { CodeToHastOptions } from 'shiki'

/**
 * Unified Shiki Adapter for Boltdocs.
 * Centralizes theme resolution, transformer configuration, and rendering logic.
 */
export class ShikiAdapter {
  private config: BoltdocsConfig | undefined

  constructor(config?: BoltdocsConfig) {
    this.config = config
  }

  /**
   * Resolves the code theme from Boltdocs configuration.
   */
  getTheme() {
    return (
      this.config?.theme?.codeTheme || {
        light: 'github-light',
        dark: 'github-dark',
      }
    )
  }

  /**
   * Creates a Shiki highlighter instance with the configured themes.
   */
  async getHighlighter() {
    return await highlight(this.getTheme())
  }

  /**
   * Assembles Shiki options including transformers for a specific code block.
   */
  getOptions(lang: string, meta: string): CodeToHastOptions {
    const theme = this.getTheme()
    const options: any = {
      lang,
      meta: { __raw: meta },
      transformers: [
        showLineNumbers(),
        showWordWrap(),
        addTitleProperty(),
        addLanguageProperty(),
      ],
    }

    if (typeof theme === 'object') {
      options.themes = {
        light: theme.light,
        dark: theme.dark,
      }
    } else {
      options.theme = theme
    }

    return options
  }

  /**
   * Renders code to HTML using the Boltdocs Shiki pipeline.
   */
  async render(code: string, lang: string, meta: string) {
    const highlighter = await this.getHighlighter()
    const options = this.getOptions(lang, meta)
    return highlighter.codeToHtml(code, options)
  }
}
