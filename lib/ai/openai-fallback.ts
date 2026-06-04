/**
 * Shared OpenAI invocation with model-fallback chain.
 * Ported from the Menehune health credentialing wallet pipeline.
 *
 * Primary model: gpt-5-mini  ·  Fallback: gpt-4o-mini
 *
 * Handles gpt-5 vs gpt-4 API differences:
 *   - gpt-5 family uses `max_completion_tokens` instead of `max_tokens`
 *   - gpt-5 may not accept a custom `temperature` — we omit it
 * On any access/parameter error, auto-retries with the fallback model so the
 * app keeps working on accounts without gpt-5 access yet.
 */

import OpenAI from 'openai'

export const PRIMARY_MODEL = 'gpt-5-mini'
export const FALLBACK_MODEL = 'gpt-4o-mini'

function shouldFallback(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('model_not_found') ||
    msg.includes('does not exist') ||
    msg.includes('does not have access') ||
    msg.includes('do not have access') ||
    msg.includes('not found') ||
    msg.includes('invalid model') ||
    msg.includes('invalid_model') ||
    msg.includes('404') ||
    msg.includes('unsupported_parameter') ||
    msg.includes('unsupported parameter') ||
    msg.includes('unsupported_value') ||
    msg.includes('unsupported value') ||
    msg.includes('max_tokens') ||
    msg.includes('max_completion_tokens') ||
    msg.includes('temperature') ||
    msg.includes('responses api') ||
    msg.includes('responses endpoint') ||
    msg.includes('use the responses') ||
    msg.includes('permission') ||
    msg.includes('not authorized') ||
    msg.includes('access denied')
  )
}

export type VisionImage = { base64: string; mimeType: string }

export async function chatCompletionWithFallback({
  apiKey,
  prompt,
  images,
  maxTokens,
  logTag,
}: {
  apiKey: string
  prompt: string
  images: VisionImage[]
  maxTokens: number
  logTag: string
}): Promise<string | null> {
  const openai = new OpenAI({ apiKey })
  const imageContent = images.map(img => ({
    type: 'image_url' as const,
    image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'high' as const },
  }))

  const tryModel = async (model: string): Promise<string | null> => {
    const isGpt5 = model.startsWith('gpt-5') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')
    const effectiveTokens = isGpt5 ? maxTokens * 2 : maxTokens
    const reasoningParam = isGpt5 ? { reasoning_effort: 'low' as const } : {}
    const tokenParam: Record<string, number> = isGpt5
      ? { max_completion_tokens: effectiveTokens }
      : { max_tokens: effectiveTokens }

    const response = await openai.chat.completions.create({
      model,
      ...tokenParam,
      ...reasoningParam,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageContent,
          ],
        },
      ],
    })
    return response.choices[0]?.message?.content?.trim() ?? null
  }

  try {
    const result = await tryModel(PRIMARY_MODEL)
    console.log(`[${logTag}] ${PRIMARY_MODEL} OK (${result ? result.length : 0} chars returned)`)
    return result
  } catch (err) {
    if (shouldFallback(err)) {
      console.warn(`[${logTag}] ${PRIMARY_MODEL} failed (${err instanceof Error ? err.message : err}), falling back to ${FALLBACK_MODEL}`)
      try {
        const result = await tryModel(FALLBACK_MODEL)
        console.log(`[${logTag}] ${FALLBACK_MODEL} fallback OK (${result ? result.length : 0} chars returned)`)
        return result
      } catch (fallbackErr) {
        console.error(`[${logTag}] Fallback ${FALLBACK_MODEL} also failed:`, fallbackErr)
        return null
      }
    }
    console.error(`[${logTag}] ${PRIMARY_MODEL} failed without fallback trigger:`, err)
    throw err
  }
}
