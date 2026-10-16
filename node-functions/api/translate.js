import { readJson, ok, fail } from '../_lib/web.mjs'
import { ApiError } from '../_lib/errors.mjs'
import { translateZhToPt } from '../_lib/translate.mjs'

export default async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') throw new ApiError('METHOD_NOT_ALLOWED', 405, 'Method Not Allowed')
    const { text } = (await readJson(context.request, 16)) || {}
    if (!text || typeof text !== 'string' || text.length > 200)
      throw new ApiError('BAD_INPUT', 400, '需要 1~200 字的 text')
    return ok(await translateZhToPt(text, context.env.ZHIPU_API_KEY))
  } catch (e) { return fail(e) }
}
