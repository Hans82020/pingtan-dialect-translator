import { readJson, fail } from '../_lib/web.mjs'
import { ApiError } from '../_lib/errors.mjs'
import { ttsMp3 } from '../_lib/tts.mjs'

export default async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') throw new ApiError('METHOD_NOT_ALLOWED', 405, 'Method Not Allowed')
    const { text } = (await readJson(context.request, 16)) || {}
    if (!text || typeof text !== 'string' || !text.trim() || text.length > 200)
      throw new ApiError('BAD_INPUT', 400, '需要 1~200 字的 text')
    const buf = await ttsMp3(text)
    return new Response(new Uint8Array(buf), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
  } catch (e) { return fail(e) }
}
