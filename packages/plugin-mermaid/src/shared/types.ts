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
}
