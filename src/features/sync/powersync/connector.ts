import {
  type AbstractPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/web'
import type { PostgrestSingleResponse, Session } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'

const FATAL_RESPONSE_CODES = [
  /^22...$/,
  /^23...$/,
  /^42501$/,
]

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error || !session) {
      throw new Error(
        `Could not fetch Supabase credentials: ${error?.message ?? 'no session'}`,
      )
    }

    const endpoint = import.meta.env.VITE_POWERSYNC_URL
    if (!endpoint) {
      throw new Error('VITE_POWERSYNC_URL is not set')
    }

    return {
      endpoint,
      token: session.access_token,
    }
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return

    let lastOp: CrudEntry | null = null
    try {
      for (const op of transaction.crud) {
        lastOp = op
        const table = supabase.from(op.table)
        let result: PostgrestSingleResponse<null>
        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id })
            break
          case UpdateType.PATCH:
            result = await table.update(op.opData).eq('id', op.id)
            break
          case UpdateType.DELETE:
            result = await table.delete().eq('id', op.id)
            break
        }

        if (result!.error) {
          const err = result!.error
          err.message = `Could not update Supabase. Received error: ${err.message}`
          throw err
        }
      }
      await transaction.complete()
    } catch (ex: unknown) {
      const error = ex as { code?: string }
      if (
        typeof error.code === 'string' &&
        FATAL_RESPONSE_CODES.some((regex) => regex.test(error.code!))
      ) {
        console.error('Data upload error - discarding:', lastOp, ex)
        await transaction.complete()
      } else {
        throw ex
      }
    }
  }

  async login(email: string, password: string): Promise<Session> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error || !data.session) {
      throw error ?? new Error('Login failed')
    }
    return data.session
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut()
  }
}

export const supabaseConnector = new SupabaseConnector()
