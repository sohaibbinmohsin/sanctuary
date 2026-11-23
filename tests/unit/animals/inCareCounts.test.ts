/**
 * @vitest-environment node
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import {
  animalsListHeaderCountQuery,
  countAnimalsByLifeStage,
  countInCare,
} from '@/features/animals/domain/animals'
import type { SanctuaryDb } from '@/shared/lib/db'

function createShelterDb(): SanctuaryDb {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(`
    CREATE TABLE animal_statuses (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      label TEXT NOT NULL,
      counts_as_in_care INTEGER
    );
    CREATE TABLE animals (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      archived INTEGER NOT NULL,
      status_id TEXT,
      life_stage TEXT
    );
  `)

  const insertStatus = sqlite.prepare(
    `INSERT INTO animal_statuses (id, org_id, label, counts_as_in_care)
     VALUES (?, ?, ?, ?)`,
  )
  insertStatus.run('st-intake', 'org-1', 'Intake', 1)
  insertStatus.run('st-transferred', 'org-1', 'Transferred', 0)
  insertStatus.run('st-released', 'org-1', 'Released', 0)
  insertStatus.run('st-other', 'org-2', 'Intake', 1)

  const insertAnimal = sqlite.prepare(
    `INSERT INTO animals (id, org_id, archived, status_id, life_stage)
     VALUES (?, ?, ?, ?, ?)`,
  )
  insertAnimal.run('adult-in-care', 'org-1', 0, 'st-intake', 'adult')
  insertAnimal.run('child-in-care', 'org-1', 0, 'st-intake', 'child')
  insertAnimal.run('adult-transferred', 'org-1', 0, 'st-transferred', 'adult')
  insertAnimal.run('child-released', 'org-1', 0, 'st-released', 'child')
  insertAnimal.run('archived-in-care', 'org-1', 1, 'st-intake', 'adult')
  insertAnimal.run('other-org', 'org-2', 0, 'st-other', 'adult')

  const bind = (params: ReadonlyArray<unknown> = []) =>
    params as SQLInputValue[]

  return {
    execute: async (sql, params = []) => {
      sqlite.prepare(sql).run(...bind(params))
    },
    getAll: async <T>(sql: string, params: ReadonlyArray<unknown> = []) =>
      sqlite.prepare(sql).all(...bind(params)) as T[],
    getOptional: async <T>(sql: string, params: ReadonlyArray<unknown> = []) =>
      (sqlite.prepare(sql).get(...bind(params)) as T | undefined) ?? null,
    writeTransaction: async (callback) =>
      callback({
        execute: async (sql, params = []) => {
          sqlite.prepare(sql).run(...bind(params))
        },
      }),
  }
}

describe('in-care counts exclude statuses with counts_as_in_care = 0', () => {
  it('countInCare ignores transferred and other out-of-care animals', async () => {
    const db = createShelterDb()

    await expect(countInCare(db, 'org-1')).resolves.toBe(2)
  })

  it('adults and children are the same in-care set, so they sum to animals in care', async () => {
    const db = createShelterDb()

    const [inCare, stages] = await Promise.all([
      countInCare(db, 'org-1'),
      countAnimalsByLifeStage(db, 'org-1'),
    ])

    expect(stages).toEqual({ adult: 1, child: 1 })
    expect(stages.adult + stages.child).toBe(inCare)
  })

  it('animals list header count ignores transferred animals', async () => {
    const db = createShelterDb()
    const query = animalsListHeaderCountQuery('org-1')
    const row = await db.getOptional<{ n: number; total: number }>(
      query.sql,
      query.params,
    )

    expect(row).toEqual({ n: 2, total: 4 })
  })
})
