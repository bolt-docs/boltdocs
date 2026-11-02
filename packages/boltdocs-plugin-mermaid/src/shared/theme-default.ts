import type { MermaidThemeVariables } from './types'

export const defaultTheme: {
  light: MermaidThemeVariables
  dark: MermaidThemeVariables
} = {
  light: {
    primaryColor: '#f8fafc',
    primaryTextColor: '#0f172a',
    primaryBorderColor: '#e2e8f0',
    lineColor: '#64748b',
    secondaryColor: '#f1f5f9',
    tertiaryColor: '#ffffff',
    nodeBorder: '#e2e8f0',
    mainBkg: '#ffffff',
    nodeTextColor: '#0f172a',
    edgeLabelBackground: '#f8fafc',
    clusterBkg: '#f8fafc',
    clusterBorder: '#e2e8f0',
  },
  dark: {
    primaryColor: '#1e293b',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#334155',
    lineColor: '#94a3b8',
    secondaryColor: '#0f172a',
    tertiaryColor: '#1e293b',
    nodeBorder: '#334155',
    mainBkg: '#0f172a',
    nodeTextColor: '#f8fafc',
    edgeLabelBackground: '#1e293b',
    clusterBkg: '#1e293b',
    clusterBorder: '#334155',
  },
}
