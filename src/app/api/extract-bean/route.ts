import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildExtractionPrompt } from '@/lib/prompt-builder'
import { ExtractionResponseSchema } from '@/types/recipe'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const imageFile = formData.get('image') as File | null

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Convert File to base64
    const bytes = await imageFile.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = (imageFile.type || 'image/jpeg') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/gif'
      | 'image/webp'

    const systemPrompt = buildExtractionPrompt()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Extract the coffee bean metadata from this bag photo and return the JSON.',
            },
          ],
        },
      ],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

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

    return NextResponse.json(validated.data)
  } catch (err) {
    console.error('[extract-bean]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
