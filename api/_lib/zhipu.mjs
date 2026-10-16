import { ApiError } from './http.mjs'

export const SYSTEM_PROMPT = `你是平潭话（闽东语侯官片，近福清话）专家。把用户给的普通话句子翻译成平潭话口语。
要求：
1. pt_hanzi 用平潭话口语汉字写法（如：吃了吗→食罢未；你→汝；他→伊；人→侬；说→讲）。
2. pt_buc 用平话字（Bàng-uâ-cê）拼写；pt_rom 用榕拼式声调数字（1阴平 2阳平 3阴上 4阳上 5阴去 6阳去 7阴入 8阳入，如 siah4 ba3 muoi5）。
3. tones 按每字声调用 - 连接，调名只能取：阴平/阳平/阴上/阳上/阴去/阳去/阴入/阳入。
4. 只输出 JSON：{"pt_hanzi":"","pt_buc":"","pt_rom":"","tones":"","confidence":"high或low"}。拼写拿不准时给 confidence:"low"。
示例：输入"吃了吗" → {"pt_hanzi":"食罢未？","pt_buc":"Siăh-bà-muôi?","pt_rom":"siah4 ba3 muoi5","tones":"阴入-阴去-阳去","confidence":"high"}
示例：输入"你好" → {"pt_hanzi":"汝好","pt_buc":"Nṳ̄ hō","pt_rom":"ny3 ho2","tones":"阳上-阴平","confidence":"high"}`

function extractJson(s) {
  const m = String(s).match(/\{[\s\S]*\}/)
  if (!m) throw new ApiError('BAD_MODEL_OUTPUT', 502, '模型未返回 JSON')
  try { return JSON.parse(m[0]) }
  catch { throw new ApiError('BAD_MODEL_OUTPUT', 502, '模型输出的 JSON 无法解析') }
}

export function parseResult(raw) {
  for (const k of ['pt_hanzi', 'pt_buc', 'pt_rom', 'tones', 'confidence'])
    if (typeof raw[k] !== 'string' || !raw[k]) throw new ApiError('BAD_MODEL_OUTPUT', 502, '缺少字段 ' + k)
  if (!['high', 'low'].includes(raw.confidence)) raw.confidence = 'low'
  return raw
}

export async function chatJson(text, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new ApiError('NO_API_KEY', 500, '未配置 ZHIPU_API_KEY')
  let r
  try {
    r = await fetchImpl('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'glm-4-flash', temperature: 0.3,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }]
      })
    })
  } catch (e) { throw new ApiError('UPSTREAM_UNREACHABLE', 502, String(e)) }
  if (r.status === 401 || r.status === 403) throw new ApiError('UNAUTHORIZED', 500, '智谱 API Key 无效')
  if (r.status === 429) throw new ApiError('QUOTA', 503, '免费额度用尽或限流')
  if (!r.ok) throw new ApiError('UPSTREAM', 502, '智谱返回 ' + r.status)
  const data = await r.json().catch(() => { throw new ApiError('BAD_RESPONSE', 502, '智谱响应解析失败') })
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new ApiError('BAD_RESPONSE', 502, '智谱响应缺少内容')
  return parseResult(extractJson(content))
}
