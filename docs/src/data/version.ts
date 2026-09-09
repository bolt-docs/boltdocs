import ver from '@/data/version.json'

export function getVersion(): string {
  return ver.latest
}
