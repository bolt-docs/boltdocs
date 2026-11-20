import { describe, expect, it } from 'vitest'
import {
  beginServedRequest,
  endServedRequest,
  isServingRequest,
  resetServedRequests,
  servedRequestCount,
} from '../../src/node/dev-server/busy-gate'

describe('busy-gate', () => {
  it('starts idle', () => {
    resetServedRequests()
    expect(isServingRequest()).toBe(false)
    expect(servedRequestCount()).toBe(0)
  })

  it('reports busy while a request is in flight', () => {
    resetServedRequests()
    beginServedRequest()
    expect(isServingRequest()).toBe(true)
    endServedRequest()
    expect(isServingRequest()).toBe(false)
  })

  it('tracks concurrent requests', () => {
    resetServedRequests()
    beginServedRequest()
    beginServedRequest()
    expect(servedRequestCount()).toBe(2)
    endServedRequest()
    // Still busy: one request is outstanding.
    expect(isServingRequest()).toBe(true)
    endServedRequest()
    expect(isServingRequest()).toBe(false)
  })

  it('never goes negative', () => {
    resetServedRequests()
    // A thrown render path must not leave the counter below zero, which would
    // make `isServingRequest()` permanently false and let the warmup starve
    // real requests.
    endServedRequest()
    endServedRequest()
    expect(servedRequestCount()).toBe(0)
  })
})
