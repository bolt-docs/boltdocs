import { describe, it, expect } from 'vitest'
import { isNewerVersion, renderUpdateBox } from '../src/node/update-check'

describe('update-check', () => {
  describe('isNewerVersion', () => {
    it('should detect a newer major version', () => {
      expect(isNewerVersion('3.0.0', '2.0.0')).toBe(true)
    })

    it('should detect a newer minor version', () => {
      expect(isNewerVersion('2.8.0', '2.7.8')).toBe(true)
    })

    it('should detect a newer patch version', () => {
      expect(isNewerVersion('2.7.9', '2.7.8')).toBe(true)
    })

    it('should return false for same version', () => {
      expect(isNewerVersion('2.7.8', '2.7.8')).toBe(false)
    })

    it('should return false for older version', () => {
      expect(isNewerVersion('2.7.0', '2.8.0')).toBe(false)
    })

    it('should strip pre-release tags before comparing', () => {
      expect(isNewerVersion('1.0.0', '0.9.9-rc1')).toBe(true)
      expect(isNewerVersion('1.0.0-rc1', '1.0.0')).toBe(false)
    })
  })

  describe('renderUpdateBox', () => {
    it('should render a box with version info', () => {
      const output = renderUpdateBox('1.0.0', '2.0.0')
      expect(output).toContain('Update available')
      expect(output).toContain('1.0.0')
      expect(output).toContain('2.0.0')
      expect(output).toMatch(/(npm install|pnpm add|yarn add|bun add) boltdocs@latest/)
      expect(output).toContain('╔')
      expect(output).toContain('╚')
    })
  })
})
