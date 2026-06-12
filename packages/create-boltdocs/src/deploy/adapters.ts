import path from 'node:path'
import { writeFile } from '../utils/file-system'

export function adaptersDeploy(projectDir: string, deployTarget: string): void {
  if (deployTarget === 'vercel') {
    writeFile(
      path.join(projectDir, 'api', 'feedback.ts'),
      `import { handleVercelFeedback } from 'boltdocs'\n\nexport default handleVercelFeedback\n`,
    )
  } else if (deployTarget === 'netlify') {
    writeFile(
      path.join(projectDir, 'netlify', 'functions', 'feedback.ts'),
      `import { handleNetlifyFeedback } from 'boltdocs'\n\nexport const handler = handleNetlifyFeedback\n`,
    )
    writeFile(
      path.join(projectDir, 'netlify.toml'),
      `[build]\n  command = "npm run build"\n  publish = "dist"\n\n[[redirects]]\n  from = "/api/feedback"\n  to = "/.netlify/functions/feedback"\n  status = 200\n`,
    )
  } else if (deployTarget === 'cloudflare') {
    writeFile(
      path.join(projectDir, 'functions', 'api', 'feedback.ts'),
      `import { handleWebFeedback } from 'boltdocs'\n\nexport const onRequest = async (context: any) => {\n  const { request, env } = context\n  return handleWebFeedback(request, env)\n}\n`,
    )
  } else if (deployTarget === 'aws') {
    writeFile(
      path.join(projectDir, 'lambda', 'feedback.ts'),
      `import { handleAwsFeedback } from 'boltdocs'\n\nexport const handler = handleAwsFeedback\n`,
    )
  }
}
