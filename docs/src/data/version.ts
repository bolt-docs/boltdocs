import ver from './version.json'

export function getVersion(): string {
  return ver.latest
}
