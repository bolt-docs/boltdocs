import fs from 'node:fs'
import path from 'node:path'

export function copy(
  src: string,
  dest: string,
  replacements: Record<string, string>,
): void {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const file of fs.readdirSync(src)) {
      copy(path.resolve(src, file), path.resolve(dest, file), replacements)
    }
  } else {
    const isTextFile = !/\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz)$/i.test(src)
    if (isTextFile) {
      let content = fs.readFileSync(src, 'utf-8')
      for (const [key, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
      }
      fs.writeFileSync(dest, content)
    } else {
      fs.copyFileSync(src, dest)
    }
  }
}

export function writeDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}

export function writeFile(filePath: string, content: string): void {
  writeDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf-8')
}
