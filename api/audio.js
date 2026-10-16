import { readJson, json, fail, ApiError } from './_lib/http.mjs'
import { transcribe } from './_lib/dashscope.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, Object.assign(new Error('Method Not Allowed'), { status: 405 }))
  try {
    const { audioBase64, mime = 'audio/wav' } = (await readJson(req, 5120)) || {}
    if (!audioBase64 || audioBase64.length > 4_500_000)
      throw new ApiError('BAD_INPUT', 400, '缺少音频或音频过大（上限约 30 秒）')
    return json(res, 200, { text: await transcribe({ audioBase64, mime }, 'pingtan') })
  } catch (e) { return fail(res, e) }
}
