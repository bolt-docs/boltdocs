export function getPackageManager(): string {
  const userAgent = process.env.npm_config_user_agent
  if (userAgent?.includes('pnpm')) return 'pnpm'
  if (userAgent?.includes('yarn')) return 'yarn'
  if (userAgent?.includes('bun')) return 'bun'
  return 'npm'
}
