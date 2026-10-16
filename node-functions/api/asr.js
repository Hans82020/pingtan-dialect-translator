import { readJson, ok, fail } from '../_lib/web.mjs'
import { ApiError } from '../_lib/errors.mjs'
import { transcribe } from '../_lib/dashscope.mjs'

export default async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') throw new ApiError('METHOD_NOT_ALLOWED', 405, 'Method Not Allowed')
    const { audioBase64, mime = 'audio/wav' } = (await readJson(context.request, 5120)) || {}
    if (!audioBase64 || audioBase64.length > 4_500_000)
      throw new ApiError('BAD_INPUT', 400, '缺少音频或音频过大（上限约 30 秒）')
    return ok({ text: await transcribe({ audioBase64, mime }, 'mandarin', { apiKey: context.env.DASHSCOPE_API_KEY }) })
  } catch (e) { return fail(e) }
}
