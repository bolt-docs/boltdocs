import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

type WriteFeedOptions = {
  generateXml: () => string
  filename: string
  outDir: string
  logger: (message: string) => void
  label: string
}

export function writeFeed({
  filename,
  generateXml,
  label,
  logger,
  outDir,
}: WriteFeedOptions) {
  const xml = generateXml()
  const filePath = path.join(outDir, filename)
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, xml, 'utf-8')
  logger(`${label} feed generated: ${filename}`)
}
