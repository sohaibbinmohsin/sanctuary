import {
  PowerSyncDatabase,
  WASQLiteOpenFactory,
  WASQLiteVFS,
  type AbstractPowerSyncDatabase,
} from '@powersync/web'
import { AppSchema } from './schema'
import { supabaseConnector } from './connector'

let db: PowerSyncDatabase | null = null
let playgroundDb: PowerSyncDatabase | null = null
let connecting: Promise<void> | null = null

export type PowerSyncDbOptions = {
  playground?: boolean
}

function openDatabase(dbFilename: string): PowerSyncDatabase {
  const enableMultiTabs = isMultiTabEnabled()
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: new WASQLiteOpenFactory({
      dbFilename,
      vfs: pickVfs(),
      flags: { enableMultiTabs },
    }),
    flags: { enableMultiTabs },
  })
}

function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) return true
  return (
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|Edg|OPR|Firefox|FxiOS|CriOS/i.test(ua)
  )
}

function isMultiTabEnabled(): boolean {
  return typeof SharedWorker !== 'undefined' && !isSafari()
}

function pickVfs(): WASQLiteVFS {
  const opfsAvailable =
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function'
  if (!opfsAvailable || isSafari()) {
    return WASQLiteVFS.IDBBatchAtomicVFS
  }
  return WASQLiteVFS.OPFSCoopSyncVFS
}

export function getPowerSyncDb(
  options: PowerSyncDbOptions = {},
): AbstractPowerSyncDatabase {
  if (options.playground) {
    if (!playgroundDb) {
      playgroundDb = openDatabase('sanctuary-playground.db')
    }
    return playgroundDb
  }
  if (!db) {
    db = openDatabase('sanctuary.db')
  }
  return db
}

export async function connectPowerSync(): Promise<AbstractPowerSyncDatabase> {
  const database = getPowerSyncDb()
  if (!connecting) {
    connecting = database
      .connect(supabaseConnector)
      .then(() => undefined)
      .catch((err) => {
        connecting = null
        throw err
      })
  }
  await connecting
  return database
}

export async function disconnectPowerSync(): Promise<void> {
  if (db) {
    await db.disconnect()
    connecting = null
  }
}
