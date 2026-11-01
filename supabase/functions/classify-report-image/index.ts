// Deno Supabase Edge Function: classify-report-image
// Public endpoint for rapid, non-blocking image classification via Google Gemini Flash
// Config: [functions.classify-report-image] verify_jwt = false

import { consumeRateLimit } from '../_shared/rateLimit.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

function clientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim()
  if (cfIp) return cfIp
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const entries = forwarded.split(',').map((e) => e.trim()).filter(Boolean)
    if (entries.length > 0) return entries[entries.length - 1]!
  }
  return 'unknown'
}

const SYSTEM_PROMPT = `You are an expert veterinary triage and field rescue dispatcher in Pakistan.
Analyze this emergency rescue photo and return a strict JSON object with these exact keys:
- is_animal_present (boolean): true if one or more animals are visible
- species_primary (string): Primary species. Must be one of: "Dog", "Cat", "Bird", "Donkey", "Horse", "Cow", "Goat", "Other", "Unknown"
- species_details (string): Concise description of animal types, count, and age (e.g. "Stray female dog with 4 nursing puppies", "2 adult donkeys", "White domestic Persian cat")
- composition (string): One of "single_adult", "single_juvenile", "litter_only", "mother_and_offspring", "group_pack", "unknown"
- animal_count (number): Total number of visible animals (integer >= 1)
- condition_and_injuries (string): Objective, concise visual triage note describing visible injuries, bleeding, posture, or physical distress (e.g. "Laceration on right hind leg with active swelling, lying on side unable to stand", "Severely emaciated, fur loss consistent with mange")
- environment_context (string): Brief observation of surroundings (e.g. "Roadside gutter", "Open street", "Locked metal cage", "Construction rubble")

Be objective and factual. Do not guess names or speculate beyond visual evidence. Return ONLY the JSON object.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // Rate limiting (60 calls per minute per IP)
  const ip = clientIp(req)
  const allowed = consumeRateLimit(`classify:${ip}`, 60, 60)
  if (!allowed) {
    return jsonResponse({ error: 'rate_limited' }, 429, { 'Retry-After': '60' })
  }

  let body: { image_base64?: string; mime_type?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const { image_base64, mime_type = 'image/jpeg' } = body
  if (!image_base64 || typeof image_base64 !== 'string') {
    return jsonResponse({ error: 'missing_image_base64' }, 400)
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    // Return graceful fallback if API key is not configured in environment
    return jsonResponse({
      is_animal_present: true,
      species_primary: 'Unknown',
      species_details: 'Image provided for triage',
      composition: 'unknown',
      animal_count: 1,
      condition_and_injuries: 'Rescue report with visual evidence attached',
      environment_context: 'Field location',
      fallback: true,
    })
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mime_type,
                data: image_base64,
              },
            },
            {
              text: SYSTEM_PROMPT,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn('Gemini API call failed:', res.status, errText)
      return jsonResponse({
        is_animal_present: true,
        species_primary: 'Unknown',
        species_details: 'Image attached',
        composition: 'unknown',
        animal_count: 1,
        condition_and_injuries: 'Rescue report with visual evidence attached',
        environment_context: 'Field location',
        fallback: true,
      })
    }

    const data = await res.json()
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) {
      throw new Error('Empty response from model')
    }

    const parsed = JSON.parse(rawText)
    return jsonResponse({
      is_animal_present: Boolean(parsed.is_animal_present ?? true),
      species_primary: String(parsed.species_primary || 'Other'),
      species_details: String(parsed.species_details || 'Rescue animal observed in photo'),
      composition: String(parsed.composition || 'unknown'),
      animal_count: Number(parsed.animal_count) || 1,
      condition_and_injuries: String(parsed.condition_and_injuries || ''),
      environment_context: String(parsed.environment_context || ''),
      fallback: false,
    })
  } catch (err) {
    console.warn('Error during image classification:', err)
    return jsonResponse({
      is_animal_present: true,
      species_primary: 'Unknown',
      species_details: 'Image attached',
      composition: 'unknown',
      animal_count: 1,
      condition_and_injuries: 'Rescue report with visual evidence attached',
      environment_context: 'Field location',
      fallback: true,
    })
  }
})
