import { ApiError } from './errors.mjs'

const JSON_HDR = { 'Content-Type': 'application/json; charset=utf-8' }

export function ok(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HDR })
}

export function fail(e) {
  const key = e.key || 'INTERNAL'
  const status = e.status || (key === 'QUOTA' ? 503 : key === 'NO_SPEECH' ? 422 : 500)
  return ok({ error: key, message: e.message }, status)
}

export async function readJson(request, maxKB = 16) {
  let raw
  try { raw = await request.text() } catch { throw new ApiError('BAD_INPUT', 400, '读取请求体失败') }
  if (raw.length > maxKB * 1024) throw new ApiError('BAD_INPUT', 400, '请求体过大')
  try { return JSON.parse(raw || '{}') } catch { throw new ApiError('BAD_INPUT', 400, 'JSON 解析失败') }
}
