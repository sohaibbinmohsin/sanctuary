import { describe, expect, it } from 'vitest'
import { hasAppUpdate, readRemoteBuildVersion } from '@/shared/lib/pwa/version'

describe('hasAppUpdate', () => {
  it('is true when the hosted version differs from this build', () => {
    expect(hasAppUpdate('abc', 'def')).toBe(true)
  })

  it('is false when versions match or the remote version is missing', () => {
    expect(hasAppUpdate('abc', 'abc')).toBe(false)
    expect(hasAppUpdate(null, 'abc')).toBe(false)
    expect(hasAppUpdate('abc', '')).toBe(false)
  })
})

describe('readRemoteBuildVersion', () => {
  it('reads a version string from the payload', async () => {
    await expect(
      readRemoteBuildVersion(async () => ({ version: 'build-1' })),
    ).resolves.toBe('build-1')
  })

  it('returns null when the payload is missing or fetch fails', async () => {
    await expect(readRemoteBuildVersion(async () => ({}))).resolves.toBe(null)
    await expect(
      readRemoteBuildVersion(async () => {
        throw new Error('offline')
      }),
    ).resolves.toBe(null)
  })
})
