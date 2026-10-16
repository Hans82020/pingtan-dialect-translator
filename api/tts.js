import { readJson, fail, ApiError } from './_lib/http.mjs'
import { ttsMp3 } from './_lib/tts.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, Object.assign(new Error('Method Not Allowed'), { status: 405 }))
  try {
    const { text } = (await readJson(req, 16)) || {}
    if (!text || typeof text !== 'string' || !text.trim() || text.length > 200)
      throw new ApiError('BAD_INPUT', 400, '需要 1~200 字的 text')
    const buf = await ttsMp3(text)
    res.statusCode = 200
    res.setHeader('Content-Type', 'audio/mpeg')
    res.end(buf)
  } catch (e) { return fail(res, e) }
}
