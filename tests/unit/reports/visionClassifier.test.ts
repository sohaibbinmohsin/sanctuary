import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  prepareImageForVision,
  classifyReportPhoto,
  type AiImageAnalysis,
} from '@/features/reports/domain/visionClassifier'
import { supabase } from '@/shared/lib/supabase'

vi.mock('@/shared/lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

describe('visionClassifier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converts a blob/file to base64 string via prepareImageForVision', async () => {
    const mockBlob = new Blob(['sample-image-content'], { type: 'image/jpeg' })
    const base64 = await prepareImageForVision(mockBlob)
    expect(typeof base64).toBe('string')
    expect(base64.length).toBeGreaterThan(0)
  })

  it('classifies photo and returns structured AiImageAnalysis', async () => {
    const mockAnalysis: AiImageAnalysis = {
      is_animal_present: true,
      species_primary: 'Dog',
      species_details: 'Adult female stray dog with 4 nursing puppies',
      composition: 'mother_and_offspring',
      animal_count: 5,
      condition_and_injuries: 'Mother visibly limping on right leg, puppies active',
      environment_context: 'Roadside ditch near market',
    }

    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: mockAnalysis,
      error: null,
    })

    const mockBlob = new Blob(['photo-binary'], { type: 'image/jpeg' })
    const result = await classifyReportPhoto(mockBlob)

    expect(result).not.toBeNull()
    expect(result?.species_primary).toBe('Dog')
    expect(result?.composition).toBe('mother_and_offspring')
    expect(result?.animal_count).toBe(5)
    expect(result?.condition_and_injuries).toContain('limping on right leg')
  })

  it('returns null and does not throw if edge function returns an error', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: new Error('Rate limit exceeded') as any,
    })

    const mockBlob = new Blob(['photo-binary'], { type: 'image/jpeg' })
    const result = await classifyReportPhoto(mockBlob)
    expect(result).toBeNull()
  })

  it('returns null and does not throw on network exceptions', async () => {
    vi.mocked(supabase.functions.invoke).mockRejectedValueOnce(
      new Error('Failed to fetch')
    )

    const mockBlob = new Blob(['photo-binary'], { type: 'image/jpeg' })
    const result = await classifyReportPhoto(mockBlob)
    expect(result).toBeNull()
  })
})
