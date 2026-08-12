import { describe, expect, it } from 'vitest'
import {
  parseAnimalFilterParams,
  serializeAnimalFilterParams,
} from '@/shared/lib/animals/filterParams'

describe('animal filter params', () => {
  it('round-trips multi status and mode', () => {
    const q = serializeAnimalFilterParams({
      query: 'til',
      statusIds: ['a', 'b'],
      statusMode: 'all',
      species: 'Cat',
      sex: '',
    })
    expect(parseAnimalFilterParams(q)).toEqual({
      query: 'til',
      statusIds: ['a', 'b'],
      statusMode: 'all',
      species: 'Cat',
      sex: '',
    })
  })

  it('defaults statusMode to any', () => {
    expect(parseAnimalFilterParams('?status=x').statusMode).toBe('any')
  })
})
