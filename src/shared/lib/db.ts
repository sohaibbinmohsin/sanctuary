/**
 * Minimal DB surface used by feature domain modules.
 * Avoids tight coupling to PowerSync class hierarchies (web vs react typings).
 */
export type SanctuaryDb = {
  execute: (sql: string, params?: ReadonlyArray<unknown>) => Promise<unknown>
  getAll: <T>(sql: string, params?: ReadonlyArray<unknown>) => Promise<T[]>
  getOptional: <T>(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ) => Promise<T | null>
  writeTransaction: <T>(
    callback: (tx: {
      execute: (sql: string, params?: ReadonlyArray<unknown>) => Promise<unknown>
    }) => Promise<T>,
  ) => Promise<T>
  getNextCrudTransaction?: () => Promise<{
    crud: Array<{
      op: string
      table: string
      id: string
      opData?: Record<string, unknown>
    }>
    complete: () => Promise<void>
  } | null>
  connect?: (connector: unknown) => Promise<void>
  disconnect?: () => Promise<void>
  currentStatus?: {
    connected: boolean
    connecting: boolean
    /** True after at least one successful sync downloaded into local DB. */
    hasSynced?: boolean
    dataFlowStatus: {
      downloading?: boolean
      uploading?: boolean
      downloadError?: Error
      uploadError?: Error
    }
  }
  registerListener?: (listener: {
    statusChanged?: () => void
  }) => () => void
}

export function asDb(db: unknown): SanctuaryDb {
  return db as SanctuaryDb
}
