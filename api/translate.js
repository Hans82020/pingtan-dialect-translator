import { readJson, json, fail } from './_lib/http.mjs'
import { translateZhToPt } from './_lib/translate.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, Object.assign(new Error('Method Not Allowed'), { status: 405 }))
  try {
    const { text } = (await readJson(req, 16)) || {}
    if (!text || typeof text !== 'string' || text.length > 200)
      throw Object.assign(new Error('需要 1~200 字的 text'), { status: 400, key: 'BAD_INPUT' })
    return json(res, 200, await translateZhToPt(text))
  } catch (e) { return fail(res, e) }
}
