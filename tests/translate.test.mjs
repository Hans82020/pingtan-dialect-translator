import test from 'node:test'
import assert from 'node:assert/strict'
import { chatJson } from '../api/_lib/zhipu.mjs'

const okFetch = content => async () => ({
  ok: true, status: 200,
  json: async () => ({ choices: [{ message: { content } }] })
})
const GOOD = '前缀杂文{"pt_hanzi":"食罢未？","pt_buc":"Siăh-bà-muôi?","pt_rom":"siah4 ba3 muoi5","tones":"阴入-阴去-阳去","confidence":"high"}后缀'

test('正常解析并容忍模型输出前后杂文', async () => {
  const r = await chatJson('吃了吗', { apiKey: 'k', fetchImpl: okFetch(GOOD) })
  assert.equal(r.pt_hanzi, '食罢未？')
  assert.equal(r.confidence, 'high')
})
test('429 映射 QUOTA', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 429 }) }), /QUOTA/)
})
test('401 映射 UNAUTHORIZED', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 401 }) }), /UNAUTHORIZED/)
})
test('非 JSON 输出报 BAD_MODEL_OUTPUT', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: 'k', fetchImpl: okFetch('纯文本回复') }), /BAD_MODEL_OUTPUT/)
})
test('缺字段报 BAD_MODEL_OUTPUT', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: 'k', fetchImpl: okFetch('{"pt_hanzi":"你好"}') }), /BAD_MODEL_OUTPUT/)
})
test('缺 API Key 报 NO_API_KEY', async () => {
  await assert.rejects(() => chatJson('x', { apiKey: '', fetchImpl: okFetch(GOOD) }), /NO_API_KEY/)
})
