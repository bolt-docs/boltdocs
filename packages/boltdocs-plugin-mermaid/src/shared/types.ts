export interface MermaidThemeVariables {
  primaryColor?: string
  primaryTextColor?: string
  primaryBorderColor?: string
  lineColor?: string
  secondaryColor?: string
  tertiaryColor?: string
  nodeBorder?: string
  mainBkg?: string
  nodeTextColor?: string
  edgeLabelBackground?: string
  clusterBkg?: string
  clusterBorder?: string
  [key: string]: string | undefined
}

export interface MermaidPluginOptions {
  themes?: {
    light?: MermaidThemeVariables
    dark?: MermaidThemeVariables
  }
  /**
   * Pre-render diagrams to SVG at build-time (Node.js).
   * Defaults to `true` when `NODE_ENV=production` (SSG/build).
   * Set to `false` to always render on the client (e.g. dev mode).
   */
  preRender?: boolean
}
