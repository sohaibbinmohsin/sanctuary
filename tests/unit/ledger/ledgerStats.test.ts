import { describe, it, expect } from 'vitest'
import { sumExpensesByCategory } from '@/features/ledger/domain/ledger'

describe('ledger stats functions', () => {
  it('groups expenses by category ordered by total cents descending', async () => {
    const mockDb = {
      getAll: async () => [
        { category_id: 'cat-1', label: 'Veterinary', total: 500000 },
        { category_id: 'cat-2', label: 'Food', total: 300000 },
      ],
    } as any

    const res = await sumExpensesByCategory(mockDb, 'org-1', 5)
    expect(res).toHaveLength(2)
    expect(res[0]).toEqual({
      categoryId: 'cat-1',
      label: 'Veterinary',
      totalCents: 500000,
    })
  })
})
