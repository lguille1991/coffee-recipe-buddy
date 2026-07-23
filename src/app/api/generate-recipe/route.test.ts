import { describe, expect, it } from 'vitest'
import { POST } from './route'

const bean = { process: 'washed', roast_level: 'medium-light', roast_date: '2026-07-01' }

describe('POST /api/generate-recipe', () => {
  it('generates without an authenticated user, model client, or tracking cookie', async () => {
    const response = await POST(new Request('http://localhost/api/generate-recipe', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'v60', bean, target_water_g: 250, goal: 'clarity' }),
    }) as never)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.parameters.water_g).toBe(250)
    expect(body.generation_metadata.engine_version).toBe('v2.0.0')
  })

  it('defaults legacy callers to a balanced goal and accepts targetVolumeMl', async () => {
    const response = await POST(new Request('http://localhost/api/generate-recipe', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'v60', bean, targetVolumeMl: 250 }),
    }) as never)
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.generation_metadata.applied_rule_ids).toContain('goal:balanced')
  })

  it('returns stable capacity and mode errors', async () => {
    const oversized = await POST(new Request('http://localhost/api/generate-recipe', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'aeropress', bean, target_water_g: 300 }),
    }) as never)
    expect(oversized.status).toBe(422)
    expect(await oversized.json()).toMatchObject({ code: 'CAPACITY_EXCEEDED', bounds: { minWaterG: 120, maxWaterG: 250 } })

    const wrongMode = await POST(new Request('http://localhost/api/generate-recipe', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'origami', bean, target_water_g: 250, recipe_mode: 'four_six' }),
    }) as never)
    expect(wrongMode.status).toBe(422)
    expect(await wrongMode.json()).toMatchObject({ code: 'UNSUPPORTED_MODE' })
  })
})
