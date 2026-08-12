export type AnimalFilterParams = {
  query: string
  statusIds: string[]
  statusMode: 'any' | 'all'
  species: string
  sex: string
}

export function parseAnimalFilterParams(search: string): AnimalFilterParams {
  const params = new URLSearchParams(search)

  return {
    query: params.get('query') ?? '',
    statusIds: params.getAll('status'),
    statusMode: params.get('statusMode') === 'all' ? 'all' : 'any',
    species: params.get('species') ?? '',
    sex: params.get('sex') ?? '',
  }
}

export function serializeAnimalFilterParams(
  filters: AnimalFilterParams,
): string {
  const params = new URLSearchParams()

  if (filters.query) params.set('query', filters.query)
  for (const statusId of filters.statusIds) {
    if (statusId) params.append('status', statusId)
  }
  if (filters.statusMode === 'all') params.set('statusMode', 'all')
  if (filters.species) params.set('species', filters.species)
  if (filters.sex) params.set('sex', filters.sex)

  const search = params.toString()
  return search ? `?${search}` : ''
}
