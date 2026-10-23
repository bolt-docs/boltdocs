import { describe, expect, it } from 'vitest'
import { createStaticSsgOptions } from '../../src/node/plugin/ssg-static-options'

describe('static SSG options', () => {
  it('does not install jsdom for a production build', () => {
    expect(createStaticSsgOptions().mock).toBe(false)
  })

  it('lets a project opt back into the DOM shim', () => {
    expect(createStaticSsgOptions({ ssg: { mock: true } }).mock).toBe(true)
  })

  it('keeps the shim on when the dev server asks for it', () => {
    expect(createStaticSsgOptions(undefined, { mock: true }).mock).toBe(true)
  })

  it('lets the dev server override the project setting', () => {
    expect(
      createStaticSsgOptions({ ssg: { mock: false } }, { mock: true }).mock,
    ).toBe(true)
  })
})
