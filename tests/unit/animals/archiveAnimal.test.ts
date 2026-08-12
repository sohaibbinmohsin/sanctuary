import { describe, expect, it, vi } from 'vitest'
import { archiveAnimal } from '@/features/animals/domain/animals'

describe('archiveAnimal', () => {
  it('soft-archives the animal and clears its checklist item', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    const db = { execute } as never

    await archiveAnimal(db, 'animal-1')

    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0]).toEqual([
      expect.stringContaining('UPDATE animals SET archived = 1'),
      [expect.any(String), 'animal-1'],
    ])
    expect(execute.mock.calls[1]).toEqual([
      expect.stringContaining('DELETE FROM checklist_items WHERE animal_id'),
      ['animal-1'],
    ])
  })
})
