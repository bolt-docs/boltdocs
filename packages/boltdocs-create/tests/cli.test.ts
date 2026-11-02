import { describe, it, expect } from 'vitest'
import { parseArgs } from '../src/cli'
describe('CLI arguments parser', () => {
  it('should parse positional project name', () => {
    const result = parseArgs(['my-project'])
    expect(result.projectName).toBe('my-project')
    expect(result.template).toBe('')
    expect(result.deployTarget).toBe('')
    expect(result.install).toBeUndefined()
    expect(result.iconLibrary).toBe('')
  })

  it('should parse --name and -n arguments', () => {
    const result1 = parseArgs(['--name', 'my-name'])
    expect(result1.projectName).toBe('my-name')

    const result2 = parseArgs(['-n', 'my-name-2'])
    expect(result2.projectName).toBe('my-name-2')

    const result3 = parseArgs(['--projectName', 'my-name-3'])
    expect(result3.projectName).toBe('my-name-3')
  })

  it('should parse --template and -t arguments', () => {
    const result1 = parseArgs(['my-project', '--template', 'i18n'])
    expect(result1.template).toBe('i18n')

    const result2 = parseArgs(['my-project', '-t', 'base'])
    expect(result2.template).toBe('base')

    const result3 = parseArgs(['my-project', '-t', 'blog'])
    expect(result3.template).toBe('blog')
  })

  it('should parse --deploy and -d arguments', () => {
    const result1 = parseArgs(['my-project', '--deploy', 'vercel'])
    expect(result1.deployTarget).toBe('vercel')

    const result2 = parseArgs(['my-project', '-d', 'netlify'])
    expect(result2.deployTarget).toBe('netlify')
  })

  it('should parse install flags', () => {
    const result1 = parseArgs(['my-project', '--install'])
    expect(result1.install).toBe(true)

    const result2 = parseArgs(['my-project', '-i'])
    expect(result2.install).toBe(true)

    const result3 = parseArgs(['my-project', '--no-install'])
    expect(result3.install).toBe(false)
  })

  it('should correctly merge multiple arguments', () => {
    const result = parseArgs([
      '--name',
      'cool-docs',
      '-t',
      'i18n',
      '--deploy',
      'aws',
      '--no-install',
      '--icon-library',
      'lucide-react',
    ])

    expect(result.projectName).toBe('cool-docs')
    expect(result.template).toBe('i18n')
    expect(result.deployTarget).toBe('aws')
    expect(result.install).toBe(false)
    expect(result.iconLibrary).toBe('lucide-react')
  })

  it('should parse icon library flags', () => {
    const result1 = parseArgs(['my-project', '--icon-library', 'lucide-react'])
    expect(result1.iconLibrary).toBe('lucide-react')

    const result2 = parseArgs([
      'my-project',
      '--icon-library',
      '@heroicons/react',
    ])
    expect(result2.iconLibrary).toBe('@heroicons/react')

    const result3 = parseArgs([
      'my-project',
      '--icon-library',
      '@phosphor-icons/react',
    ])
    expect(result3.iconLibrary).toBe('@phosphor-icons/react')
  })
})
