import { NextRequest, NextResponse } from 'next/server'
import { buildExtractionPrompt } from '@/lib/prompt-builder'
import { createClient } from '@/lib/supabase/server'
import {
  attachGuestOpenRouterCookie,
  buildAuthenticatedOpenRouterUserId,
  createOpenRouterClient,
  getGuestOpenRouterUserId,
} from '@/lib/openrouter'
import { ExtractionResponseSchema } from '@/types/recipe'

const KNOWN_VARIETY_PATTERNS: Array<[RegExp, string]> = [
  [/\bgeisha\b/i, 'Geisha'],
  [/\bgesha\b/i, 'Gesha'],
  [/\bbourbon\b/i, 'Bourbon'],
  [/\btypica\b/i, 'Typica'],
  [/\bcaturra\b/i, 'Caturra'],
  [/\bcatuai\b/i, 'Catuai'],
  [/\bpacas\b/i, 'Pacas'],
  [/\bpacamara\b/i, 'Pacamara'],
  [/\bmaragogipe\b/i, 'Maragogipe'],
  [/\blaurina\b/i, 'Laurina'],
  [/\bsl[\s-]?28\b/i, 'SL28'],
  [/\bsl[\s-]?34\b/i, 'SL34'],
  [/\bpink bourbon\b/i, 'Pink Bourbon'],
]

function inferVarietyFromText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (!value) continue
    for (const [pattern, normalized] of KNOWN_VARIETY_PATTERNS) {
      if (pattern.test(value)) return normalized
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const client = createOpenRouterClient(req)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const guestTracking = user ? null : getGuestOpenRouterUserId(req)
    const openRouterUser = user
      ? buildAuthenticatedOpenRouterUserId(user)
      : guestTracking!.userId

    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Convert File to base64
    const bytes = await imageFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = imageFile.type || 'image/jpeg'

    const systemPrompt = buildExtractionPrompt()

    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-001',
      max_tokens: 1024,
      user: openRouterUser,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${base64}` },
            },
            {
              type: 'text',
              text: 'Extract the coffee bean metadata from this bag photo and return the JSON.',
            },
          ],
        },
      ],
    })

    const rawText = response.choices[0].message.content ?? ''

    // Parse JSON from response (strip markdown code fences if present)
    const jsonText = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json(
        { error: 'Model returned non-JSON response', raw: rawText },
        { status: 422 },
      )
    }

    const validated = ExtractionResponseSchema.safeParse(parsed)
    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Extraction response failed schema validation',
          issues: validated.error.issues,
          raw: parsed,
        },
        { status: 422 },
      )
    }

    const data = validated.data
    if (!data.bean.variety) {
      data.bean.variety = inferVarietyFromText(
        data.bean.bean_name,
        data.bean.finca,
        data.bean.producer,
      ) ?? undefined
    }

    if (!data.bean.bean_name && data.bean.variety) {
      data.bean.bean_name = data.bean.variety
    }

    return attachGuestOpenRouterCookie(
      NextResponse.json(data),
      guestTracking?.newGuestId ?? null,
    )
  } catch (err) {
    console.error('[extract-bean]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
