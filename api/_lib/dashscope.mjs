import { ApiError } from './http.mjs'

const URL_ = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

export const PROMPTS = {
  mandarin: '请把这段普通话录音逐字转写为简体中文文本，只输出转写文本本身，不要任何解释。',
  pingtan: '这是一段中国福建省平潭县一带的闽东语（福州话-福清话口音）口语录音。请把它翻译成通顺的普通话简体中文文本，只输出译文本身，不要任何解释。如果完全无法理解，只输出：[无法识别]'
}

function fmtOf(mime) {
  if (/wav/i.test(mime)) return 'wav'
  if (/mp3|mpeg/i.test(mime)) return 'mp3'
  throw new ApiError('BAD_INPUT', 400, '仅支持 wav/mp3 音频')
}

export function parseText(content) {
  const t = String(content || '').trim()
  if (!t || t === '[无法识别]') throw new ApiError('NO_SPEECH', 422, '没听清，请重说或改用打字')
  return t
}

export async function transcribe({ audioBase64, mime }, mode, { apiKey, fetchImpl = fetch } = {}) {
  const key = apiKey || process.env.DASHSCOPE_API_KEY
  if (!key) throw new ApiError('NO_API_KEY', 500, '未配置 DASHSCOPE_API_KEY')
  const format = fmtOf(mime)
  let r
  try {
    r = await fetchImpl(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'qwen2-audio-instruct',
        messages: [
          { role: 'system', content: PROMPTS[mode] },
          { role: 'user', content: [{ type: 'input_audio', input_audio: { data: audioBase64, format } }] }
        ]
      })
    })
  } catch (e) { throw new ApiError('UPSTREAM_UNREACHABLE', 502, String(e)) }
  if (r.status === 401 || r.status === 403) throw new ApiError('UNAUTHORIZED', 500, '百炼 API Key 无效')
  if (r.status === 429) throw new ApiError('QUOTA', 503, '免费额度用尽或限流')
  if (!r.ok) throw new ApiError('UPSTREAM', 502, '百炼返回 ' + r.status)
  const data = await r.json().catch(() => { throw new ApiError('BAD_RESPONSE', 502, '百炼响应解析失败') })
  return parseText(data?.choices?.[0]?.message?.content)
}
