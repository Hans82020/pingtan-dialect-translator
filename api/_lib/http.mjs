export class ApiError extends Error {
  constructor(key, status = 500, message) { super(message || key); this.key = key; this.status = status; this.name = key }
}

export function json(res, code, obj) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

export function fail(res, e) {
  const key = e.key || 'INTERNAL'
  const code = e.status || (key === 'QUOTA' ? 503 : key === 'NO_SPEECH' ? 422 : 500)
  json(res, code, { error: key, message: e.message })
}

export function readJson(req, maxKB = 16) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', c => {
      size += c.length
      if (size > maxKB * 1024) { reject(new ApiError('BAD_INPUT', 400, '请求体过大')); req.destroy() }
      else chunks.push(c)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch { reject(new ApiError('BAD_INPUT', 400, 'JSON 解析失败')) }
    })
    req.on('error', reject)
  })
}
