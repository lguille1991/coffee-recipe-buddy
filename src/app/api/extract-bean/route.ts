import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { buildExtractionPrompt } from '@/lib/prompt-builder'
import { ExtractionResponseSchema } from '@/types/recipe'

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
})

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
    const mediaType = imageFile.type || 'image/jpeg'

    const systemPrompt = buildExtractionPrompt()

    const response = await client.chat.completions.create({
      model: 'google/gemini-2.0-flash-001',
      max_tokens: 1024,
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
    if (!data.bean.bean_name && data.bean.variety) {
      data.bean.bean_name = data.bean.variety
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[extract-bean]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
