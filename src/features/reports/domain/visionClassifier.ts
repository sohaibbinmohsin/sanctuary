import { supabase, supabaseConfigured } from '@/shared/lib/supabase'

export interface AiImageAnalysis {
  is_animal_present: boolean
  species_primary: string
  species_details: string
  composition:
    | 'single_adult'
    | 'single_juvenile'
    | 'litter_only'
    | 'mother_and_offspring'
    | 'group_pack'
    | 'unknown'
  animal_count: number
  condition_and_injuries: string
  environment_context: string
  fallback?: boolean
}

/**
 * Converts a Blob or File directly to a base64 string.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === 'function') {
    const arrayBuf = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!)
    }
    return btoa(binary)
  }

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const res = (reader.result as string) || ''
      const base64 = res.includes(',') ? res.split(',')[1] || '' : res
      resolve(base64)
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(blob)
  })
}

/**
 * Resizes an image file/blob to a maximum dimension (default 768px)
 * and exports as base64 JPEG for efficient transmission over cellular networks.
 * Falls back to direct base64 encoding if canvas or bitmap decoding is unavailable.
 */
export async function prepareImageForVision(
  file: Blob | File,
  maxDimension = 768
): Promise<string> {
  try {
    if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height)
        bitmap.close()
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        canvas.width = 0
        canvas.height = 0
        const base64 = dataUrl.split(',')[1] || ''
        if (base64) return base64
      } else {
        bitmap.close()
      }
    }
  } catch {
    // Fall back to direct base64 encoding
  }

  return blobToBase64(file)
}

async function classifyDirectGemini(
  base64: string,
  apiKey: string
): Promise<AiImageAnalysis | null> {
  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
    const prompt = `You are an expert veterinary triage and field rescue dispatcher in Pakistan.
Analyze this emergency rescue photo and return a strict JSON object with these exact keys:
- is_animal_present (boolean): true if one or more animals are visible
- species_primary (string): Primary species. Must be one of: "Dog", "Cat", "Bird", "Donkey", "Horse", "Cow", "Goat", "Other", "Unknown"
- species_details (string): Concise description of animal types, count, and age (e.g. "Stray female dog with 4 nursing puppies", "2 adult donkeys", "White domestic Persian cat")
- composition (string): One of "single_adult", "single_juvenile", "litter_only", "mother_and_offspring", "group_pack", "unknown"
- animal_count (number): Total number of visible animals (integer >= 1)
- condition_and_injuries (string): Objective, concise visual triage note describing visible injuries, bleeding, posture, or physical distress
- environment_context (string): Brief observation of surroundings

Be objective and factual. Do not guess names or speculate beyond visual evidence. Return ONLY the JSON object.`

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: base64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) return null
    const parsed = JSON.parse(rawText)
    return {
      is_animal_present: Boolean(parsed.is_animal_present ?? true),
      species_primary: String(parsed.species_primary || 'Other'),
      species_details: String(parsed.species_details || ''),
      composition: (parsed.composition as AiImageAnalysis['composition']) || 'unknown',
      animal_count: Math.max(1, Number(parsed.animal_count) || 1),
      condition_and_injuries: String(parsed.condition_and_injuries || ''),
      environment_context: String(parsed.environment_context || ''),
      fallback: false,
    }
  } catch {
    return null
  }
}

/**
 * Asynchronously classifies a rescue photo in the background.
 * Returns null if the service is unreachable or rate limited,
 * ensuring public submission is never blocked.
 */
export async function classifyReportPhoto(
  file: Blob | File
): Promise<AiImageAnalysis | null> {
  try {
    const base64 = await prepareImageForVision(file, 768)
    if (!base64) return null

    if (supabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('classify-report-image', {
        body: {
          image_base64: base64,
          mime_type: 'image/jpeg',
        },
      })

      if (!error && data && !data.fallback) {
        return {
          is_animal_present: Boolean(data.is_animal_present ?? true),
          species_primary: String(data.species_primary || 'Other'),
          species_details: String(data.species_details || ''),
          composition: (data.composition as AiImageAnalysis['composition']) || 'unknown',
          animal_count: Math.max(1, Number(data.animal_count) || 1),
          condition_and_injuries: String(data.condition_and_injuries || ''),
          environment_context: String(data.environment_context || ''),
          fallback: Boolean(data.fallback),
        }
      }
    }

    const localApiKey = import.meta.env.VITE_GEMINI_API_KEY
    if (localApiKey) {
      const direct = await classifyDirectGemini(base64, localApiKey)
      if (direct) return direct
    }

    return null
  } catch {
    // Fail silently without disrupting user interaction
    return null
  }
}
