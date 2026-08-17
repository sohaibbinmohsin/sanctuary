import { describe, expect, it } from 'vitest'
import { emptyAnimalListState } from '@/shared/lib/animals/emptyAnimalListState'

describe('emptyAnimalListState', () => {
  it('keeps loading while sync is still pending even after hasSynced', () => {
    expect(
      emptyAnimalListState({ kind: 'pending', hasSynced: true }),
    ).toBe('loading')
  })

  it('keeps loading until the first successful download', () => {
    expect(
      emptyAnimalListState({ kind: 'synced', hasSynced: false }),
    ).toBe('loading')
  })

  it('only treats an empty query as a real empty shelter after sync', () => {
    expect(
      emptyAnimalListState({ kind: 'synced', hasSynced: true }),
    ).toBe('empty')
  })

  it('tells the user when the device is offline', () => {
    expect(
      emptyAnimalListState({ kind: 'offline', hasSynced: false }),
    ).toBe('offline')
  })

  it('tells the user when sync failed', () => {
    expect(
      emptyAnimalListState({ kind: 'failed', hasSynced: true }),
    ).toBe('failed')
  })
})
