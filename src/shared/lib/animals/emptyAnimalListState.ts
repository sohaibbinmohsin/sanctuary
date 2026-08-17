import type { SyncStatusKind } from '@/shared/hooks/useSyncStatus'

export type EmptyAnimalListState = 'loading' | 'offline' | 'failed' | 'empty'

/**
 * What to show when the local animal query returned no rows.
 * An empty PowerSync DB during download is not a real empty shelter.
 */
export function emptyAnimalListState(input: {
  kind: SyncStatusKind
  hasSynced: boolean
}): EmptyAnimalListState {
  if (input.kind === 'offline') return 'offline'
  if (input.kind === 'failed') return 'failed'
  if (input.kind === 'pending' || !input.hasSynced) return 'loading'
  return 'empty'
}
