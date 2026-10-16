const TIMEOUT_MS = 15000

export class ApiError extends Error {
  constructor(key, status, message) { super(message || key); this.key = key; this.status = status }
}

async function withTimeout(url, opts) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), TIMEOUT_MS)
  try { return await fetch(url, { ...opts, signal: c.signal }) } finally { clearTimeout(t) }
}

export async function postJSON(url, data, retries = 1) {
  let last
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await withTimeout(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      })
      if ((r.headers.get('content-type') || '').includes('application/json')) {
        const j = await r.json()
        if (!r.ok) throw new ApiError(j.error || 'UNKNOWN', r.status, j.message)
        return j
      }
      throw new ApiError('BAD_RESPONSE', r.status, (await r.text()).slice(0, 120))
    } catch (e) {
      last = e.name === 'AbortError' ? new ApiError('TIMEOUT', 0, '请求超时，请重试或改用打字') : e
    }
  }
  throw last
}

export function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

export async function postAudio(url, blob) {
  return postJSON(url, { audioBase64: await blobToBase64(blob), mime: blob.type || 'audio/wav' })
}

export async function fetchTTS(text) {
  const r = await withTimeout('/api/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
  })
  if (!r.ok) throw new ApiError('TTS_FAILED', r.status, '朗读失败')
  return URL.createObjectURL(await r.blob())
}
